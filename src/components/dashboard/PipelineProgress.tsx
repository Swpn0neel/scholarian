"use client";

import { useEffect, useRef } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  Braces,
  Search,
  Layers,
  Cpu,
  BarChart2,
  Trophy,
  FileText,
  ChevronRight,
} from "lucide-react";
import type { PipelineStep } from "@/types";
import { cn } from "@/lib/utils";

// ─── Stage rail definition ────────────────────────────────────────────────────

interface Stage {
  id: PipelineStep;
  label: string;
  sublabel: string;
  Icon: React.ElementType;
}

const STAGES: Stage[] = [
  { id: "enriching",     label: "Enrich",    sublabel: "Query expansion",   Icon: Braces    },
  { id: "fetching",      label: "Fetch",     sublabel: "Multi-source",      Icon: Search    },
  { id: "deduplicating", label: "Dedupe",    sublabel: "Unique papers",     Icon: Layers    },
  { id: "embedding",     label: "Embed",     sublabel: "Semantic vectors",  Icon: Cpu       },
  { id: "scoring",       label: "Score",     sublabel: "Hybrid ranking",    Icon: BarChart2 },
  { id: "ranked",        label: "Rank",      sublabel: "Top-K selected",    Icon: Trophy    },
  { id: "generating_report", label: "Report", sublabel: "AI synthesis",    Icon: FileText  },
];

const RUNNING_STEPS = new Set<PipelineStep>([
  "enriching", "fetching", "deduplicating", "embedding", "scoring",
  "generating_report", "answering",
]);

// Maps pipeline step id → icon for activity log
const STEP_ICON: Record<string, React.ElementType> = {
  enriching:     Braces,
  fetching:      Search,
  deduplicating: Layers,
  embedding:     Cpu,
  scoring:       BarChart2,
  ranked:        Trophy,
  generating_report: FileText,
  report_ready:  FileText,
  error:         XCircle,
};

// ─── Timestamp helper ─────────────────────────────────────────────────────────

