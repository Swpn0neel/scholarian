"use client";

import { memo, useState } from "react";
import { Archive, FileText, Trophy, ChevronDown } from "lucide-react";
import type { CompletedRun } from "@/hooks/useResearchStore";
import { RankedPapersTable } from "./RankedPapersTable";
import { ReportViewer } from "./ReportViewer";
import { PipelineProgress } from "./PipelineProgress";
import type { PipelineStep } from "@/types";

interface Props {
  run: CompletedRun;
  index: number; // 1-based run number
}

import { cn } from "@/lib/utils";

export const CompletedRunCard = memo(function CompletedRunCard({ run, index }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const paperCount = run.papers.length;
  const hasReport = Boolean(run.reportMarkdown);

  const date = new Date(run.completedAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Build a fake "complete" step and events for PipelineProgress
  // so the pipeline rail shows as fully done for this archived run
  const displayStep: PipelineStep = hasReport ? "report_ready" : "ranked";
  const displayEvents = run.events.length > 0
    ? run.events
    : [
        { step: "fetching" as PipelineStep, message: `Fetched ${paperCount} papers.`, ts: run.completedAt - 4000 },
        { step: "ranked" as PipelineStep, message: `Ranked ${paperCount} papers by composite score.`, ts: run.completedAt - 1000 },
        ...(hasReport ? [{ step: "report_ready" as PipelineStep, message: "Report saved.", ts: run.completedAt }] : []),
      ];

  return (
    <div className="overflow-hidden rounded-2xl border border-secondary/15 shadow-[0_16px_48px_-12px_rgba(0,49,120,0.12)]">
      {/* ── Run header ── */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 border-b border-white/8 transition-colors hover:brightness-110 cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        style={{ background: "linear-gradient(135deg, #001228 0%, #002055 100%)" }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-transform"
            style={{ background: "rgba(112,216,200,0.15)", color: "#70d8c8" }}
          >
            {index}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Archive className="size-3.5 text-white/35 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                Research Run {index}
              </span>
              <span className="text-[10px] text-white/20">·</span>
              <span className="text-[10px] text-white/20">{date}</span>
            </div>
            <p className="mt-0.5 text-base font-semibold text-white truncate" title={run.topic}>
              {run.topic}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {paperCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/60">
                <Trophy className="size-3" />
                {paperCount} papers
              </span>
            )}
            {hasReport && (
              <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: "rgba(112,216,200,0.15)", color: "#70d8c8" }}>
                <FileText className="size-3" />
                Report
              </span>
            )}
          </div>
          
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white">
            <ChevronDown className={cn("size-5 transition-transform duration-300", isExpanded && "rotate-180")} />
          </div>
        </div>
      </button>

      {/* ── Body: Pipeline → Papers → Report stacked ── */}
      {isExpanded && (
        <div className="divide-y divide-secondary/8 bg-white animate-in slide-in-from-top-1 fade-in duration-200">
        {/* Pipeline progress (always shown, in "complete" state) */}
        <div className="px-1 py-1">
          <PipelineProgress
            step={displayStep}
            events={displayEvents}
            isRunning={false}
          />
        </div>

        {/* Ranked papers — highlight exactly the topK used for this run's report */}
        {paperCount > 0 && (
          <div className="p-4">
            <RankedPapersTable
              papers={run.papers}
              topK={Math.min(run.settings?.topK ?? 5, paperCount)}
              maxPapers={run.settings?.maxPapers ?? paperCount}
              canGenerate={false}
            />
          </div>
        )}

        {/* The Generated Report */}
        {hasReport && (
          <div className="p-4 bg-surface/30">
            <ReportViewer
              markdown={run.reportMarkdown}
              papers={run.papers.slice(0, run.settings?.topK ?? 5)}
              topK={Math.min(run.settings?.topK ?? 5, paperCount)}
            />
          </div>
        )}

        </div>
      )}
    </div>
  );
});
