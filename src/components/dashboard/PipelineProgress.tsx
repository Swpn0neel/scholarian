"use client";

import { useEffect, useRef } from "react";
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Search,
  Layers,
  Cpu,
  BarChart2,
  Trophy,
  FileText,
  ChevronRight,
  Filter,
  Globe,
  GitMerge,
  EyeOff,
  AlertTriangle,
  Zap,
  Database,
  RefreshCw,
  Sparkles,
  Binary,
  ScanSearch,
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
  { id: "fetching",          label: "Fetch",   sublabel: "Multi-source",     Icon: Search    },
  { id: "deduplicating",     label: "Dedupe",  sublabel: "Unique papers",    Icon: Layers    },
  { id: "embedding",         label: "Embed",   sublabel: "Semantic vectors", Icon: Cpu       },
  { id: "scoring",           label: "Score",   sublabel: "Quality filter",   Icon: BarChart2 },
  { id: "ranked",            label: "Rank",    sublabel: "Top-K selected",   Icon: Trophy    },
  { id: "generating_report", label: "Report",  sublabel: "AI synthesis",     Icon: FileText  },
];

const RUNNING_STEPS = new Set<PipelineStep>([
  "fetching", "deduplicating", "embedding", "scoring",
  "generating_report", "answering",
]);

// ─── Unified log-line tag system ──────────────────────────────────────────────
//
// Every log line gets a tag config that drives:
//   • the small badge label
//   • the icon shown on the left
//   • badge pill colour  (badgeClass)
//   • icon colour        (iconClass)
//   • message text colour (textClass)
//   • optional row background tint (rowClass)

interface TagConfig {
  label:      string;
  Icon:       React.ElementType;
  badgeClass: string;
  iconClass:  string;
  textClass:  string;
  rowClass?:  string;
}

// ── fetching ──────────────────────────────────────────────────────────────────
function classifyFetching(msg: string): TagConfig {
  const m = msg.toLowerCase();
  if (m.includes("preparing") || m.includes("fetching papers"))
    return {
      label: "QUERY", Icon: Zap,
      badgeClass: "bg-primary/10 text-primary",
      iconClass:  "text-primary/70",
      textClass:  "text-on-surface/80",
      rowClass:   "bg-primary/4",
    };
  if (m.includes("sources returned"))
    return {
      label: "SOURCES", Icon: Globe,
      badgeClass: "bg-emerald-50 text-emerald-700",
      iconClass:  "text-emerald-500",
      textClass:  "text-emerald-800",
      rowClass:   "bg-emerald-50/40",
    };
  if (m.includes("combined") && m.includes("candidates"))
    return {
      label: "MERGED", Icon: GitMerge,
      badgeClass: "bg-indigo-50 text-indigo-600",
      iconClass:  "text-indigo-400",
      textClass:  "text-on-surface/80",
    };
  if (m.includes("excluded") || m.includes("previously-seen"))
    return {
      label: "SKIP", Icon: EyeOff,
      badgeClass: "bg-amber-50 text-amber-600",
      iconClass:  "text-amber-500",
      textClass:  "text-amber-700",
      rowClass:   "bg-amber-50/30",
    };
  if (m.includes("unavailable") || m.includes("⚠"))
    return {
      label: "WARN", Icon: AlertTriangle,
      badgeClass: "bg-red-50 text-red-600",
      iconClass:  "text-red-400",
      textClass:  "text-red-700",
      rowClass:   "bg-red-50/40",
    };
  // default fetching
  return {
    label: "FETCH", Icon: Search,
    badgeClass: "bg-primary/8 text-primary/70",
    iconClass:  "text-primary/60",
    textClass:  "text-on-surface/80",
  };
}

// ── deduplicating ─────────────────────────────────────────────────────────────
function classifyDeduplicating(_msg: string): TagConfig {
  return {
    label: "DEDUP", Icon: Layers,
    badgeClass: "bg-violet-50 text-violet-600",
    iconClass:  "text-violet-400",
    textClass:  "text-violet-700",
    rowClass:   "bg-violet-50/25",
  };
}