function formatTs(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// ─── Elapsed timer ────────────────────────────────────────────────────────────

// ─── Component ────────────────────────────────────────────────────────────────

export interface PipelineProgressProps {
  step: PipelineStep;
  events: Array<{ step: PipelineStep; message: string; ts: number }>;
  isRunning: boolean;
}

export function PipelineProgress({ step, events, isRunning }: PipelineProgressProps) {
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log to bottom as events arrive
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  const activeStageIndex = STAGES.findIndex((s) => s.id === step);
  const isError = step === "error";
  // "ranked" means the fetch/rank pipeline is done but report hasn't started yet.
  // Only treat the pipeline as fully done once the report is also complete.
  const isRankDone = step === "ranked" || step === "generating_report" || step === "report_ready" || step === "finalized";
  const isReportDone = step === "report_ready" || step === "finalized";
  const isReportRunning = step === "generating_report";
  // isDone for the header badge/progress bar: only true once report is ready too

  // Overall status label + colour
  const statusLabel = isError
    ? "Error"
    : isReportDone
    ? "Complete"
    : isReportRunning
    ? "Generating"
    : isRankDone
    ? "Ranked"
    : RUNNING_STEPS.has(step)
    ? "Running"
    : "Ready";

  return (
    <section className="overflow-hidden rounded-xl border border-secondary/10 bg-white shadow-ambient">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-secondary/10 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          {/* Animated pulse dot */}
          <span className="relative flex size-2.5">
            {isRunning && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
            )}
            <span
              className={cn(
                "relative inline-flex size-2.5 rounded-full",
                isError       && "bg-red-500",
                isReportDone  && "bg-tertiary-fixed-dim",
                isReportRunning && "bg-primary",
                isRunning     && "bg-primary",
                !isError && !isReportDone && !isRunning && "bg-secondary/40"
              )}
            />
          </span>
          <h2 className="font-heading text-sm font-semibold text-on-surface">
            Research Pipeline
          </h2>
        </div>

        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]",
            isError        && "bg-red-50 text-red-600",
            isReportDone   && "bg-tertiary-fixed-dim/20 text-tertiary",
            isReportRunning && "bg-primary/10 text-primary",
            isRunning && !isReportRunning && "bg-primary/10 text-primary",
            !isError && !isReportDone && !isRunning && "bg-secondary/10 text-secondary"
          )}
        >
          {statusLabel}
        </span>
      </div>

      {/* ── Stage rail ─────────────────────────────────────────────────── */}
      <div className="relative border-b border-secondary/10 overflow-x-auto">
        <div className="min-w-[540px] px-5 py-4 relative">
          {/* Progress bar underline */}
          <div className="absolute bottom-0 left-0 h-[2px] bg-secondary/8 w-full" />
          {!isError && (
            <div
              className="absolute bottom-0 left-0 h-[2px] bg-primary transition-all duration-700 ease-out"
              style={{
                width: isReportDone
                  ? "100%"
                  : activeStageIndex >= 0
                  ? `${((activeStageIndex + 0.5) / STAGES.length) * 100}%`
                  : "0%",
              }}
            />
          )}

          <div className="grid grid-cols-7 gap-2">
          {STAGES.map((stage, idx) => {
            const isReportStage = stage.id === "generating_report";

            // For the Report stage, use its own independent state
            const isPast = isReportStage
              ? isReportDone
              : isRankDone || (!isError && idx < activeStageIndex);
            const isCurrent = isReportStage
              ? isReportRunning
              : !isError && stage.id === step && RUNNING_STEPS.has(step);
            const Icon = stage.Icon;

            return (
              <div
                key={stage.id}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-center transition-all duration-300",
                  isCurrent && "bg-primary/8",
                  isPast    && "opacity-90",
                  !isCurrent && !isPast && "opacity-40"
                )}
              >
                {/* Icon circle */}
                <div
                  className={cn(
                    "flex size-16 items-center justify-center rounded-full transition-all duration-300",
                    isCurrent && "bg-primary text-white shadow-lg shadow-primary/30",
                    isPast    && "bg-tertiary-fixed-dim/30 text-tertiary",
                    !isCurrent && !isPast && "bg-secondary/10 text-secondary"
                  )}
                >
                  {isCurrent ? (
                    <Loader2 className="size-7 animate-spin" />
                  ) : isPast ? (
                    <CheckCircle2 className="size-7" />
                  ) : (
                    <Icon className="size-7" />
                  )}
                </div>

                {/* Labels */}
                <div>
                  <p
                    className={cn(
                      "text-sm font-bold leading-tight",
                      isCurrent && "text-primary",
                      isPast    && "text-tertiary",
                      !isCurrent && !isPast && "text-secondary"
                    )}
                  >
                    {stage.label}
                  </p>
                  <p className="mt-0.5 text-xs leading-tight text-secondary/70">
                    {stage.sublabel}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </div>

      {/* ── Activity log ───────────────────────────────────────────────── */}
      {events.length > 0 && (
        <div
          ref={logRef}
          className="max-h-52 overflow-y-auto scroll-smooth px-5 py-3 font-mono"
          style={{ scrollbarWidth: "thin" }}
        >
          <div className="space-y-1.5">
            {events.map((ev, i) => {
              const Icon = STEP_ICON[ev.step] ?? Circle;
              const isLast = i === events.length - 1;
              const isEvError = ev.step === "error";

              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2.5 rounded-md px-2 py-1.5 transition-all",
                    isLast && isRunning && "bg-primary/5",
                    isEvError && "bg-red-50"
                  )}
                >
                  {/* Icon */}
                  <span
                    className={cn(
                      "mt-px shrink-0",
                      isEvError      && "text-red-500",
                      ev.step === "ranked" || ev.step === "report_ready"
                        ? "text-tertiary"
                        : !isEvError && "text-primary/60"
                    )}
                  >
                    {isLast && isRunning ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : isEvError ? (
                      <XCircle className="size-3" />
                    ) : (
                      <Icon className="size-3" />
                    )}
                  </span>

                  {/* Timestamp */}
                  <span className="shrink-0 text-[10px] text-secondary/50 tabular-nums mt-[1px]">
                    {ev.ts ? formatTs(ev.ts) : ""}
                  </span>

                  {/* Chevron separator */}
                  <ChevronRight className="mt-[2px] size-2.5 shrink-0 text-secondary/25" />

                  {/* Message */}
                  <span
                    className={cn(
                      "flex-1 text-[11px] leading-relaxed",
                      isEvError ? "text-red-600" : "text-on-surface/80"
                    )}
                  >
                    {ev.message}
                  </span>
                </div>
              );
            })}

            {/* Running tail — blinking cursor */}
            {isRunning && (
              <div className="flex items-center gap-2.5 px-2 py-0.5">
                <span className="size-3 shrink-0" />
                <span className="h-[11px] w-[1px] animate-pulse bg-primary/60" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state while idle (no events yet) */}
      {events.length === 0 && !isRunning && (
        <div className="flex items-center justify-center py-5 text-xs text-secondary/50">
          Pipeline logs will appear here once research starts
        </div>
      )}
    </section>
  );
}