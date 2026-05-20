"use client";

import { useCallback, useState, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { CompletedRunCard } from "@/components/dashboard/CompletedRunCard";
import { FeedbackInput } from "@/components/dashboard/FeedbackInput";
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
          <div className="h-8 w-64 rounded-lg bg-secondary/10" />
          <div className="h-4 w-40 rounded bg-secondary/8" />
        </div>
      </div>

      {/* Settings panel skeleton */}
      <div className="rounded-lg border border-secondary/10 bg-white p-5 shadow-ambient space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-44 rounded bg-secondary/10" />
            <div className="h-4 w-64 rounded bg-secondary/8" />
          </div>
          <div className="size-5 rounded bg-secondary/8" />
        </div>
        <div className="h-28 w-full rounded-lg bg-secondary/8" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 rounded-lg bg-secondary/8" />
          <div className="h-16 rounded-lg bg-secondary/8" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="h-14 rounded-lg bg-secondary/8" />
          <div className="h-14 rounded-lg bg-secondary/8" />
          <div className="h-14 rounded-lg bg-secondary/8" />
        </div>
      </div>

      {/* Pipeline rail skeleton */}
      <div className="rounded-lg border border-secondary/10 bg-white p-4 shadow-ambient">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-secondary/8" />
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
  if (isStale || pipeline.isLoadingHistory) return <ChatLoadingState />;

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
    <div className="space-y-5">
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
                    <div className="h-6 w-px bg-gradient-to-b from-secondary/20 to-primary/30 ml-4" />
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
      <div className="space-y-6 mt-6">
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

          // If the report is done but not yet in messagesByRunId (e.g. first render after
          // streaming finishes, or after history hydration with missing reportPapers),
          // synthesize a report message inline so it's never invisible.
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

        {/* ── Feedback / chat input ── */}
        {(hasActiveReport || pipeline.papers.length > 0) && (
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
        )}
      </div>
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