// ── embedding ─────────────────────────────────────────────────────────────────
function classifyEmbedding(msg: string): TagConfig {
  const m = msg.toLowerCase();
  if (m.includes("complete") || m.includes("comparing") || m.includes("distances"))
    return {
      label: "VECS", Icon: ScanSearch,
      badgeClass: "bg-cyan-50 text-cyan-700",
      iconClass:  "text-cyan-500",
      textClass:  "text-cyan-800",
      rowClass:   "bg-cyan-50/25",
    };
  return {
    label: "EMBED", Icon: Binary,
    badgeClass: "bg-sky-50 text-sky-600",
    iconClass:  "text-sky-400",
    textClass:  "text-sky-700",
    rowClass:   "bg-sky-50/25",
  };
}

// ── scoring ───────────────────────────────────────────────────────────────────
function classifyScoring(msg: string): TagConfig {
  const m = msg.toLowerCase();
  if (m.includes("pass 1") || m.includes("pass1"))
    return {
      label: "PASS 1", Icon: BarChart2,
      badgeClass: "bg-primary/10 text-primary",
      iconClass:  "text-primary/70",
      textClass:  "text-on-surface/80",
      rowClass:   "bg-primary/5",
    };
  if (m.includes("quality filter"))
    return {
      label: "FILTER", Icon: Filter,
      badgeClass: "bg-amber-50 text-amber-600",
      iconClass:  "text-amber-500",
      textClass:  "text-amber-700",
      rowClass:   "bg-amber-50/40",
    };
  if (m.includes("pass 2") || m.includes("pass2"))
    return {
      label: "PASS 2", Icon: BarChart2,
      badgeClass: "bg-tertiary-fixed-dim/20 text-tertiary",
      iconClass:  "text-tertiary",
      textClass:  "text-tertiary/80",
      rowClass:   "bg-tertiary-fixed-dim/8",
    };
  if (m.includes("fits within") || m.includes("ranked directly"))
    return {
      label: "DIRECT", Icon: BarChart2,
      badgeClass: "bg-secondary/10 text-secondary",
      iconClass:  "text-secondary/60",
      textClass:  "text-on-surface/80",
    };
  if (m.includes("capped at") || m.includes("re-ranking"))
    return {
      label: "CAP", Icon: Filter,
      badgeClass: "bg-primary/8 text-primary/70",
      iconClass:  "text-primary/50",
      textClass:  "text-on-surface/80",
      rowClass:   "bg-primary/4",
    };
  // generic scoring
  return {
    label: "SCORE", Icon: BarChart2,
    badgeClass: "bg-primary/8 text-primary/70",
    iconClass:  "text-primary/60",
    textClass:  "text-on-surface/80",
  };
}

// ── ranked ────────────────────────────────────────────────────────────────────
function classifyRanked(msg: string): TagConfig {
  const m = msg.toLowerCase();
  if (m.includes("saving") || m.includes("database"))
    return {
      label: "SAVE", Icon: Database,
      badgeClass: "bg-secondary/10 text-secondary",
      iconClass:  "text-secondary/60",
      textClass:  "text-on-surface/80",
    };
  if (m.includes("restored"))
    return {
      label: "SYNC", Icon: RefreshCw,
      badgeClass: "bg-violet-50 text-violet-600",
      iconClass:  "text-violet-400",
      textClass:  "text-violet-700",
    };
  // default: ranked result
  return {
    label: "RANKED", Icon: Trophy,
    badgeClass: "bg-tertiary-fixed-dim/20 text-tertiary",
    iconClass:  "text-tertiary",
    textClass:  "text-tertiary/80",
    rowClass:   "bg-tertiary-fixed-dim/6",
  };
}

// ── report_ready ──────────────────────────────────────────────────────────────
function classifyReportReady(_msg: string): TagConfig {
  return {
    label: "READY", Icon: Sparkles,
    badgeClass: "bg-emerald-50 text-emerald-700",
    iconClass:  "text-emerald-500",
    textClass:  "text-emerald-800",
    rowClass:   "bg-emerald-50/30",
  };
}

