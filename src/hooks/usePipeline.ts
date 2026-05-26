"use client";

import { useEffect, useRef } from "react";
import type { PipelineStep, RankedPaper, ResearchSettings } from "@/types";
import { useResearchStore, type QAMessage, type CompletedRun } from "./useResearchStore";

type StreamEvent =
  | { event: "step"; data: { step: string; message: string } }
  | { event: "papers"; data: RankedPaper[] }
  | { event: "pass1_papers"; data: RankedPaper[] }
  | { event: "report"; data: { chunk: string } }
  | { event: "done"; data: { runId?: string; reportId?: string; content?: string } }
  | { event: "reset"; data?: Record<string, never> }
  | { event: "error"; data: { message: string } };

async function readSseResponse(response: Response, onEvent: (event: StreamEvent) => void) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response stream available.");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const lines = frame.split("\n");
      let eventName = "";
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith("event:")) eventName = line.replace(/^event:\s*/, "").trim();
        else if (line.startsWith("data:")) dataLines.push(line.replace(/^data:\s*/, ""));
      }
      if (eventName && dataLines.length > 0) {
        try { onEvent({ event: eventName, data: JSON.parse(dataLines.join("\n")) } as StreamEvent); }
        catch { /* skip */ }
      }
    }
  }
}

// ── localStorage ─────────────────────────────────────────────────────────────

function cacheKey(id: string) { return `scholarian:chat:${id}`; }

interface ChatCache {
  settings?: ResearchSettings;
  completedRuns?: CompletedRun[];
}

function loadCache(id: string): ChatCache {
  try { return JSON.parse(localStorage.getItem(cacheKey(id)) ?? "{}") as ChatCache; }
  catch { return {}; }
}

