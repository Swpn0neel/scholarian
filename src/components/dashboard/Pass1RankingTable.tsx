"use client";

import { useMemo, useState, useEffect } from "react";
import {
  ArrowDownUp,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  BarChart2,
  Filter,
  Info,
  X,
  ExternalLink,
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
 * Pass1RankingTable — Transparent branch only.
 *
 * Shows the intermediate Pass 1 ranking results that appear *before* the
 * quality filter and Pass 2 re-ranking steps. These results are ephemeral
 * (never saved to the database). Clicking any row opens the full paper detail
 * drawer — identical to the one in RankedPapersTable.
 *
 * DB behaviour: pass1Papers are NEVER written to Supabase. Only the final
 * Pass 2 `ranked` array reaches the `papers` table and `run_metadata`.
 * Opening the same chat on the stable branch restores data as usual.
 */
export function Pass1RankingTable({
  papers,
  qualityThresholdPct = 40,
  isComplete = false,
}: {
  papers: RankedPaper[];
  /** Percentage of bottom papers that will be dropped by the quality filter */
  qualityThresholdPct?: number;
  /** True once Pass 2 is done — switches header/banner/footer to completed state */
  isComplete?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedPaper, setSelectedPaper] = useState<RankedPaper | null>(null);

  // Close drawer on ESC key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedPaper(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Mirror the scoring breakdown helpers from RankedPapersTable / score.ts
  const dynamicParams = useMemo(() => {
    if (papers.length === 0) return null;
    const currentYear = new Date().getFullYear();

    const citPerYearSorted = papers
      .map((p) => {
        const age = p.year ? Math.max(1, currentYear - p.year) : 1;
        return p.citationCount / age;
      })
      .sort((a, b) => a - b);

    const years = papers
      .map((p) => p.year)
      .filter((y): y is number => typeof y === "number" && y > 0);
    let recencyWindow = 12;
    if (years.length > 0) {
      const minYear = Math.min(...years);
      recencyWindow = Math.max(3, Math.min(25, currentYear - minYear));
    }
    const recencyHalfLife = Math.max(2, Math.min(12, recencyWindow / 2));

    function cohortPercentile(citationCount: number, year: number | null): number {
      if (citPerYearSorted.length === 0) return 0;
      const age = year ? Math.max(1, currentYear - year) : 1;
      const citPerYear = citationCount / age;
      let rank = 0;
      for (const v of citPerYearSorted) {
        if (v < citPerYear) rank++;
        else break;
      }
      return rank / citPerYearSorted.length;
    }

    return { recencyHalfLife, cohortPercentile };
  }, [papers]);

  const cutoffRank = useMemo(
    () => Math.ceil(papers.length * (1 - qualityThresholdPct / 100)),
    [papers.length, qualityThresholdPct]
  );

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
    <>
      <section className="rounded-2xl border border-primary/20 bg-white shadow-sm overflow-hidden">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-primary/5 border-b border-primary/15">
          <div className="flex items-center gap-2.5">
            {/* Live pulse dot while in-progress; static teal dot once complete */}
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
                <><ChevronUp className="size-3.5" /> Collapse</>
              ) : (
                <><ChevronDown className="size-3.5" /> Expand ({papers.length})</>
              )}
            </button>
          </div>
        </div>

        {/* ── Info banner ── */}
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
                cohort. Click any row to inspect its scores. Compare with the final ranking below.
              </span>
            ) : (
              <span>
                These are <strong>preliminary scores</strong> — the quality filter will remove the
                bottom {qualityThresholdPct}% (ranks {cutoffRank + 1}–{papers.length}), then Pass 2
                will re-rank the survivors with cohort-adjusted metrics.{" "}
                <strong>Click any row to inspect details.</strong>
              </span>
            )}
          </div>
        )}

        {/* ── Table ── */}
        {isOpen && (
          <div className="overflow-auto max-h-[480px]">
            <table className="w-full min-w-[860px] text-left text-sm relative">
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
                  const willSurvive = paper.rank <= cutoffRank;
                  return (
                    <tr
                      key={`pass1-${paper.rank}-${paper.title}`}
                      onClick={() => setSelectedPaper(paper)}
                      className={cn(
                        "cursor-pointer transition hover:bg-surface",
                        !willSurvive && "opacity-55 bg-red-50/30"
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

        {/* ── Footer ── */}
        {isOpen && (
          <div className="flex items-center justify-between border-t border-secondary/8 px-5 py-2.5 bg-surface/40 text-[11px] text-secondary">
            <span>
              <strong className="text-emerald-700">{cutoffRank}</strong> papers survived the quality
              filter ·{" "}
              <strong className="text-red-500">{papers.length - cutoffRank}</strong> were dropped
            </span>
            {isComplete ? (
              <span className="text-tertiary font-semibold">↓ Final Pass 2 ranking is shown below</span>
            ) : (
              <span className="text-secondary/50 italic">Waiting for Pass 2 re-ranking…</span>
            )}
          </div>
        )}
      </section>

      {/* ── Paper detail drawer (same as RankedPapersTable) ── */}
      {selectedPaper && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={() => setSelectedPaper(null)}
          />

          {/* Slide-in panel */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg border-l border-secondary/10 bg-white p-6 text-on-surface shadow-2xl overflow-y-auto">
            {/* Panel header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Badge className="rounded-md bg-secondary-container/60 text-primary">
                  {selectedPaper.source}
                </Badge>
                {/* Fate badge in drawer */}
                {selectedPaper.rank <= cutoffRank ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                    ✓ Survived filter
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-500">
                    ✗ Filtered out
                  </span>
                )}
              </div>
              <button
                className="rounded-lg p-1.5 text-secondary hover:bg-surface hover:text-on-surface transition-colors"
                onClick={() => setSelectedPaper(null)}
                aria-label="Close panel"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Pass 1 context note */}
            <div className="mb-5 rounded-lg bg-primary/5 border border-primary/10 px-3.5 py-2.5 text-[11px] text-primary/80">
              <strong>Pass 1 score</strong> — scored against the full{" "}
              {papers.length}-paper candidate pool before the quality filter.{" "}
              {isComplete
                ? "Pass 2 re-ranked the surviving cohort with tighter metrics."
                : "Pass 2 re-ranking is in progress."}
            </div>

            <h3 className="font-heading text-2xl font-semibold">{selectedPaper.title}</h3>
            <p className="mt-3 text-sm text-secondary">
              {selectedPaper.authors.join(", ") || "Unknown authors"}
            </p>
            <p className="mt-6 text-sm leading-7 text-on-surface">
              {selectedPaper.abstract ?? "No abstract available."}
            </p>

            {/* Scoring breakdown — mirrors RankedPapersTable exactly */}
            <div className="mt-6 space-y-3 rounded-lg bg-surface-container-low p-4 border border-secondary/5 text-sm text-secondary">
              <div className="font-heading text-xs uppercase tracking-widest text-secondary/70 font-bold">
                Pass 1 Scoring Breakdown
              </div>
              <div className="grid grid-cols-2 gap-y-2.5 mt-2">
                <div>Relevance Score:</div>
                <div className="font-semibold text-on-surface text-right">
                  {(selectedPaper.simScore ?? 0).toFixed(3)}{" "}
                  <span className="text-xs font-normal text-secondary/65">(quality-adjusted)</span>
                </div>

                <div>Citation Score:</div>
                <div className="font-semibold text-on-surface text-right">
                  {(selectedPaper.citationScore ?? 0).toFixed(3)}{" "}
                  <span className="text-xs font-normal text-secondary/65">
                    (
                    {Math.round(
                      (dynamicParams?.cohortPercentile(
                        selectedPaper.citationCount,
                        selectedPaper.year ?? null
                      ) ?? 0) * 100
                    )}
                    th pct of pool)
                  </span>
                </div>

                <div>Recency Score:</div>
                <div className="font-semibold text-on-surface text-right">
                  {(selectedPaper.recencyScore ?? 0).toFixed(3)}{" "}
                  <span className="text-xs font-normal text-secondary/65">
                    (half-life: {dynamicParams?.recencyHalfLife ?? 5} yrs)
                  </span>
                </div>

                <div className="border-t border-secondary/15 pt-2 font-semibold text-on-surface">
                  Pass 1 Final Score:
                </div>
                <div className="border-t border-secondary/15 pt-2 font-bold text-primary text-base text-right">
                  {(selectedPaper.finalScore ?? 0).toFixed(3)}
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="mt-6 space-y-2 text-sm text-secondary border-t border-secondary/10 pt-4">
              <div>Venue: {selectedPaper.venue ?? "n/a"}</div>
              <div>DOI: {selectedPaper.doi ?? "n/a"}</div>
              <div>Citations: {selectedPaper.citationCount}</div>
              <div>Year: {selectedPaper.year ?? "n/a"}</div>
            </div>

            {/* External link */}
            {(selectedPaper.pdfUrl || selectedPaper.url) && (
              <a
                href={selectedPaper.pdfUrl ?? selectedPaper.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary"
              >
                Open source <ExternalLink className="size-4" />
              </a>
            )}
          </div>
        </>
      )}
    </>
  );
}
