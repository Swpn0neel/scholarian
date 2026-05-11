"use client";

import { useEffect, useRef } from "react";
import type { PipelineStep, RankedPaper, ResearchSettings } from "@/types";
import { useResearchStore, type QAMessage, type CompletedRun } from "./useResearchStore";

type StreamEvent =
  | { event: "step"; data: { step: string; message: string } }
  | { event: "papers"; data: RankedPaper[] }
  | { event: "report"; data: { chunk: string } }
  | { event: "done"; data: { runId?: string; reportId?: string; content?: string } }
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
      store.resetAll();
      // Restore settings from cache immediately (snappy UX before server responds)
      const cached = loadCache(chatId);
      if (cached.settings) store.setSettings(cached.settings);
    }
    prevChatId.current = chatId;

    async function loadHistory() {
      store.setIsLoadingHistory(true);
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
          }>;
          messages?: QAMessage[];
        };
        if (!isMounted) return;

        if (data.chatTitle) store.setChatTitle(data.chatTitle);
        if (data.messages?.length) store.setMessages(data.messages);

        const allRuns = data.runs ?? [];
        if (allRuns.length === 0) return;

        // Server is authoritative — full reset, then re-populate
        store.resetAll();
        if (data.chatTitle) store.setChatTitle(data.chatTitle);
        if (data.messages?.length) store.setMessages(data.messages);

        const olderRuns = allRuns.slice(0, -1);
        const latestRun = allRuns[allRuns.length - 1]!;

        // Restore all previous (completed) runs
        for (let i = 0; i < olderRuns.length; i++) {
          const r = olderRuns[i]!;
          store.addCompletedRun({
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
            completedAt: Date.now() - (olderRuns.length - i) * 60000,
          });
        }

        // Restore active (latest) run state
        store.setCurrentRunId(latestRun.runId);
        if (latestRun.papers?.length) {
          store.setPapers(latestRun.papers);
          store.setStep("ranked", "History loaded.");
        }
        if (latestRun.reportMarkdown) {
          store.appendReportMarkdown(latestRun.reportMarkdown);
          store.setStep("report_ready", "Report loaded.");
        }
        // Restore pipeline events from DB
        if (latestRun.events?.length) {
          latestRun.events.forEach((ev) => store.addEvent(ev.step as never, ev.message));
        }
        // Restore settings: DB is authoritative, localStorage is fallback
        if (latestRun.settings) {
          store.setSettings(latestRun.settings);
        } else {
          const cached = loadCache(chatId);
          if (cached.settings) store.setSettings(cached.settings);
        }

      } catch (err) {
        console.error("Failed to load history:", err);
      } finally {
        store.setIsLoadingHistory(false);
      }
    }

    if (chatId) void loadHistory();
    return () => { isMounted = false; };
  }, [chatId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────────────────

  async function runResearch(settings: ResearchSettings, excludeTitles?: string[]) {
    store.archiveAndReset();
    store.setStep("enriching", "Preparing research run…");

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
      if (message.event === "papers") {
        store.setPapers(message.data);
        store.addEvent("ranked", `Ranked ${message.data.length} papers by composite score.`);
      }
      if (message.event === "done") store.setCurrentRunId(message.data.runId ?? null);
      if (message.event === "error") store.setStep("error", message.data.message);
    });

    // Persist settings + events to DB so they survive page reloads.
    // Use getState() to capture the events that were added during streaming.
    const { currentRunId, events } = useResearchStore.getState();
    if (currentRunId) {
      void fetch("/api/pipeline/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: currentRunId,
          chatId,
          settings,
          events,
        }),
      });
    }
  }

  async function generateReport(runId: string) {
    store.setStep("generating_report", "Generating grounded report with Gemini…");
    const papers = store.papers.slice(0, store.settings.topK);
    const response = await fetch("/api/pipeline/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId, chatId, topic: store.settings.topic, papers }),
    });
    if (!response.ok) { store.setStep("error", `Report request failed: ${response.statusText}`); return; }
    await readSseResponse(response, (message) => {
      if (message.event === "report") store.appendReportMarkdown(message.data.chunk);
      if (message.event === "done") {
        store.setStep("report_ready", "Report ready.");
        store.addEvent("report_ready", "Report saved and ready for download.");
        // Update metadata with final event list (includes report_ready)
        const { events, settings } = useResearchStore.getState();
        void fetch("/api/pipeline/metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId, chatId, settings, events }),
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
      if (message.event === "report") text += message.data.chunk;
      if (message.event === "done") store.setStep("report_ready", "Comparison ready.");
      if (message.event === "error") store.setStep("error", message.data.message);
    });
    return text;
  }

  return { ...store, runResearch, generateReport, generateComparison };
}