function saveCache(id: string, data: Partial<ChatCache>) {
  try {
    const prev = loadCache(id);
    localStorage.setItem(cacheKey(id), JSON.stringify({ ...prev, ...data }));
  } catch { /* quota/private mode */ }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePipeline(chatId: string) {
  const store = useResearchStore();
  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;
  const prevChatId = useRef<string | null>(null);

  // Persist settings changes
  useEffect(() => {
    if (!chatIdRef.current) return;
    saveCache(chatIdRef.current, { settings: store.settings });
  }, [store.settings]);

  // Persist completedRuns whenever they change
  useEffect(() => {
    if (!chatIdRef.current || store.completedRuns.length === 0) return;
    saveCache(chatIdRef.current, { completedRuns: store.completedRuns });
  }, [store.completedRuns]);

  // Chat switch: full reset + load history
  useEffect(() => {
    let isMounted = true;

    if (prevChatId.current !== chatId) {
      // Immediately reset to clean state.
      // CRITICAL: clear loadedChatId FIRST so the stale guard in ChatWorkspace
      // fires synchronously on the very first render of the new route, preventing
      // any data from the previous chat from bleeding through even for a single frame.
      const s = useResearchStore.getState();
      s.setLoadedChatId(null);
      s.resetAll();

      // Only seed from localStorage for real (persisted) chats — not temp IDs.
      // Seeding a temp chat would bleed in old cached state before the server returns empty.
      const isTemp = chatId.startsWith("temp-");
      if (!isTemp) {
        const cached = loadCache(chatId);
        if (cached.settings) s.setSettings(cached.settings);
        if (cached.completedRuns?.length) {
          cached.completedRuns.forEach((r) => s.addCompletedRun(r));
        }
      }
    }
    prevChatId.current = chatId;

    async function loadHistory() {
      useResearchStore.getState().setIsLoadingHistory(true);
      try {
        const res = await fetch(`/api/chats/${chatId}/history`);
        if (!res.ok) return;
        const data = await res.json() as {
          chatTitle?: string;
          runs?: Array<{
            runId: string;
            papers: RankedPaper[];
            reportMarkdown: string;
            settings: ResearchSettings | null;
            events: Array<{ step: PipelineStep; message: string; ts: number }>;
            createdAt: number | null;
          }>;
          messages?: QAMessage[];
        };
        if (!isMounted) return;

        // Server is authoritative — full reset, then re-populate
        const s = useResearchStore.getState();
        s.resetAll();

        if (data.chatTitle) s.setChatTitle(data.chatTitle);
        if (data.messages?.length) s.setMessages(data.messages);

        const allRuns = data.runs ?? [];
        // Filter out completely empty runs (no papers, no report, no events) —
        // these can appear if a run_id exists in metadata but the pipeline failed
        // before saving any papers.
        const meaningfulRuns = allRuns.filter(
          (r) => r.papers.length > 0 || r.reportMarkdown || r.events.length > 0
        );
        if (meaningfulRuns.length === 0) return;

        const olderRuns = meaningfulRuns.slice(0, -1);
        const latestRun = meaningfulRuns[meaningfulRuns.length - 1]!;

        // Restore all previous (completed) runs
        for (let i = 0; i < olderRuns.length; i++) {
          const r = olderRuns[i]!;
          // Prefer the real DB timestamp, then message timestamps, then synthetic fallback
          const runMessages = (data.messages ?? []).filter((m) => m.runId === r.runId);
          const completedAt = r.createdAt
            ?? (runMessages.length > 0 ? Math.max(...runMessages.map((m) => m.createdAt)) : null)
            ?? (Date.now() - (olderRuns.length - i) * 60000);

          s.addCompletedRun({
            id: crypto.randomUUID(),
            topic: r.settings?.topic ?? data.chatTitle ?? `Run ${i + 1}`,
            settings: r.settings ?? {
              topic: "",
              maxPapers: 50,
              topK: 5,
              weightRelevance: 0.5,
              weightCitation: 0.3,
              weightRecency: 0.2,
            },
            papers: r.papers,
            reportMarkdown: r.reportMarkdown,
            runId: r.runId,
            events: r.events,
            completedAt,
          });
        }

        // Restore active (latest) run state
        s.setCurrentRunId(latestRun.runId);
        if (latestRun.papers?.length) {
          s.setPapers(latestRun.papers);
          // If there's a report, show it; otherwise stay at "ranked" so the
          // Generate Report button is available.
          if (latestRun.reportMarkdown) {
            s.appendReportMarkdown(latestRun.reportMarkdown);
            s.setStep("report_ready", "Report loaded.");
          } else {
            // Explicitly set ranked so the pipeline rail shows correctly
            s.setStep("ranked", "Papers loaded — ready to generate report.");
          }
        } else if (latestRun.reportMarkdown) {
          // Edge case: report exists but papers weren't saved (old bug)
          s.appendReportMarkdown(latestRun.reportMarkdown);
          s.setStep("report_ready", "Report loaded.");
        }
        // Restore pipeline events from DB — add them after step is set so they
        // appear in the activity log without overriding the step state.
        if (latestRun.events?.length) {
          latestRun.events.forEach((ev) => s.addEvent(ev.step as never, ev.message));
        } else if (latestRun.papers?.length) {
          // No events saved (run predates server-side metadata persistence) —
          // synthesize minimal events so the activity log isn't empty.
          s.addEvent("ranked", `Restored ${latestRun.papers.length} ranked papers from database.`);
        }
        // Restore settings: DB is authoritative, localStorage is fallback
        if (latestRun.settings) {
          s.setSettings(latestRun.settings);
        } else {
          const cached = loadCache(chatId);
          if (cached.settings) s.setSettings(cached.settings);
        }

      } catch (err) {
        console.error("Failed to load history:", err);
      } finally {
        // Only update state if the component is still mounted and this chatId
        // is still the active one. Without this guard, a rapid chat switch can
        // set loadedChatId to a stale value after the new chat's history loads.
        if (isMounted) {
          const s2 = useResearchStore.getState();
          s2.setIsLoadingHistory(false);
          // Mark which chatId is now loaded so components can detect stale state
          s2.setLoadedChatId(chatId);
        }
      }
    }

    if (chatId) void loadHistory();
    return () => { isMounted = false; };
  }, [chatId]);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function runResearch(settings: ResearchSettings, excludeTitles?: string[]) {
    store.archiveAndReset();
    store.setStep("fetching", "Preparing research run…");

    if (settings.topic.trim()) {
      const raw = settings.topic.trim();
      const title = raw.length > 60 ? raw.slice(0, 57).trimEnd() + "…" : raw;
      store.setChatTitle(title);
      void fetch(`/api/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    }

    const response = await fetch("/api/pipeline/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, settings, excludeTitles: excludeTitles ?? [] }),
    });

    if (!response.ok) {
      store.setStep("error", `Request failed: ${response.statusText}`);
      return;
    }

    await readSseResponse(response, (message) => {
      if (message.event === "step") store.setStep(message.data.step as never, message.data.message);
      if (message.event === "pass1_papers") store.setPass1Papers(message.data);
      if (message.event === "papers") {
        store.setPapers(message.data);
        store.addEvent("ranked", `Ranked ${message.data.length} papers by composite score.`);
      }
      if (message.event === "done") store.setCurrentRunId(message.data.runId ?? null);
      if (message.event === "error") store.setStep("error", message.data.message);
    });

    // The server already persisted run_metadata (settings + events) during the
    // pipeline run. The client-side call here is kept only to update the event
    // list with any additional events that were added after the server saved
    // (e.g. the "ranked" event added by the papers handler below).
    // It is fire-and-forget and non-critical — the run is already recoverable.
    const finalState = useResearchStore.getState();
    const savedRunId = finalState.currentRunId;
    if (savedRunId) {
      void fetch("/api/pipeline/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: savedRunId,
          chatId,
          settings,
          events: finalState.events,
        }),
      });
    }
  }

  async function generateReport(runId: string, customIndices?: number[]) {
    let activeRunId = runId;
    let papers = store.papers.slice(0, store.settings.topK);
    const isCustomRun = customIndices && customIndices.length > 0;

    if (isCustomRun) {
      papers = store.papers.filter((_, i) => customIndices.includes(i));
      activeRunId = crypto.randomUUID();
      store.archiveAndKeepPapers();
      store.setCurrentRunId(activeRunId);
    } else {
      store.clearReport();
    }
    
    store.setStep("generating_report", "Generating grounded report with Gemini…");

    const response = await fetch("/api/pipeline/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        runId: activeRunId, 
        chatId, 
        topic: store.settings.topic, 
        papers,
        isCustomRun,
        allPapers: isCustomRun ? store.papers : undefined,
        settings: isCustomRun ? store.settings : undefined,
        events: isCustomRun ? store.events : undefined,
      }),
    });
    if (!response.ok) { store.setStep("error", `Report request failed: ${response.statusText}`); return; }
    await readSseResponse(response, (message) => {
      if (message.event === "reset") {
        store.clearReport();
      }
      if (message.event === "report") store.appendReportMarkdown(message.data.chunk);
      if (message.event === "done") {
        store.setStep("report_ready", "Report ready.");
        store.addEvent("report_ready", "Report saved and ready for download.");

        // Capture the final state and add the report as a chronological message
        const { reportMarkdown, messages, papers, settings } = useResearchStore.getState();
        const nextIndex = (messages.at(-1)?.index ?? 0) + 1;
        const reportMsg = {
          id: crypto.randomUUID(),
          question: isCustomRun
            ? `Custom report for ${customIndices!.map(i => i + 1).join(", ")} papers`
            : `Research report · ${settings.topic}`,
          answer: reportMarkdown,
          index: nextIndex,
          type: "report" as const,
          createdAt: Date.now(),
          runId: activeRunId,
          reportPapers: papers.filter((_, i) => isCustomRun ? customIndices!.includes(i) : i < settings.topK),
          reportTopK: settings.topK,
        };
        useResearchStore.getState().addMessage(reportMsg);

        // Persist report as a message entry
        void fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId,
            runId: activeRunId,
            question: reportMsg.question,
            answer: reportMsg.answer,
            questionIndex: nextIndex,
            type: "report",
          }),
        });

        // Update metadata with final event list (includes report_ready)
        const { events, settings: s2 } = useResearchStore.getState();
        void fetch("/api/pipeline/metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: activeRunId, chatId, settings: s2, events }),
        });
      }
      if (message.event === "error") store.setStep("error", message.data.message);
    });
  }

  async function generateComparison(reportAIndex: number, reportBIndex: number): Promise<string> {
    let text = "";
    store.setStep("generating_report", `Comparing Report ${reportAIndex} vs ${reportBIndex}…`);
    const response = await fetch("/api/pipeline/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, reportAIndex, reportBIndex }),
    });
    if (!response.ok) { store.setStep("error", "Comparison failed."); throw new Error("Comparison failed"); }
    await readSseResponse(response, (message) => {
      if (message.event === "reset") {
        text = "";
      }
      if (message.event === "report") text += message.data.chunk;
      if (message.event === "done") store.setStep("report_ready", "Comparison ready.");
      if (message.event === "error") store.setStep("error", message.data.message);
    });
    return text;
  }

  return { ...store, loadedChatId: store.loadedChatId, runResearch, generateReport, generateComparison };
}
