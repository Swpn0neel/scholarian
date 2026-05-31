"use client";

import { useMemo, useEffect, useState } from "react";
import { ArrowDownUp, ArrowDown, ArrowUp, ExternalLink, X, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RankedPaper } from "@/types";
import { cn } from "@/lib/utils";

type SortKey = "rank" | "title" | "year" | "citationCount" | "simScore" | "finalScore" | "source";
type SortDir = "asc" | "desc";

function SortIcon({ sortKey, column, sortDir }: { sortKey: SortKey; column: SortKey; sortDir: SortDir }) {
  if (sortKey !== column) return <ArrowDownUp className="size-3 opacity-40" />;
  return sortDir === "asc" ? (
    <ArrowUp className="size-3 text-primary" />
  ) : (
    <ArrowDown className="size-3 text-primary" />
  );
}

export function RankedPapersTable({
  papers,
  topK,
  maxPapers,
  onGenerateReport,
  canGenerate,
}: {
  papers: RankedPaper[];
  topK: number;
  maxPapers: number;
  onGenerateReport?: () => void;
  canGenerate: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedPaper, setSelectedPaper] = useState<RankedPaper | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const dynamicParams = useMemo(() => {
    if (papers.length === 0) return null;

    const currentYear = new Date().getFullYear();

    // Mirror score.ts: sorted cit/yr array for percentile rank scoring
    const citPerYearSorted = papers
      .map((p) => {
        const age = p.year ? Math.max(1, currentYear - p.year) : 1;
        return p.citationCount / age;
      })
      .sort((a, b) => a - b);

    // Mirror score.ts: recency window from cohort age span
    const years = papers.map((p) => p.year).filter((y): y is number => typeof y === "number" && y > 0);
    let recencyWindow = 12;
    if (years.length > 0) {
      const minYear = Math.min(...years);
      recencyWindow = Math.max(3, Math.min(25, currentYear - minYear));
    }

    // Dynamic half-life = half the window, clamped 2 – 12 yr
    const recencyHalfLife = Math.max(2, Math.min(12, recencyWindow / 2));

    // Helper: compute the cohort percentile rank for a given paper
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

    return { citPerYearSorted, recencyWindow, recencyHalfLife, cohortPercentile };
  }, [papers]);

  // Close drawer on ESC key (#19)
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedPaper(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      // Toggle direction if same column clicked
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Numeric columns default to descending, text columns to ascending
      setSortDir(["rank", "title", "source"].includes(key) ? "asc" : "desc");
    }
  }

  async function handleCopy() {
    const columns = ["Rank", "Title", "Year", "Citations", "Relevance", "Final Score", "Source"];
    const dataRows = sorted.map((p) => [
      String(p.rank),
      p.title,
      p.year != null ? String(p.year) : "n/a",
      String(p.citationCount),
      (p.simScore ?? 0).toFixed(3),
      (p.finalScore ?? 0).toFixed(3),
      p.source,
    ]);

    // Compute max width per column for alignment
    const colWidths = columns.map((col, i) =>
      Math.max(col.length, ...dataRows.map((row) => row[i].length))
    );

    const pad = (str: string, width: number) => str.padEnd(width);
    const formatRow = (cells: string[]) =>
      "| " + cells.map((c, i) => pad(c, colWidths[i])).join(" | ") + " |";
    const separator = "| " + colWidths.map((w) => "-".repeat(w)).join(" | ") + " |";

    const lines = [formatRow(columns), separator, ...dataRows.map(formatRow)];
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const sorted = useMemo(() => {
    const visiblePapers = showAll ? papers : [...papers].sort((a, b) => a.rank - b.rank).slice(0, maxPapers);
    return visiblePapers.sort((a, b) => {
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
  }, [papers, sortKey, sortDir, showAll, maxPapers]);

  if (!papers.length) return null;


  return (
    <section className="rounded-2xl border border-secondary/10 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-on-surface">Ranked Papers</h2>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary">
            <span>Top {topK} highlighted for report generation.</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {papers.length > maxPapers && (
            <label className="flex cursor-pointer items-center gap-2" title="Show all fetched and ranked papers">
              <span className="text-xs font-semibold text-secondary">Show all ({papers.length})</span>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={showAll}
                  onChange={(e) => setShowAll(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="h-5 w-9 rounded-full bg-secondary/20 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/20"></div>
                <div className="absolute left-[2px] top-[2px] size-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4"></div>
              </div>
            </label>
          )}
          <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleCopy}
            className="h-10 rounded-lg border-secondary/20 text-secondary hover:border-primary/40 hover:text-primary transition-colors"
            title="Copy table to clipboard"
          >
            {copied ? (
              <><Check className="size-4 text-green-600" /><span className="text-green-600">Copied!</span></>
            ) : (
              <><Copy className="size-4" /><span>Copy Table</span></>
            )}
          </Button>
            <Button disabled={!canGenerate} onClick={onGenerateReport} className="h-10 rounded-lg bg-primary text-white">
              Generate Report
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-auto max-h-[550px] rounded-lg border border-secondary/10">
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
                  ["finalScore", "Final"],
                  ["source", "Source"],
                ] as [SortKey, string][]
              ).map(([key, label]) => (
                <th key={key} className="px-3 py-3">
                  <button
                    className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                    onClick={() => toggleSort(key)}
                  >
                    {label}
                    <SortIcon sortKey={sortKey} column={key} sortDir={sortDir} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary/10">
            {sorted.map((paper) => (
              <tr
                key={`${paper.rank}-${paper.title}`}
                onClick={() => setSelectedPaper(paper)}
                className={cn(
                  "cursor-pointer transition hover:bg-surface",
                  paper.rank <= topK && "bg-primary/10"
                )}
              >
                <td className="px-3 py-3 font-semibold text-on-surface">{paper.rank}</td>
                <td className="max-w-[360px] truncate px-3 py-3 text-on-surface" title={paper.title}>
                  {paper.title}
                </td>
                <td className="px-3 py-3 text-secondary">{paper.year ?? "n/a"}</td>
                <td className="px-3 py-3 text-secondary">{paper.citationCount}</td>
                <td className="px-3 py-3 text-secondary">{(paper.simScore ?? 0).toFixed(3)}</td>
                <td className="px-3 py-3 font-semibold text-tertiary">{(paper.finalScore ?? 0).toFixed(3)}</td>
                <td className="px-3 py-3">
                  <Badge className="rounded-md bg-secondary-container/60 text-primary">{paper.source}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>


      {/* Paper detail drawer with backdrop (#19) */}
      {selectedPaper && (
        <>
          {/* Backdrop — click to close */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={() => setSelectedPaper(null)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg border-l border-secondary/10 bg-white p-6 text-on-surface shadow-2xl overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <Badge className="rounded-md bg-secondary-container/60 text-primary">{selectedPaper.source}</Badge>
              <button
                className="rounded-lg p-1.5 text-secondary hover:bg-surface hover:text-on-surface transition-colors"
                onClick={() => setSelectedPaper(null)}
                aria-label="Close panel"
              >
                <X className="size-5" />
              </button>
            </div>
            <h3 className="font-heading text-2xl font-semibold">{selectedPaper.title}</h3>
            <p className="mt-3 text-sm text-secondary">{selectedPaper.authors.join(", ") || "Unknown authors"}</p>
            <p className="mt-6 text-sm leading-7 text-on-surface">{selectedPaper.abstract ?? "No abstract available."}</p>
            <div className="mt-6 space-y-3 rounded-lg bg-surface-container-low p-4 border border-secondary/5 text-sm text-secondary">
              <div className="font-heading text-xs uppercase tracking-widest text-secondary/70 font-bold">Scoring Breakdown</div>
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
                    ({Math.round((dynamicParams?.cohortPercentile(selectedPaper.citationCount, selectedPaper.year ?? null) ?? 0) * 100)}th pct of cohort)
                  </span>
                </div>

                <div>Recency Score:</div>
                <div className="font-semibold text-on-surface text-right">
                  {(selectedPaper.recencyScore ?? 0).toFixed(3)}{" "}
                  <span className="text-xs font-normal text-secondary/65">
                    (half-life: {dynamicParams?.recencyHalfLife ?? 5} yrs)
                  </span>
                </div>

                <div className="border-t border-secondary/15 pt-2 font-semibold text-on-surface">Final Score (with source credibility):</div>
                <div className="border-t border-secondary/15 pt-2 font-bold text-tertiary text-base text-right">
                  {(selectedPaper.finalScore ?? 0).toFixed(3)}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-2 text-sm text-secondary border-t border-secondary/10 pt-4">
              <div>Venue: {selectedPaper.venue ?? "n/a"}</div>
              <div>DOI: {selectedPaper.doi ?? "n/a"}</div>
              <div>Citations: {selectedPaper.citationCount}</div>
              <div>Year: {selectedPaper.year ?? "n/a"}</div>
            </div>
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
    </section>
  );
}

