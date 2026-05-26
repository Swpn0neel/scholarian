"use client";

import { useCallback, useState, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { ArrowDown } from "lucide-react";
import { CompletedRunCard } from "@/components/dashboard/CompletedRunCard";
import { FeedbackInput } from "@/components/dashboard/FeedbackInput";
import { Pass1RankingTable } from "@/components/dashboard/Pass1RankingTable";
import { PipelineProgress } from "@/components/dashboard/PipelineProgress";
import { QAThread } from "@/components/dashboard/QAThread";
import { RankedPapersTable } from "@/components/dashboard/RankedPapersTable";
import { ReportViewer } from "@/components/dashboard/ReportViewer";
import { ResearchSettingsPanel } from "@/components/dashboard/ResearchSettingsPanel";
import { usePipeline } from "@/hooks/usePipeline";
import { DashboardErrorBoundary } from "@/components/dashboard/ErrorBoundary";

function ChatLoadingState() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-9 w-72 rounded-lg bg-secondary/10" />
          <div className="h-4 w-48 rounded bg-secondary/8" />
        </div>
      </div>

      {/* Research Settings panel skeleton — mirrors ResearchSettingsPanel exactly */}
      <div className="rounded-2xl border border-secondary/10 bg-white p-5 shadow-ambient space-y-4">
        {/* Header row: title + subtitle + icon */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="h-6 w-44 rounded bg-secondary/10" />
            <div className="h-4 w-72 rounded bg-secondary/8" />
          </div>
          <div className="size-5 rounded bg-secondary/8 shrink-0 mt-0.5" />
        </div>

        {/* Topic label + textarea */}
        <div className="space-y-2">
          <div className="h-3 w-12 rounded bg-secondary/10" />
          <div className="h-28 w-full rounded-lg bg-secondary/8" />
        </div>

        {/* 2-col: Max Papers + Top K steppers */}
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 rounded-lg bg-secondary/8" />
          <div className="h-16 rounded-lg bg-secondary/8" />
        </div>

        {/* 3-col: Relevance, Citation, Recency weight inputs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="h-16 rounded-lg bg-secondary/8" />
          <div className="h-16 rounded-lg bg-secondary/8" />
          <div className="h-16 rounded-lg bg-secondary/8" />
        </div>

        {/* Footer: weight sum label + Run Research button */}
        <div className="flex items-center justify-between border-t border-secondary/10 pt-4">
          <div className="h-3.5 w-32 rounded bg-secondary/8" />
          <div className="h-10 w-32 rounded-lg bg-secondary/10" />
        </div>
      </div>

      {/* Research Pipeline panel skeleton — mirrors PipelineProgress exactly */}
      <div className="overflow-hidden rounded-2xl border border-secondary/10 bg-white shadow-ambient">
        {/* Header bar: dot + title + status badge */}
        <div className="flex items-center justify-between border-b border-secondary/10 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="size-2.5 rounded-full bg-secondary/10" />
            <div className="h-4 w-36 rounded bg-secondary/10" />
          </div>
          <div className="h-5 w-16 rounded-full bg-secondary/10" />
        </div>

        {/* Stage rail: 6 cells each with icon circle + label + sublabel */}
        <div className="border-b border-secondary/10 px-5 py-4">
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 px-2 py-3">
                {/* Icon circle */}
                <div className="size-16 rounded-full bg-secondary/8" />
                {/* Label */}
                <div className="h-3.5 w-10 rounded bg-secondary/10" />
                {/* Sublabel */}
                <div className="h-3 w-14 rounded bg-secondary/8" />
              </div>
            ))}
          </div>
        </div>

        {/* Activity log skeleton — a few log line placeholders */}
        <div className="px-5 py-3 space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="size-3 rounded-full bg-secondary/8 shrink-0" />
              <div className="h-3 w-20 rounded bg-secondary/8 shrink-0" />
              <div className="h-3 rounded bg-secondary/8" style={{ width: `${55 + i * 8}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatWorkspace({ chatId }: { chatId: string }) {
  const pipeline = usePipeline(chatId);
  const [refineKey, setRefineKey] = useState(0);

  // Use a ref to hold the latest runResearch so handleRefine doesn't need
  // pipeline in its dependency array (pipeline is a new object every render).
  const runResearchRef = useRef(pipeline.runResearch);
  runResearchRef.current = pipeline.runResearch;
  const settingsRef = useRef(pipeline.settings);
  settingsRef.current = pipeline.settings;

  const handleRefine = useCallback(
    (refinedTopic: string, excludeTitles: string[]) => {
      void runResearchRef.current({ ...settingsRef.current, topic: refinedTopic }, excludeTitles);
      setRefineKey((k) => k + 1);
    },
    [] // stable — reads latest values via refs
  );

  // ── Scroll-to-bottom tracking ─────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // "at bottom" = within 60px of the bottom edge
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  }, []);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  // Group messages by runId for easy rendering
  const { messages } = pipeline;
  const messagesByRunId = useMemo(() => {
    const map = new Map<string, typeof messages>();
    for (const msg of messages) {
      if (msg.runId) {
        if (!map.has(msg.runId)) map.set(msg.runId, []);
        map.get(msg.runId)!.push(msg);
      }
    }
    return map;
  }, [messages]);

  // Show skeleton immediately if the store hasn't loaded data for this chatId yet.
  // This fires on the FIRST render (before any useEffect), so stale data from the
  // previous chat never bleeds through for even a single frame.
  const isStale = pipeline.loadedChatId !== chatId;
  if (isStale || pipeline.isLoadingHistory) return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 pb-6 space-y-5">
          <ChatLoadingState />
        </div>
      </div>
    </div>
  );

  const DEFAULT_TITLES = new Set(["new research chat", "untitled research chat"]);
  const displayTitle =
    pipeline.chatTitle && !DEFAULT_TITLES.has(pipeline.chatTitle.toLowerCase())
      ? pipeline.chatTitle
      : null;

  const hasActiveReport =
    Boolean(pipeline.reportMarkdown) || pipeline.step === "generating_report";
  const isFinalized = pipeline.step === "finalized";
  const reportCount = pipeline.completedRuns.filter((r) => r.reportMarkdown).length
    + (pipeline.reportMarkdown ? 1 : 0);

  return (
    <div className="flex flex-col h-full">
      {/* ── Scrollable content area ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 pb-6 space-y-5">
          {/* ── Header ── */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1
                className="font-heading text-3xl font-semibold text-on-surface truncate transition-all duration-300"
                title={displayTitle ?? "Research Workspace"}
              >
                {displayTitle ?? "Research Workspace"}
              </h1>
              <p className="mt-1 text-sm text-secondary">
                {displayTitle ? "Fetch, rank, synthesize, refine." : "Enter a topic below to start."}
              </p>
            </div>
          </div>

          {/* ── Settings panel ── */}
          <ResearchSettingsPanel
            settings={pipeline.settings}
            disabled={pipeline.isRunning}
            onChange={(partial) => pipeline.setSettings(partial)}
            onRun={() => void pipeline.runResearch(pipeline.settings)}
          />

          {/* ── Completed Runs Timeline ── */}
          {pipeline.completedRuns.length > 0 && (
            <div className="space-y-6">
              {pipeline.completedRuns.map((run, i) => {
                let runMsgs = messagesByRunId.get(run.runId!) ?? [];

                // Backward compatibility: Synthesize report message if run has report but no report message
                if (run.reportMarkdown && !runMsgs.some(m => m.type === "report" && m.answer === run.reportMarkdown)) {
                  runMsgs = [
                    ...runMsgs,
                    {
                      id: `synth-${run.id}`,
                      type: "report" as const,
                      question: `Research report · ${run.topic}`,
                      answer: run.reportMarkdown,
                      index: 0,
                      createdAt: run.completedAt + 1,
                      runId: run.runId,
                      reportPapers: run.papers.slice(0, run.settings.topK),
                      reportTopK: run.settings.topK
                    }
                  ].sort((a, b) => a.createdAt - b.createdAt);
                }

                return (
                  <div key={run.id} className="space-y-6">
                    <div className="space-y-3">
                      <CompletedRunCard run={run} index={i + 1} />
                      {runMsgs.length > 0 && (
                        <QAThread messages={runMsgs} reportCount={reportCount} />
                      )}
                      {/* Connector between runs */}
                      <div className="flex items-center gap-3 px-4 pt-3">
                        <div className="h-6 w-px bg-linear-to-b from-secondary/20 to-primary/30 ml-4" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-primary/50">
                          Refined →
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Active Run ── */}
          <div className="space-y-6">
            {/* Active run label */}
            {pipeline.completedRuns.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <div className="flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  {pipeline.completedRuns.length + 1}
                </div>
                <span className="text-xs font-semibold text-primary">
                  Current Run · {pipeline.settings.topic || "New research"}
                </span>
              </div>
            )}

            <PipelineProgress
              key={refineKey}
              step={pipeline.step}
              events={pipeline.events}
              isRunning={pipeline.isRunning}
            />

            {/* ── Transparent: Pass 1 intermediate ranking table ── */}
            {/* Persists alongside the final table so the user can compare Pass 1
                vs Pass 2 rankings. Cleared only when a new run starts. */}
            {pipeline.pass1Papers.length > 0 && (
              <Pass1RankingTable
                papers={pipeline.pass1Papers}
                qualityThresholdPct={40}
                isComplete={pipeline.step !== "scoring"}
              />
            )}

            <RankedPapersTable
              papers={pipeline.papers}
              topK={Math.min(pipeline.settings.topK, pipeline.papers.length)}
              canGenerate={Boolean(pipeline.currentRunId) && !pipeline.isRunning}
              onGenerateReport={() =>
                pipeline.currentRunId
                  ? void pipeline.generateReport(pipeline.currentRunId)
                  : undefined
              }
            />

            {/* Streaming report */}
            {pipeline.step === "generating_report" && (
              <ReportViewer
                markdown={pipeline.reportMarkdown}
                papers={pipeline.papers}
                topK={pipeline.settings.topK}
                isGenerating={true}
              />
            )}

            {/* Active run messages (includes report messages once generation completes) */}
            {pipeline.currentRunId && (() => {
              let activeRunMsgs = messagesByRunId.get(pipeline.currentRunId) ?? [];

              const hasReportMsg = activeRunMsgs.some(
                (m) => m.type === "report" && m.answer === pipeline.reportMarkdown
              );
              if (
                pipeline.reportMarkdown &&
                pipeline.step === "report_ready" &&
                !hasReportMsg
              ) {
                activeRunMsgs = [
                  ...activeRunMsgs,
                  {
                    id: `synth-active-${pipeline.currentRunId}`,
                    type: "report" as const,
                    question: `Research report · ${pipeline.settings.topic}`,
                    answer: pipeline.reportMarkdown,
                    index: (activeRunMsgs.at(-1)?.index ?? 0) + 1,
                    createdAt: Date.now(),
                    runId: pipeline.currentRunId,
                    reportPapers: pipeline.papers.slice(0, pipeline.settings.topK),
                    reportTopK: pipeline.settings.topK,
                  },
                ].sort((a, b) => a.createdAt - b.createdAt);
              }

              if (!activeRunMsgs.length) return null;
              return <QAThread messages={activeRunMsgs} reportCount={reportCount} />;
            })()}
          </div>
        </div>
      </div>

      {/* ── Sticky bottom chat bar ── */}
      {(hasActiveReport || pipeline.papers.length > 0) && (
        <div className="relative shrink-0">
          {/* Scroll-to-bottom arrow — floats above the bar when not at bottom */}
          <div
            className={`absolute -top-14 left-1/2 -translate-x-1/2 z-10 transition-all duration-300 ${isAtBottom ? "opacity-0 pointer-events-none translate-y-2" : "opacity-100 translate-y-0"
              }`}
          >
            <button
              onClick={scrollToBottom}
              aria-label="Scroll to bottom"
              className="flex size-9 items-center justify-center rounded-full border border-secondary/15 bg-white text-secondary shadow-md hover:shadow-lg hover:text-primary hover:border-primary/20 transition-all"
            >
              <ArrowDown className="size-4" />
            </button>
          </div>

          {/* Bar — free-floating, shadow fades in when scrolled up */}
          <div
            className={`bg-surface/80 backdrop-blur-md transition-all duration-300 ${!isAtBottom ? "shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.07)]" : ""
              }`}
          >
            <div className="mx-auto max-w-4xl px-4 py-4 md:px-8">
              <FeedbackInput
                chatId={chatId}
                disabled={isFinalized}
                onRefineRequest={handleRefine}
                onCustomReportRequest={(indices) => {
                  if (pipeline.currentRunId) {
                    void pipeline.generateReport(pipeline.currentRunId, indices);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatWorkspacePage() {
  const params = useParams();
  const chatId = params?.chatId as string | undefined;

  if (!chatId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h2 className="text-xl font-semibold text-on-surface mb-2">No Chat Selected</h2>
        <p className="text-secondary">Select or create a chat to begin your research.</p>
      </div>
    );
  }

  return (
    <DashboardErrorBoundary>
      <ChatWorkspace chatId={chatId} />
    </DashboardErrorBoundary>
  );
}