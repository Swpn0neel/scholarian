"use client";

import { useRef, useMemo, useState } from "react";
import { Send, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useResearchStore, type QAMessage } from "@/hooks/useResearchStore";
import { cn } from "@/lib/utils";

const PLACEHOLDERS = [
  "Ask a question about the report…",
  "Refine: 'narrow to clinical trials only'…",
  "Compare: 'compare report 1 with report 2'…",
  "Type 'finalize' to lock this research session…",
];

interface Props {
  chatId: string;
  disabled?: boolean;
  /** Called when a refinement is requested. Receives refined topic and titles to exclude. */
  onRefineRequest?: (refinedTopic: string, excludeTitles: string[]) => void;
  /** Called when a custom report generation is requested for specific paper indices. */
  onCustomReportRequest?: (indices: number[]) => void;
}

/** Persist a Q&A pair to the DB (fire-and-forget) */
async function persistMessage(
  chatId: string,
  runId: string | null,
  question: string,
  answer: string,
  index: number,
  type: "qa" | "refine" | "compare" | "report"
) {
  await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, runId, question, answer, questionIndex: index, type }),
  });
}

export function FeedbackInput({ chatId, disabled, onRefineRequest, onCustomReportRequest }: Props) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "refining" | "comparing">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const store = useResearchStore();
  const isLoading = status !== "idle";

  // Stable placeholder — computed once per mount to avoid hydration mismatches
  const placeholder = useMemo(
    () => PLACEHOLDERS[Math.floor(Date.now() / 60000) % PLACEHOLDERS.length],
    []
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setInput("");
    setStatus("loading");

    try {
      // 1. Classify intent
      const intentRes = await fetch("/api/intent/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const { intent, payload } = (await intentRes.json()) as { intent: string; payload: string };

      // ── ACCEPT ──────────────────────────────────────────────────────────
      if (intent === "accept") {
        store.setStep("finalized", "Research finalized. Report locked.");
        const answer = "✓ Research session finalized. Your report is locked.";
        const msg: QAMessage = {
          id: crypto.randomUUID(),
          question: trimmed,
          answer,
          // Re-read message count in case it changed during the intent fetch
          index: useResearchStore.getState().messages.length + 1,
          type: "qa",
          createdAt: Date.now(),
          runId: store.currentRunId,
        };
        store.addMessage(msg);
        void persistMessage(chatId, store.currentRunId, trimmed, answer, msg.index, "qa");
        return;
      }

      // ── COMPARE ─────────────────────────────────────────────────────────
      if (intent === "compare") {
        const [aStr, bStr] = payload.split(",");
        const aIdx = parseInt(aStr ?? "1", 10);
        const bIdx = parseInt(bStr ?? "2", 10);

        // Stream the comparison
        const response = await fetch("/api/pipeline/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, reportAIndex: aIdx, reportBIndex: bIdx }),
        });

        if (!response.ok) {
          const { error } = await response.json() as { error: string };
          const msg: QAMessage = {
            id: crypto.randomUUID(),
            question: trimmed,
            answer: `⚠ ${error}`,
            index: useResearchStore.getState().messages.length + 1,
            type: "compare",
            createdAt: Date.now(),
            runId: store.currentRunId,
          };
          store.addMessage(msg);
          return;
        }

        let comparisonText = "";
        setStatus("comparing");

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const frames = buf.split("\n\n");
            buf = frames.pop() ?? "";
            for (const frame of frames) {
              const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
              const evLine = frame.split("\n").find((l) => l.startsWith("event:"));
              if (dataLine && evLine?.includes("report")) {
                try {
                  const { chunk } = JSON.parse(dataLine.replace(/^data:\s*/, "")) as { chunk: string };
                  comparisonText += chunk;
                } catch { /* skip */ }
              }
            }
          }
        }
        // NOTE: do NOT call store.setStep here — comparison must not
        // affect the main ReportViewer or active pipeline state.

        const compareMsg: QAMessage = {
          id: crypto.randomUUID(),
          question: trimmed,
          answer: comparisonText || "Comparison generated.",
          index: useResearchStore.getState().messages.length + 1,
          type: "compare",
          createdAt: Date.now(),
          runId: store.currentRunId,
        };
        store.addMessage(compareMsg);
        void persistMessage(chatId, store.currentRunId, trimmed, comparisonText, compareMsg.index, "compare");
        return;
      }

      // ── CUSTOM REPORT ───────────────────────────────────────────────────
      if (intent === "generate_custom_report") {
        const numbers = Array.from(new Set(payload.match(/\d+/g) || []));
        if (numbers.length > 0) {
          const allIndices = numbers.map((n) => parseInt(n, 10) - 1);
          const validIndices = allIndices.filter((i) => i >= 0 && i < store.papers.length);

          if (validIndices.length > 0) {
            const missing = allIndices.filter((i) => i < 0 || i >= store.papers.length).map(i => i + 1);
            let answer = `Generating a targeted report for papers: ${validIndices.map((i) => i + 1).sort((a,b) => a-b).join(", ")}…`;
            if (missing.length > 0) {
              answer += `\n\n(Note: Papers ${missing.join(", ")} were not found in the current results and were skipped.)`;
            }

            const customMsg: QAMessage = {
              id: crypto.randomUUID(),
              question: trimmed,
              answer,
              index: useResearchStore.getState().messages.length + 1,
              type: "qa",
              createdAt: Date.now(),
              runId: store.currentRunId,
            };
            store.addMessage(customMsg);
            void persistMessage(chatId, store.currentRunId, trimmed, answer, customMsg.index, "qa");
            onCustomReportRequest?.(validIndices);
            return;
          }
        }

        // Fallback if no valid numbers found
        const errorAnswer = "I couldn't find any valid paper numbers in your request. Please specify them using numbers like 'paper 1, 2, 5'.";
        const errorMsg: QAMessage = {
          id: crypto.randomUUID(),
          question: trimmed,
          answer: errorAnswer,
          index: useResearchStore.getState().messages.length + 1,
          type: "qa",
          createdAt: Date.now(),
          runId: store.currentRunId,
        };
        store.addMessage(errorMsg);
        return;
      }

      // ── REFINE ──────────────────────────────────────────────────────────
      if (intent === "refine") {
        setStatus("refining");
        const refineRes = await fetch("/api/pipeline/refine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId,
            feedback: trimmed,
            currentTopic: store.settings.topic,
            excludeTitles: store.papers.slice(0, store.settings.topK).map((p) => p.title),
            currentSettings: store.settings,
          }),
        });
        const data = (await refineRes.json()) as {
          refinedTopic?: string;
          explanation?: string;
          message?: string;
        };

        const refinedTopic = data.refinedTopic ?? store.settings.topic;
        const explanation = data.explanation ?? data.message ?? "Topic updated.";
        const answer = `**Refined topic:** "${refinedTopic}"\n\n${explanation}\n\nRe-running the research pipeline with the refined topic…`;

        const refineMsg: QAMessage = {
          id: crypto.randomUUID(),
          question: trimmed,
          answer,
          index: useResearchStore.getState().messages.length + 1,
          type: "refine",
          createdAt: Date.now(),
          runId: store.currentRunId,
        };
        store.addMessage(refineMsg);
        void persistMessage(chatId, store.currentRunId, trimmed, answer, refineMsg.index, "refine");

        // Capture excluded titles BEFORE archiving current run
        const excludeTitles = store.papers
          .slice(0, store.settings.topK)
          .map((p) => p.title);

        // Update topic and trigger re-run (passing excludeTitles so pipeline
        // can filter them out and surface fresh papers)
        store.setSettings({ topic: refinedTopic });
        onRefineRequest?.(refinedTopic, excludeTitles);
        return;
      }

      // ── ASK (default) ───────────────────────────────────────────────────
      store.setIsAnswering(true);
      const qaRes = await fetch("/api/pipeline/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          // Truncate large reports to avoid bloating the QA request payload
          reportMarkdown: store.reportMarkdown.slice(0, 6000),
          topic: store.settings.topic,
          papers: store.papers.slice(0, store.settings.topK),
        }),
      });
      const { answer } = (await qaRes.json()) as { answer: string };
      store.setIsAnswering(false);

      const qaMsg: QAMessage = {
        id: crypto.randomUUID(),
        question: trimmed,
        answer,
        index: useResearchStore.getState().messages.length + 1,
        type: "qa",
        createdAt: Date.now(),
        runId: store.currentRunId,
      };
      store.addMessage(qaMsg);
      void persistMessage(chatId, store.currentRunId, trimmed, answer, qaMsg.index, "qa");

    } catch {
      store.setIsAnswering(false);
      const fallbackMsg: QAMessage = {
        id: crypto.randomUUID(),
        question: input || trimmed,
        answer: "Something went wrong. Please try again.",
        index: (store.messages.at(-1)?.index ?? 0) + 1,
        type: "qa",
        createdAt: Date.now(),
        runId: store.currentRunId,
      };
      store.addMessage(fallbackMsg);
    } finally {
      setStatus("idle");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex gap-3 rounded-xl border border-secondary/10 bg-white p-3 shadow-ambient transition-all",
        disabled && "opacity-60 pointer-events-none"
      )}
    >
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={disabled || isLoading}
        placeholder={disabled ? "Session finalized" : placeholder}
        className="h-11 flex-1 rounded-lg border border-secondary/10 bg-surface px-4 text-sm text-on-surface outline-none placeholder:text-secondary/40 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
      />
      <Button
        type="submit"
        disabled={disabled || isLoading || !input.trim()}
        className="h-11 min-w-[90px] rounded-lg bg-primary px-4 text-white"
      >
        {isLoading ? (
          status === "refining" ? (
            <><RefreshCw className="size-4 animate-spin" /> Refining…</>
          ) : (
            <><Loader2 className="size-4 animate-spin" /> Working…</>
          )
        ) : (
          <><Send className="size-4" /> Send</>
        )}
      </Button>
    </form>
  );
}
