"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import dynamic from "next/dynamic";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileText,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RankedPaper } from "@/types";

// Lazy-load the PDF renderer — it's ~500 KB and only needed after a report exists
const PDFDownloadButton = dynamic(
  () => import("@/components/dashboard/PDFDownloadButton").then((m) => ({ default: m.PDFDownloadButton })),
  { ssr: false, loading: () => null }
);

interface ReportViewerProps {
  markdown: string;
  papers?: RankedPaper[];
  topK?: number;
  isGenerating?: boolean;
}

// Compact word-count estimate for the meta bar
function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Rough "N min read" from word count
function readTime(words: number) {
  return Math.max(1, Math.round(words / 200));
}

// Parse markdown → sanitized HTML. Memoised and debounced during streaming.
function parseHtml(markdown: string): string {
  if (typeof window === "undefined" || !DOMPurify.isSupported) return "";
  const rawHtml = marked.parse(markdown || "", { async: false }) as string;
  return DOMPurify.sanitize(rawHtml);
}

export function ReportViewer({
  markdown,
  papers = [],
  topK = 10,
  isGenerating = false,
}: ReportViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Debounce the expensive markdown → HTML conversion during streaming.
  // While isGenerating=true, we delay re-parsing by 150ms so we don't
  // saturate the main thread on every incoming SSE chunk.
  const [html, setHtml] = useState(() => parseHtml(markdown));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!markdown) {
      setHtml("");
      return;
    }
    if (isGenerating) {
      // Debounce while streaming
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setHtml(parseHtml(markdown));
      }, 150);
    } else {
      // Stream finished — parse immediately for the final render
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setHtml(parseHtml(markdown));
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [markdown, isGenerating]);

  const words = useMemo(() => wordCount(markdown), [markdown]);
  const sections = useMemo(
    () => (markdown.match(/^#{1,2}\s/gm) ?? []).length,
    [markdown]
  );

  const showSection = markdown || isGenerating;
  if (!showSection) return null;

  return (
    <>
      {/* True Fullscreen covers the entire viewport */}

      <section
        className={
          isFullscreen
            ? "fixed inset-0 z-50 overflow-auto bg-white transition-all duration-300"
            : "rounded-xl border border-secondary/10 bg-white shadow-ambient transition-all duration-300"
        }
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className={`relative overflow-hidden border-b border-secondary/10 bg-gradient-to-r from-primary to-primary-container px-6 py-5 ${isFullscreen ? "" : "rounded-t-xl"}`}>
          {/* Decorative background circles */}
          <div className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -right-2 bottom-0 size-20 rounded-full bg-white/5" />

          <div className="relative flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                <BookOpen className="size-5 text-white" />
              </div>
              <div>
                <h2 className="font-heading text-lg font-semibold leading-tight text-white">
                  Research Report
                </h2>
                <p className="mt-0.5 text-xs text-blue-200">
                  AI-synthesized from top {topK} papers
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 w-full sm:w-auto justify-end">
              {/* Fullscreen toggle */}
              {markdown && (
                <button
                  onClick={() => setIsFullscreen((f) => !f)}
                  className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                  aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="size-4" />
                  ) : (
                    <Maximize2 className="size-4" />
                  )}
                </button>
              )}
              <PDFDownloadButton
                report={markdown}
                papers={papers}
                topK={topK}
                isGenerating={isGenerating}
              />
            </div>
          </div>

          {/* Meta bar — only once we have content */}
          {markdown && (
            <div className="relative mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-blue-200 leading-snug">
              <span className="flex items-center gap-1">
                <FileText className="size-3" />
                {words.toLocaleString()} words
              </span>
              <span className="text-white/30">·</span>
              <span>{readTime(words)} min read</span>
              {sections > 0 && (
                <>
                  <span className="text-white/30">·</span>
                  <span>{sections} sections</span>
                </>
              )}
              {papers.length > 0 && (
                <>
                  <span className="text-white/30">·</span>
                  <span>{papers.length} papers analysed</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="px-6 py-6">

          {/* Generating skeleton */}
          {isGenerating && !markdown && (
            <div className="space-y-3 animate-pulse">
              <div className="h-5 w-1/2 rounded-md bg-primary/10" />
              <div className="h-3 w-full rounded bg-secondary/8" />
              <div className="h-3 w-5/6 rounded bg-secondary/8" />
              <div className="h-3 w-4/5 rounded bg-secondary/8" />
              <div className="mt-5 h-4 w-2/5 rounded-md bg-primary/10" />
              <div className="h-3 w-full rounded bg-secondary/8" />
              <div className="h-3 w-11/12 rounded bg-secondary/8" />
              <div className="h-3 w-3/4 rounded bg-secondary/8" />
            </div>
          )}

          {/* Streaming / done report */}
          {markdown && (
            <>
              {/* Collapsed gradient fade */}
              <div
                className={`relative transition-[max-height] duration-500 ease-in-out ${
                  !isExpanded && !isFullscreen ? "max-h-[480px] overflow-hidden" : "max-h-[9999px]"
                }`}
              >
                <article
                  className="report-body max-w-none"
                  dangerouslySetInnerHTML={{ __html: html }}
                />

                {/* Fade-out overlay when collapsed */}
                {!isExpanded && !isFullscreen && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white via-white/80 to-transparent" />
                )}
              </div>

              {/* Expand / collapse — hidden in fullscreen (just scroll) */}
              {!isFullscreen && (
                <div className="mt-5 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setIsExpanded((e) => !e)}
                    className="h-9 gap-2 border-secondary/15 bg-surface px-5 text-sm text-secondary hover:bg-surface-container-low hover:text-on-surface"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="size-3.5" />
                        Collapse Report
                      </>
                    ) : (
                      <>
                        <ChevronDown className="size-3.5" />
                        Show Full Report
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Still streaming but some content has arrived — show a subtle badge */}
          {isGenerating && markdown && (
            <div className="mt-4 flex items-center gap-2 text-xs text-secondary">
              <span className="inline-flex size-2 rounded-full bg-primary animate-pulse" />
              Generating…
            </div>
          )}
        </div>
      </section>
    </>
  );
}
