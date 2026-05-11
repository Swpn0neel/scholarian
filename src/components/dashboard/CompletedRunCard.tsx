"use client";

import { Archive, FileText, Trophy } from "lucide-react";
import type { CompletedRun } from "@/hooks/useResearchStore";
import { ReportViewer } from "./ReportViewer";
import { RankedPapersTable } from "./RankedPapersTable";
import { PipelineProgress } from "./PipelineProgress";
import type { PipelineStep } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  run: CompletedRun;
  index: number; // 1-based run number
}

export function CompletedRunCard({ run, index }: Props) {
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
        { step: "enriching" as PipelineStep, message: "Query enriched.", ts: run.completedAt - 5000 },
        { step: "fetching" as PipelineStep, message: `Fetched ${paperCount} papers.`, ts: run.completedAt - 4000 },
        { step: "ranked" as PipelineStep, message: `Ranked ${paperCount} papers by composite score.`, ts: run.completedAt - 1000 },
        ...(hasReport ? [{ step: "report_ready" as PipelineStep, message: "Report saved.", ts: run.completedAt }] : []),
      ];

  return (
    <div className="overflow-hidden rounded-xl border border-secondary/15 shadow-ambient">
      {/* ── Run header ── */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-surface-container to-surface-container-low px-5 py-4 border-b border-secondary/10">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {index}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Archive className="size-3.5 text-secondary/60 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary/60">
              Research Run {index}
            </span>
            <span className="text-[10px] text-secondary/40">·</span>
            <span className="text-[10px] text-secondary/40">{date}</span>
          </div>
          <p className="mt-0.5 text-base font-semibold text-on-surface truncate" title={run.topic}>
            {run.topic}
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {paperCount > 0 && (
            <span className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold",
              "bg-primary/8 text-primary"
            )}>
              <Trophy className="size-3" />
              {paperCount} papers
            </span>
          )}
          {hasReport && (
            <span className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold",
              "bg-tertiary-fixed-dim/20 text-tertiary"
            )}>
              <FileText className="size-3" />
              Report
            </span>
          )}
        </div>
      </div>

      {/* ── Body: Pipeline → Papers → Report stacked ── */}
      <div className="divide-y divide-secondary/8 bg-white">
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
              canGenerate={false}
            />
          </div>
        )}

        {/* Report */}
        {hasReport && (
          <div className="p-4">
            <ReportViewer
              markdown={run.reportMarkdown}
              papers={run.papers}
              topK={run.settings?.topK ?? 5}
              isGenerating={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