// ── generating_report ─────────────────────────────────────────────────────────
function classifyGeneratingReport(_msg: string): TagConfig {
  return {
    label: "GEN", Icon: Sparkles,
    badgeClass: "bg-primary/10 text-primary",
    iconClass:  "text-primary/70",
    textClass:  "text-on-surface/80",
    rowClass:   "bg-primary/4",
  };
}

// ── error ─────────────────────────────────────────────────────────────────────
function classifyError(_msg: string): TagConfig {
  return {
    label: "ERROR", Icon: XCircle,
    badgeClass: "bg-red-100 text-red-700",
    iconClass:  "text-red-500",
    textClass:  "text-red-600",
    rowClass:   "bg-red-50",
  };
}

// ── Master classifier ─────────────────────────────────────────────────────────
function classifyLogLine(ev: { step: PipelineStep; message: string }): TagConfig {
  switch (ev.step) {
    case "fetching":          return classifyFetching(ev.message);
    case "deduplicating":     return classifyDeduplicating(ev.message);
    case "embedding":         return classifyEmbedding(ev.message);
    case "scoring":           return classifyScoring(ev.message);
    case "ranked":            return classifyRanked(ev.message);
    case "report_ready":      return classifyReportReady(ev.message);
    case "generating_report": return classifyGeneratingReport(ev.message);
    case "error":             return classifyError(ev.message);
    default:
      return {
        label: ev.step.toUpperCase(), Icon: ChevronRight,
        badgeClass: "bg-secondary/8 text-secondary",
        iconClass:  "text-secondary/50",
        textClass:  "text-on-surface/80",
      };
  }
}

// ─── Live Score-stage sublabel ────────────────────────────────────────────────

function getScoreSublabel(
  events: Array<{ step: PipelineStep; message: string; ts: number }>,
  isActive: boolean,
): string {
  if (!isActive) return "Quality filter";
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (ev.step !== "scoring") continue;
    const m = ev.message.toLowerCase();
    if (m.includes("pass 1"))                                     return "Scoring pool…";
    if (m.includes("quality filter"))                             return "Filtering quality…";
    if (m.includes("capped at") || m.includes("re-ranking"))     return "Capping & re-ranking…";
    if (m.includes("pass 2"))                                     return "Final ranking…";
    if (m.includes("fits within") || m.includes("ranked directly")) return "Direct ranking…";
  }
  return "Quality filter";
}

// ─── Timestamp helper ─────────────────────────────────────────────────────────

