"use client";

import { memo, useMemo, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { GitCompareArrows, RefreshCw, HelpCircle, FileDown, Loader2, BookOpen } from "lucide-react";
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
  compare: {
    icon: GitCompareArrows,
    label: "Comparison Report",
    headerBg: "bg-gradient-to-r from-[#1a3a5c] to-[#2563eb]",
    badgeClass: "bg-white/20 text-white",
    borderClass: "border-blue-300/30",
  },
  report: {
    icon: BookOpen,
    label: "Report",
    headerBg: "", // unused — report renders via ReportViewer
    badgeClass: "",
    borderClass: "",
  },
};

function AnswerHTML({ markdown }: { markdown: string }) {
  const html = useMemo(() => {
    if (typeof window === "undefined" || !DOMPurify.isSupported) return "";
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

/** Simple plain-text PDF download for comparison/refine reports */
function ComparisonPDFButton({ markdown, filename }: { markdown: string; filename: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      // Dynamically import jsPDF to keep the bundle lean
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Strip markdown to plain text for a clean PDF
      const html = marked.parse(markdown, { async: false }) as string;
      const tmp = document.createElement("div");
      tmp.innerHTML = DOMPurify.sanitize(html);
      const plainText = tmp.innerText || tmp.textContent || "";

      const pageW = doc.internal.pageSize.getWidth() - 28; // 14mm margins each side
      const lines = doc.splitTextToSize(plainText, pageW);
      const lineH = 6;
      let y = 20;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(filename, 14, y);
      y += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      for (const line of lines) {
        if (y > doc.internal.pageSize.getHeight() - 15) {
          doc.addPage();
          y = 15;
        }
        doc.text(line as string, 14, y);
        y += lineH;
      }

      doc.save(`${filename.replace(/\s+/g, "_")}.pdf`);
    } catch {
      alert("PDF generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-white/30 disabled:opacity-60"
    >
      {loading ? <Loader2 className="size-3 animate-spin" /> : <FileDown className="size-3" />}
      {loading ? "Generating…" : "Download PDF"}
    </button>
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
      {/* Header removed for unified timeline */}

      {messages.map((msg) => {
        // Report messages get their own full-width viewer inline
        if (msg.type === "report") {
          return (
            <div key={msg.id}>
              <ReportViewer
                markdown={msg.answer}
                papers={msg.reportPapers ?? []}
                topK={msg.reportTopK ?? 10}
                isGenerating={false}
              />
            </div>
          );
        }

        const cfg = TYPE_CONFIG[msg.type] ?? TYPE_CONFIG.qa;
        const Icon = cfg.icon;
        const isComparison = msg.type === "compare";

        return (
          <div
            key={msg.id}
            className={cn(
              "overflow-hidden rounded-xl border shadow-ambient",
              cfg.borderClass,
              isComparison && "shadow-lg"
            )}
          >
            {/* Header */}
            <div className={cn("flex items-center justify-between px-4 py-3", cfg.headerBg)}>
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-full bg-white/15">
                  <Icon className="size-3.5 text-white" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                    {cfg.label}
                  </span>
                  <p className="text-xs font-semibold text-white leading-tight">
                    {isComparison ? "Analysis" : `Q${msg.index}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* PDF download only for comparison reports */}
                {isComparison && msg.answer && msg.answer.length > 100 && (
                  <ComparisonPDFButton
                    markdown={msg.answer}
                    filename={`Comparison_Report_${msg.index}`}
                  />
                )}
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cfg.badgeClass)}>
                  #{msg.index}
                </span>
              </div>
            </div>

            {/* Question bubble */}
            <div className="border-b border-secondary/10 bg-surface px-4 py-3">
              <p className="text-sm font-medium text-on-surface leading-snug">
                {msg.question}
              </p>
            </div>

            {/* Answer — full-width document feel for comparison */}
            <div className={cn("bg-white px-4 py-4", isComparison && "px-6 py-6")}>
              <AnswerHTML markdown={msg.answer} />
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
