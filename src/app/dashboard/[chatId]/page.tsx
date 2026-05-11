"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { CompletedRunCard } from "@/components/dashboard/CompletedRunCard";
import { FeedbackInput } from "@/components/dashboard/FeedbackInput";
import { PipelineProgress } from "@/components/dashboard/PipelineProgress";
import { QAThread } from "@/components/dashboard/QAThread";
import { RankedPapersTable } from "@/components/dashboard/RankedPapersTable";
import { ReportViewer } from "@/components/dashboard/ReportViewer";
import { ResearchSettingsPanel } from "@/components/dashboard/ResearchSettingsPanel";
import { usePipeline } from "@/hooks/usePipeline";

function ChatLoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Loading Chat</h2>
          <p className="text-sm text-secondary mt-1">Fetching your research data...</p>
        </div>
      </div>
    </div>
  );
}

function ChatWorkspace({ chatId }: { chatId: string }) {
  const pipeline = usePipeline(chatId);
  const [refineKey, setRefineKey] = useState(0);

  const handleRefine = useCallback(
    (refinedTopic: string, excludeTitles: string[]) => {
      void pipeline.runResearch({ ...pipeline.settings, topic: refinedTopic }, excludeTitles);
      setRefineKey((k) => k + 1);
    },
    [pipeline]
  );

  if (pipeline.isLoadingHistory) return <ChatLoadingState />;

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

      {/* ── Completed runs — each refinement iteration stacks fully visible ── */}
      {pipeline.completedRuns.length > 0 && (
        <div className="space-y-3">
          {pipeline.completedRuns.map((run, i) => (
            <div key={run.id} className="space-y-3">
              <CompletedRunCard run={run} index={i + 1} />
              {/* Connector between runs */}
              <div className="flex items-center gap-3 px-4">
                <div className="h-6 w-px bg-gradient-to-b from-secondary/20 to-primary/30 ml-4" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-primary/50">
                  Refined →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active run label when there are previous runs */}
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


      {/* ── Active pipeline ── */}
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

      <ReportViewer
        markdown={pipeline.reportMarkdown}
        papers={pipeline.papers}
        topK={pipeline.settings.topK}
        isGenerating={pipeline.step === "generating_report"}
      />

      {/* ── Q&A conversation thread ── */}
      {pipeline.messages.length > 0 && (
        <QAThread messages={pipeline.messages} reportCount={reportCount} />
      )}

      {/* ── Feedback / chat input ── */}
      {hasActiveReport && (
        <FeedbackInput
          chatId={chatId}
          disabled={isFinalized}
          onRefineRequest={handleRefine}
        />
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

  return <ChatWorkspace chatId={chatId} />;
}