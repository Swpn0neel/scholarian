"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownUp,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  BarChart2,
  Filter,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RankedPaper } from "@/types";
import { cn } from "@/lib/utils";

type SortKey = "rank" | "title" | "year" | "citationCount" | "simScore" | "finalScore" | "source";
type SortDir = "asc" | "desc";

function SortIcon({
  sortKey,
  column,
  sortDir,
}: {
  sortKey: SortKey;
  column: SortKey;
  sortDir: SortDir;
}) {
  if (sortKey !== column) return <ArrowDownUp className="size-3 opacity-40" />;
  return sortDir === "asc" ? (
    <ArrowUp className="size-3 text-primary" />
  ) : (
    <ArrowDown className="size-3 text-primary" />
  );
}

/**
 * Pass1RankingTable — Transparent mode only.
 *
 * Shows the intermediate Pass 1 ranking results that appear *before* the
 * quality filter and Pass 2 re-ranking steps. These results are ephemeral
 * (never saved to the database) and will be replaced by the final ranked
 * table once Pass 2 completes.
 */
export function Pass1RankingTable({
  papers,
  qualityThresholdPct = 40,
  isComplete = false,
}: {
  papers: RankedPaper[];
  /** Percentage of bottom papers that will be dropped by the quality filter */
  qualityThresholdPct?: number;
  /** True once Pass 2 is done — changes footer wording */
  isComplete?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const cutoffRank = useMemo(() => {
    // Mirror the quality filter: drop bottom 40% (i.e. keep top 60%)
    return Math.ceil(papers.length * (1 - qualityThresholdPct / 100));
  }, [papers.length, qualityThresholdPct]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(["rank", "title", "source"].includes(key) ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    return [...papers].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      let comparison: number;
      if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue ?? "").localeCompare(String(bValue ?? ""));
      }
      return sortDir === "asc" ? comparison : -comparison;
    });
  }, [papers, sortKey, sortDir]);

  if (!papers.length) return null;

  return (
    <section className="rounded-2xl border border-primary/20 bg-white shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-primary/5 border-b border-primary/15">
        <div className="flex items-center gap-2.5">
          {/* Animated indicator while live; static check once complete */}
          <span className="relative flex size-2.5">
            {!isComplete && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-50" />
            )}
            <span
              className={`relative inline-flex size-2.5 rounded-full ${
                isComplete ? "bg-tertiary-fixed-dim" : "bg-primary"
              }`}
            />
          </span>

          <div className="flex items-center gap-2">
            <BarChart2 className="size-4 text-primary" />
            <h2 className="font-heading text-sm font-semibold text-on-surface">
              Pass 1 Ranking
            </h2>
            <Badge
              className={`rounded-full border-0 text-[9px] font-bold uppercase tracking-widest px-2 ${
                isComplete
                  ? "bg-tertiary-fixed-dim/20 text-tertiary"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {isComplete ? "Pass 1 Complete" : "Intermediate"} · {papers.length} candidates
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Info tooltip text */}
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-secondary/70">
            <Info className="size-3 shrink-0" />
            {isComplete ? (
              <span>
                Quality filter removed bottom{" "}
                <strong className="text-secondary">{qualityThresholdPct}%</strong>. Scroll down
                for the Pass 2 final ranking.
              </span>
            ) : (
              <span>
                Bottom <strong className="text-secondary">{qualityThresholdPct}%</strong> will be
                filtered before Pass 2 re-ranking
              </span>
            )}
          </div>

          <button
            onClick={() => setIsOpen((v) => !v)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-secondary hover:bg-secondary/8 transition-colors"
            aria-expanded={isOpen}
          >
            {isOpen ? (
              <>
                <ChevronUp className="size-3.5" /> Collapse
              </>
            ) : (
              <>
                <ChevronDown className="size-3.5" /> Expand ({papers.length})
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Ephemeral notice banner ── */}
      {isOpen && (
        <div
          className={`flex items-center gap-2 px-5 py-2 border-b text-[11px] ${
            isComplete
              ? "bg-tertiary-fixed-dim/10 border-tertiary-fixed-dim/20 text-tertiary"
              : "bg-amber-50/60 border-amber-100 text-amber-700"
          }`}
        >
          <Filter className="size-3 shrink-0" />
          {isComplete ? (
            <span>
              Pass 1 scored all <strong>{papers.length}</strong> candidates. Quality filter kept{" "}
              <strong>{cutoffRank}</strong> survivors (dropped{" "}
              <strong>{papers.length - cutoffRank}</strong>), then Pass 2 re-ranked the final
              cohort. Compare the rankings below.
            </span>
          ) : (
            <span>
              These are <strong>preliminary scores</strong> — the quality filter will remove the
              bottom {qualityThresholdPct}% (ranks {cutoffRank + 1}–{papers.length}), then Pass 2
              will re-rank the survivors with cohort-adjusted metrics.
            </span>
          )}
        </div>
      )}

      {/* ── Table ── */}
      {isOpen && (
        <div className="overflow-auto max-h-[480px]">
          <table className="w-full min-w-[820px] text-left text-sm relative">
            <thead className="sticky top-0 z-10 bg-surface-container-low text-xs uppercase tracking-[0.14em] text-secondary shadow-sm">
              <tr>
                {(
                  [
                    ["rank", "Rank"],
                    ["title", "Title"],
                    ["year", "Year"],
                    ["citationCount", "Citations"],
                    ["simScore", "Relevance"],
                    ["finalScore", "Pass 1 Score"],
                    ["source", "Source"],
                  ] as [SortKey, string][]
                ).map(([key, label]) => (
                  <th key={key} className="px-3 py-2.5">
                    <button
                      className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                      onClick={() => toggleSort(key)}
                    >
                      {label}
                      <SortIcon sortKey={sortKey} column={key} sortDir={sortDir} />
                    </button>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-xs text-secondary/60">Fate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary/8">
              {sorted.map((paper) => {
                // In the sorted view, "fate" depends on the original rank (not visual position)
                const willSurvive = paper.rank <= cutoffRank;
                return (
                  <tr
                    key={`pass1-${paper.rank}-${paper.title}`}
                    className={cn(
                      "transition hover:bg-surface/60",
                      !willSurvive && "opacity-50 bg-red-50/30"
                    )}
                  >
                    <td className="px-3 py-2.5 font-semibold text-on-surface tabular-nums">
                      {paper.rank}
                    </td>
                    <td
                      className="max-w-[340px] truncate px-3 py-2.5 text-on-surface"
                      title={paper.title}
                    >
                      {paper.title}
                    </td>
                    <td className="px-3 py-2.5 text-secondary tabular-nums">
                      {paper.year ?? "n/a"}
                    </td>
                    <td className="px-3 py-2.5 text-secondary tabular-nums">
                      {paper.citationCount}
                    </td>
                    <td className="px-3 py-2.5 text-secondary tabular-nums">
                      {(paper.simScore ?? 0).toFixed(3)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 font-semibold tabular-nums",
                        willSurvive ? "text-primary" : "text-red-400"
                      )}
                    >
                      {(paper.finalScore ?? 0).toFixed(3)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge className="rounded-md bg-secondary-container/60 text-primary text-[10px]">
                        {paper.source}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      {willSurvive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                          ✓ Keep
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-500">
                          ✗ Filter
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Footer summary ── */}
      {isOpen && (
        <div className="flex items-center justify-between border-t border-secondary/8 px-5 py-2.5 bg-surface/40 text-[11px] text-secondary">
          <span>
            <strong className="text-emerald-700">{cutoffRank}</strong> papers survived the quality
            filter ·{" "}
            <strong className="text-red-500">{papers.length - cutoffRank}</strong> were dropped
          </span>
          {isComplete ? (
            <span className="flex items-center gap-1 text-tertiary font-semibold">
              ↓ Final Pass 2 ranking is shown below
            </span>
          ) : (
            <span className="text-secondary/50 italic">Waiting for Pass 2 re-ranking…</span>
          )}
        </div>
      )}
    </section>
  );
}
