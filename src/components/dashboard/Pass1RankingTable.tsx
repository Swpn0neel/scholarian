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
  maxPapers,
  isComplete = false,
}: {
  papers: RankedPaper[];
  /** The maxPapers cap — papers with rank ≤ maxPapers are passed to Pass 2 */
  maxPapers: number;
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

  // Compute recency half-life from the Pass 1 pool (still dynamic).
  // citPerYearSorted / cohortPercentile removed: Pass 1 now uses
  // simpleCitationScore (log-normalized cit/yr), not the cohort percentile.
  const recencyHalfLife = useMemo(() => {
    if (papers.length === 0) return 5;
    const currentYear = new Date().getFullYear();
    const years = papers
      .map((p) => p.year)
      .filter((y): y is number => typeof y === "number" && y > 0);
    if (years.length === 0) return 5;
    const minYear     = Math.min(...years);
    const window      = Math.max(3, Math.min(25, currentYear - minYear));
    return Math.max(2, Math.min(12, window / 2));
  }, [papers]);

  // cutoffRank is simply maxPapers: papers ranked 1–maxPapers go to Pass 2,
  // everything beyond is dropped from the candidate pool.
  const cutoffRank = maxPapers;

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
                  Top <strong className="text-secondary">{maxPapers}</strong> papers passed to Pass 2. Scroll down
                  for the final ranking.
                </span>
              ) : (
                <span>
                  Top <strong className="text-secondary">{maxPapers}</strong> of{" "}
                  {papers.length} candidates will be passed to Pass 2
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
                : "bg-primary/5 border-primary/10 text-primary/80"
            }`}
          >
            <Filter className="size-3 shrink-0" />
            {isComplete ? (
              <span>
                Pass 1 ranked all <strong>{papers.length}</strong> candidates. Top{" "}
                <strong>{cutoffRank}</strong> were passed to Pass 2 ({papers.length - cutoffRank} dropped).
                Compare the rankings below.
              </span>
            ) : (
              <span>
                Pass 1 is ranking all <strong>{papers.length}</strong> candidates. Top{" "}
                <strong>{maxPapers}</strong> will be passed to Pass 2.
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
              <strong className="text-primary">{cutoffRank}</strong> papers passed to Pass 2 ·{" "}
              <strong className="text-secondary/70">{papers.length - cutoffRank}</strong> dropped
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
                    ✓ Passed to Pass 2
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-500">
                    ✗ Dropped by cap
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
              <strong>Pass 1 score</strong> — ranked against the full {papers.length}-paper candidate pool.
              Top {maxPapers} are passed to Pass 2;{" "}
              {papers.length - maxPapers} are dropped.{" "}
              {isComplete
                ? "Pass 2 re-ranked the top cohort with tighter, cohort-accurate metrics."
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
                  <span className="text-xs font-normal text-secondary/65">(log-normalized cit/yr)</span>
                </div>

                <div>Recency Score:</div>
                <div className="font-semibold text-on-surface text-right">
                  {(selectedPaper.recencyScore ?? 0).toFixed(3)}{" "}
                  <span className="text-xs font-normal text-secondary/65">
                    (half-life: {recencyHalfLife} yrs)
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