function formatTs(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface PipelineProgressProps {
  step:      PipelineStep;
  events:    Array<{ step: PipelineStep; message: string; ts: number }>;
  isRunning: boolean;
}

export function PipelineProgress({ step, events, isRunning }: PipelineProgressProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  const activeStageIndex = STAGES.findIndex((s) => s.id === step);
  const isError        = step === "error";
  const isRankDone     = step === "ranked" || step === "generating_report" || step === "report_ready" || step === "finalized";
  const isReportDone   = step === "report_ready" || step === "finalized";
  const isReportRunning = step === "generating_report";

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
    <section className="overflow-hidden rounded-2xl border border-secondary/10 bg-white shadow-ambient">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-secondary/10 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-2.5">
            {isRunning && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
            )}
            <span
              className={cn(
                "relative inline-flex size-2.5 rounded-full",
                isError         && "bg-red-500",
                isReportDone    && "bg-tertiary-fixed-dim",
                isReportRunning && "bg-primary",
                isRunning       && "bg-primary",
                !isError && !isReportDone && !isRunning && "bg-secondary/40",
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
            isError                          && "bg-red-50 text-red-600",
            isReportDone                     && "bg-tertiary-fixed-dim/20 text-tertiary",
            isReportRunning                  && "bg-primary/10 text-primary",
            isRunning && !isReportRunning    && "bg-primary/10 text-primary",
            !isError && !isReportDone && !isRunning && "bg-secondary/10 text-secondary",
          )}
        >
          {statusLabel}
        </span>
      </div>

      {/* ── Stage rail ─────────────────────────────────────────────────── */}
      <div className="relative border-b border-secondary/10 overflow-x-auto">
        <div className="min-w-[540px] px-5 py-4 relative">
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

          <div className="grid grid-cols-6 gap-2">
            {STAGES.map((stage, idx) => {
              const isReportStage  = stage.id === "generating_report";
              const isScoringStage = stage.id === "scoring";

              const isPast = isReportStage
                ? isReportDone
                : isRankDone || (!isError && idx < activeStageIndex);
              const isCurrent = isReportStage
                ? isReportRunning
                : !isError && stage.id === step && RUNNING_STEPS.has(step);
              const Icon = stage.Icon;

              const sublabel = isScoringStage
                ? getScoreSublabel(events, isCurrent)
                : stage.sublabel;

              return (
                <div
                  key={stage.id}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-center transition-all duration-300",
                    isCurrent && "bg-primary/8",
                    isPast    && "opacity-90",
                    !isCurrent && !isPast && "opacity-40",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-16 items-center justify-center rounded-full transition-all duration-300",
                      isCurrent && "bg-primary text-white shadow-lg shadow-primary/30",
                      isPast    && "bg-tertiary-fixed-dim/30 text-tertiary",
                      !isCurrent && !isPast && "bg-secondary/10 text-secondary",
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

                  <div>
                    <p
                      className={cn(
                        "text-sm font-bold leading-tight",
                        isCurrent && "text-primary",
                        isPast    && "text-tertiary",
                        !isCurrent && !isPast && "text-secondary",
                      )}
                    >
                      {stage.label}
                    </p>
                    <p className="mt-0.5 text-xs leading-tight text-secondary/70 transition-all duration-300">
                      {sublabel}
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
          <div className="space-y-1">
            {events.map((ev, i) => {
              const isLast    = i === events.length - 1;
              const tag       = classifyLogLine(ev);
              const TagIcon   = tag.Icon;

              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2 rounded-md px-2 py-1.5 transition-all duration-150",
                    // Idle rows get the tag's subtle tint; active last row gets a stronger version
                    tag.rowClass && !isLast && "opacity-90",
                    tag.rowClass,
                    // When this is the actively-streaming last line, boost the tint slightly
                    isLast && isRunning && "ring-1 ring-inset ring-black/[0.04]",
                  )}
                >
                  {/* Left icon */}
                  <span className={cn("mt-px shrink-0", tag.iconClass)}>
                    {isLast && isRunning ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <TagIcon className="size-3" />
                    )}
                  </span>

                  {/* Timestamp */}
                  <span className="shrink-0 text-[10px] text-secondary/45 tabular-nums mt-[1px]">
                    {ev.ts ? formatTs(ev.ts) : ""}
                  </span>

                  {/* Divider */}
                  <ChevronRight className="mt-[2px] size-2.5 shrink-0 text-secondary/20" />

                  {/* Badge */}
                  <span
                    className={cn(
                      "shrink-0 self-start mt-[1px] rounded px-1 py-px text-[9px] font-bold uppercase tracking-wide leading-tight",
                      tag.badgeClass,
                    )}
                  >
                    {tag.label}
                  </span>

                  {/* Message text */}
                  <span className={cn("flex-1 text-[11px] leading-relaxed", tag.textClass)}>
                    {ev.message}
                  </span>
                </div>
              );
            })}

            {/* Blinking cursor while streaming */}
            {isRunning && (
              <div className="flex items-center gap-2 px-2 py-0.5">
                <span className="size-3 shrink-0" />
                <span className="h-[11px] w-[1px] animate-pulse bg-primary/60" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {events.length === 0 && !isRunning && (
        <div className="flex items-center justify-center py-5 text-xs text-secondary/50">
          Pipeline logs will appear here once research starts
        </div>
      )}
    </section>
  );
}