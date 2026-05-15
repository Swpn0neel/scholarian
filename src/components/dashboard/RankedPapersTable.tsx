"use client";

import { useMemo, useEffect, useState } from "react";
import { ArrowDownUp, ArrowDown, ArrowUp, ExternalLink, X } from "lucide-react";
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
  onGenerateReport,
  canGenerate,
}: {
  papers: RankedPaper[];
  topK: number;
  onGenerateReport?: () => void;
  canGenerate: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedPaper, setSelectedPaper] = useState<RankedPaper | null>(null);

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
    <section className="rounded-lg border border-secondary/10 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-on-surface">Ranked Papers</h2>
          <p className="text-sm text-secondary">Top {topK} highlighted for report generation.</p>
        </div>
        <Button disabled={!canGenerate} onClick={onGenerateReport} className="h-10 rounded-lg bg-primary text-white">
          Generate Report
        </Button>
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
            <div className="mt-6 space-y-2 text-sm text-secondary">
              <div>Venue: {selectedPaper.venue ?? "n/a"}</div>
              <div>DOI: {selectedPaper.doi ?? "n/a"}</div>
              <div>Citations: {selectedPaper.citationCount}</div>
              <div>Final Score: <span className="font-semibold text-tertiary">{(selectedPaper.finalScore ?? 0).toFixed(3)}</span></div>
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

