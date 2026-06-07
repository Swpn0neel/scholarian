"use client";

import { memo, useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { GitCompareArrows, RefreshCw, HelpCircle, Loader2 } from "lucide-react";
import type { QAMessage } from "@/hooks/useResearchStore";
import { ReportViewer } from "@/components/dashboard/ReportViewer";

const TYPE_CONFIG = {
  qa: {
    icon: HelpCircle,
    label: "Answer",
    accentColor: "#70d8c8",
  },
  refine: {
    icon: RefreshCw,
    label: "Refinement",
    accentColor: "#a78bfa",
  },
};

function AnswerHTML({ markdown }: { markdown: string }) {
  const html = useMemo(() => {
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
    <div className="space-y-5">
      {messages.map((msg, _, arr) => {
        // Calculate dynamic QA index (how many qa/refine messages appeared up to this point)
        const qaIndex = arr.slice(0, arr.indexOf(msg) + 1).filter(m => m.type !== "report" && m.type !== "compare").length;

        // Report and Comparison messages → ReportViewer
        if (msg.type === "report" || msg.type === "compare") {
          const isComparison = msg.type === "compare";
          return (
            <div key={msg.id} className="space-y-2">
              {isComparison && (
                <div className="flex justify-end">
                  {/* User action bubble */}
                  <div
                    className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm"
                    style={{ background: "linear-gradient(135deg, #001228 0%, #002055 100%)" }}
                  >
                    <p className="text-xs font-bold uppercase tracking-widest text-tertiary-fixed-dim/70 mb-0.5">Action</p>
                    <p className="text-sm font-medium text-white">{msg.question}</p>
                  </div>
                </div>
              )}
              <ReportViewer
                markdown={msg.answer}
                papers={msg.reportPapers ?? []}
                topK={msg.reportTopK ?? 10}
                isGenerating={!!msg.isGenerating}
                title={isComparison ? "Comparison Report" : undefined}
                subtitle={isComparison ? "AI-synthesized comparison" : undefined}
                icon={isComparison ? GitCompareArrows : undefined}
              />
            </div>
          );
        }

        const cfg = TYPE_CONFIG[msg.type] ?? TYPE_CONFIG.qa;
        const Icon = cfg.icon;

        return (
          <div key={msg.id} className="space-y-2">

            {/* ── User question bubble (right-aligned) ── */}
            <div className="flex justify-end">
              <div
                className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm"
                style={{ background: "linear-gradient(135deg, #001228 0%, #002055 100%)" }}
              >
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#70d8c8", opacity: 0.7 }}>
                  Q{qaIndex}
                </p>
                <p className="text-sm font-medium text-white leading-snug">{msg.question}</p>
              </div>
            </div>

            {/* ── AI answer card ── */}
            <div className="overflow-hidden rounded-2xl border border-secondary/10 bg-white shadow-[0_12px_40px_-8px_rgba(0,49,120,0.10)]">

              {/* Subtle type header */}
              <div
                className="flex items-center gap-2 border-b border-secondary/8 px-5 py-2.5"
                style={{ background: "rgba(0,18,40,0.03)" }}
              >
                <div
                  className="flex size-5 items-center justify-center rounded-full"
                  style={{ background: cfg.accentColor + "20" }}
                >
                  <Icon className="size-3" style={{ color: cfg.accentColor }} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary/50">
                  {cfg.label}
                </span>
                {msg.type === "refine" && (
                  <span className="ml-1 rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-600">
                    Re-running pipeline
                  </span>
                )}
              </div>

              {/* Answer body */}
              <div className="px-5 py-5">
                <AnswerHTML markdown={msg.answer} />
                {msg.isGenerating && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-secondary">
                    <Loader2 className="size-3 animate-spin text-tertiary-fixed-dim" />
                    <span>Generating…</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Hint when comparison is available */}
      {reportCount >= 2 && (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-secondary/20 px-4 py-3 text-xs text-secondary">
          <GitCompareArrows className="size-3.5 shrink-0 text-secondary/50" />
          <span>
            You have <strong>{reportCount} reports</strong> — try{" "}
            <em>&quot;Compare report 1 with report 2&quot;</em> to generate a comparison.
          </span>
        </div>
      )}
    </div>
  );
});
