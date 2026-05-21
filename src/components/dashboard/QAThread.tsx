"use client";

import { memo, useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { GitCompareArrows, RefreshCw, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QAMessage } from "@/hooks/useResearchStore";
import { ReportViewer } from "@/components/dashboard/ReportViewer";

const TYPE_CONFIG = {
  qa: {
    icon: HelpCircle,
    label: "Q&A",
    headerBg: "bg-gradient-to-r from-primary to-primary-container",
    badgeClass: "bg-white/20 text-white",
    borderClass: "border-primary/20",
  },
  refine: {
    icon: RefreshCw,
    label: "Refinement",
    headerBg: "bg-gradient-to-r from-tertiary-container to-tertiary",
    badgeClass: "bg-white/20 text-white",
    borderClass: "border-tertiary/20",
  },
};

function AnswerHTML({ markdown }: { markdown: string }) {
  const html = useMemo(() => {
    // DOMPurify requires a browser DOM — guard for environments where it's unavailable
    if (typeof window === "undefined" || !DOMPurify.isSupported) {
      return marked.parse(markdown, { async: false }) as string;
    }
    const raw = marked.parse(markdown, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [markdown]);

  return (
    <article
      className="report-body max-w-none text-sm"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

interface QAThreadProps {
  messages: QAMessage[];
  reportCount?: number;
}

export const QAThread = memo(function QAThread({ messages, reportCount = 0 }: QAThreadProps) {
  if (!messages.length) return null;

  return (
    <div className="space-y-4">
      {messages.map((msg) => {
        // Report and Comparison messages get their own full-width viewer inline
        if (msg.type === "report" || msg.type === "compare") {
          const isComparison = msg.type === "compare";
          return (
            <div key={msg.id} className="space-y-2">
              {isComparison && (
                <div className="flex justify-start pl-1">
                  <span className="text-xs font-semibold text-secondary">
                    Action: {msg.question}
                  </span>
                </div>
              )}
              <ReportViewer
                markdown={msg.answer}
                papers={msg.reportPapers ?? []}
                topK={msg.reportTopK ?? 10}
                isGenerating={!!msg.isGenerating}
                title={isComparison ? "Comparison Report" : undefined}
                subtitle={isComparison ? "AI-synthesized comparison" : undefined}
                headerBg={
                  isComparison
                    ? "bg-gradient-to-r from-[#1a3a5c] to-[#2563eb]"
                    : undefined
                }
                icon={isComparison ? GitCompareArrows : undefined}
              />
            </div>
          );
        }

        const cfg = TYPE_CONFIG[msg.type] ?? TYPE_CONFIG.qa;
        const Icon = cfg.icon;

        return (
          <div
            key={msg.id}
            className={cn(
              "overflow-hidden rounded-2xl border shadow-ambient",
              cfg.borderClass
            )}
          >
            {/* Header */}
            <div className={cn("flex flex-col px-4 py-3", cfg.headerBg)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-7 items-center justify-center rounded-full bg-white/15">
                    <Icon className="size-3.5 text-white" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                      {cfg.label}
                    </span>
                    <p className="text-xs font-semibold text-white leading-tight">
                      Q{msg.index}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cfg.badgeClass)}>
                    #{msg.index}
                  </span>
                </div>
              </div>
            </div>

            {/* Question bubble */}
            <div className="border-b border-secondary/10 bg-surface px-4 py-3">
              <p className="text-sm font-medium text-on-surface leading-snug">
                {msg.question}
              </p>
            </div>

            {/* Answer */}
            <div className="bg-white px-4 py-4">
              <AnswerHTML markdown={msg.answer} />
              {msg.isGenerating && (
                <div className="mt-4 flex items-center gap-2 text-xs text-secondary">
                  <span className="inline-flex size-2 rounded-full bg-primary animate-pulse" />
                  Generating…
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Hint when comparison is available */}
      {reportCount >= 2 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-secondary/20 px-4 py-3 text-xs text-secondary">
          <GitCompareArrows className="size-3.5 shrink-0 text-secondary/60" />
          <span>
            You have <strong>{reportCount} reports</strong> — try{" "}
            <em>&quot;Compare report 1 with report 2&quot;</em> to generate a comparison.
          </span>
        </div>
      )}
    </div>
  );
});

