"use client";

import {
  Document,
  Page,
  PDFDownloadLink,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RankedPaper } from "@/types";

// ---------------------------------------------------------------------------
// Markdown → plain text
// Strips the most common markdown tokens so the PDF body reads as clean prose.
// ---------------------------------------------------------------------------
function stripMarkdown(md: string): string {
  return (
    md
      // Remove fenced code blocks (``` ... ```)
      .replace(/```[\s\S]*?```/g, "")
      // Remove inline code
      .replace(/`[^`]*`/g, (m) => m.slice(1, -1))
      // ATX headings (#, ##, ###, ...)  → keep the text
      .replace(/^#{1,6}\s+(.+)$/gm, "$1")
      // Setext headings (underlines)
      .replace(/^[=\-]{3,}\s*$/gm, "")
      // Bold / italic (**text**, *text*, __text__, _text_)
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(\*|_)(.*?)\1/g, "$2")
      // Strikethrough
      .replace(/~~(.*?)~~/g, "$1")
      // Inline images ![alt](url)
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      // Links [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      // Blockquotes
      .replace(/^>\s?/gm, "")
      // Unordered list markers (-, *, +)
      .replace(/^[\-\*\+]\s+/gm, "• ")
      // Ordered list markers (1., 2., ...)
      .replace(/^\d+\.\s+/gm, (m) => m)
      // Horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // Collapse multiple blank lines
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

// ---------------------------------------------------------------------------
// Split stripped text into typed blocks for structured PDF rendering
// ---------------------------------------------------------------------------
interface Block {
  type: "heading" | "body" | "table";
  level?: number; // 1-6 for headings
  text?: string;
  tableData?: string[][]; // For tables: outer array = rows, inner array = cells
}

function parseBlocks(plainText: string): Block[] {
  const lines = plainText.split("\n");
  const blocks: Block[] = [];
  let bodyBuffer: string[] = [];
  let currentTableRows: string[][] = [];

  function flushBody() {
    const text = bodyBuffer.join("\n").trim();
    if (text) blocks.push({ type: "body", text });
    bodyBuffer = [];
  }

  function flushTable() {
    if (currentTableRows.length > 0) {
      // Filter out separator row (like | --- | --- |)
      const cleanRows = currentTableRows.filter(row => {
        const combined = row.join("").trim();
        return !/^[:\-\s|]+$/.test(combined) && combined.length > 0;
      });
      
      if (cleanRows.length > 0) {
        blocks.push({ type: "table", tableData: cleanRows });
      }
      currentTableRows = [];
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    const isTableRow = trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 1;

    if (isTableRow) {
      flushBody();
      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map(cell => cell.trim());
      currentTableRows.push(cells);
    } else {
      flushTable();
      const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
      if (headingMatch) {
        flushBody();
        blocks.push({ type: "heading", level: headingMatch[1].length, text: headingMatch[2].trim() });
      } else if (trimmed === "") {
        bodyBuffer.push("");
      } else {
        bodyBuffer.push(line);
      }
    }
  }

  flushBody();
  flushTable();
  return blocks;
}

// ---------------------------------------------------------------------------
// PDF Document
// ---------------------------------------------------------------------------
const C = {
  navy: "#0a1628",
  primary: "#1a3a6b",
  accent: "#2563eb",
  muted: "#64748b",
  light: "#f1f5f9",
  white: "#ffffff",
  border: "#e2e8f0",
  green: "#166534",
  greenBg: "#f0fdf4",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 52,
    paddingBottom: 64,
    paddingHorizontal: 48,
    backgroundColor: C.white,
    fontFamily: "Helvetica",
    color: C.navy,
  },
  // Landscape variant used for sections that contain wide markdown tables
  pageLandscape: {
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 44,
    backgroundColor: C.white,
    fontFamily: "Helvetica",
    color: C.navy,
  },

  // Header band
  headerBand: {
    backgroundColor: C.primary,
    marginHorizontal: -48,
    marginTop: -52,
    paddingHorizontal: 48,
    paddingVertical: 24,
    marginBottom: 28,
  },
  headerTitle: {
    fontSize: 22,
    color: C.white,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 9,
    color: "#93c5fd",
    marginTop: 4,
    letterSpacing: 0.3,
  },

  // Body typography
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.primary, marginTop: 20, marginBottom: 6 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.primary, marginTop: 16, marginBottom: 5 },
  h3: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.navy, marginTop: 12, marginBottom: 4 },
  bodyText: { fontSize: 10, lineHeight: 1.65, color: "#1e293b", marginBottom: 8 },

  // Section divider
  sectionDivider: {
    borderTop: `1.5px solid ${C.accent}`,
    marginTop: 28,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.accent,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 12,
  },

  // Table styles
  table: { width: "100%", marginTop: 4 },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: C.primary,
    borderRadius: 3,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 5,
  },
  tableRowAlt: {
    backgroundColor: C.light,
  },
  tableRowTopK: {
    backgroundColor: C.greenBg,
  },

  // Table column widths (total ≈ 100%)
  colRank:     { width: "5%",  paddingHorizontal: 4 },
  colTitle:    { width: "37%", paddingHorizontal: 4 },
  colYear:     { width: "8%",  paddingHorizontal: 4 },
  colCite:     { width: "10%", paddingHorizontal: 4 },
  colRel:      { width: "10%", paddingHorizontal: 4 },
  colCiteS:    { width: "10%", paddingHorizontal: 4 },
  colRecency:  { width: "10%", paddingHorizontal: 4 },
  colFinal:    { width: "10%", paddingHorizontal: 4 },

  thText: { fontSize: 7.5, color: C.white, fontFamily: "Helvetica-Bold" },
  tdText: { fontSize: 8,   color: "#1e293b" },
  tdTextMuted: { fontSize: 8, color: C.muted },
  tdTextAccent: { fontSize: 8, color: C.green, fontFamily: "Helvetica-Bold" },

  // Footer
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    borderTop: `1px solid ${C.border}`,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 8, color: C.muted },
});

function PaperTable({ papers, topK }: { papers: RankedPaper[]; topK: number }) {
  const cols = [
    { label: "#",        style: styles.colRank },
    { label: "Title",    style: styles.colTitle },
    { label: "Year",     style: styles.colYear },
    { label: "Citations",style: styles.colCite },
    { label: "Relevance",style: styles.colRel },
    { label: "Cit. Score",style: styles.colCiteS },
    { label: "Recency",  style: styles.colRecency },
    { label: "Final ▾",  style: styles.colFinal },
  ];

  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={styles.tableHeaderRow}>
        {cols.map((c) => (
          <View key={c.label} style={c.style}>
            <Text style={styles.thText}>{c.label}</Text>
          </View>
        ))}
      </View>

      {/* Rows */}
      {papers.map((p, idx) => {
        const isTopK = p.rank <= topK;
        const rowStyle = isTopK
          ? styles.tableRowTopK
          : idx % 2 === 1
          ? styles.tableRowAlt
          : undefined;

        return (
          <View
            key={`${p.rank}-${p.title}`}
            style={[styles.tableRow, rowStyle ?? {}]}
            wrap={false}
          >
            <View style={styles.colRank}>
              <Text style={isTopK ? styles.tdTextAccent : styles.tdTextMuted}>{p.rank}</Text>
            </View>
            <View style={styles.colTitle}>
              <Text style={[styles.tdText, { maxLines: 2 }]}>
                {p.title}
              </Text>
            </View>
            <View style={styles.colYear}>
              <Text style={styles.tdTextMuted}>{p.year ?? "—"}</Text>
            </View>
            <View style={styles.colCite}>
              <Text style={styles.tdTextMuted}>{p.citationCount}</Text>
            </View>
            <View style={styles.colRel}>
              <Text style={styles.tdTextMuted}>{p.simScore.toFixed(3)}</Text>
            </View>
            <View style={styles.colCiteS}>
              <Text style={styles.tdTextMuted}>{p.citationScore.toFixed(3)}</Text>
            </View>
            <View style={styles.colRecency}>
              <Text style={styles.tdTextMuted}>{p.recencyScore.toFixed(3)}</Text>
            </View>
            <View style={styles.colFinal}>
              <Text style={isTopK ? styles.tdTextAccent : styles.tdText}>
                {p.finalScore.toFixed(3)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function MarkdownTable({ data }: { data: string[][] }) {
  if (data.length === 0) return null;

  const headerRow = data[0]!;
  const bodyRows = data.slice(1);
  const colCount = headerRow.length;

  // Column widths tuned for landscape A4 (≈755pt usable width).
  // The comparison table the AI generates is always 6 cols:
  // [Rank] | Title | Authors & Year | Methodology | Key Findings | Strengths/Limitations
  let colWidths: string[];
  if (colCount === 6) {
    colWidths = ["5%", "18%", "13%", "21%", "22%", "21%"];
  } else if (colCount === 5) {
    colWidths = ["6%", "22%", "24%", "24%", "24%"];
  } else if (colCount === 4) {
    colWidths = ["8%", "30%", "32%", "30%"];
  } else if (colCount === 3) {
    colWidths = ["15%", "42%", "43%"];
  } else {
    colWidths = Array(colCount).fill(`${(100 / colCount).toFixed(1)}%`);
  }

  return (
    // No wrap on the outer view — rows wrap individually below
    <View style={styles.table}>
      {/* Header */}
      <View style={styles.tableHeaderRow}>
        {headerRow.map((cellText, idx) => (
          <View
            key={idx}
            style={{
              width: colWidths[idx] ?? `${100 / colCount}%`,
              paddingHorizontal: 4,
              paddingVertical: 5,
            }}
          >
            <Text style={styles.thText}>{cellText}</Text>
          </View>
        ))}
      </View>

      {/* Body rows — wrap=false keeps a single row together, but prose wraps inside the cell */}
      {bodyRows.map((row, rowIdx) => (
        <View
          key={rowIdx}
          style={[
            styles.tableRow,
            rowIdx % 2 === 1 ? styles.tableRowAlt : {},
          ]}
          wrap={false}
        >
          {row.map((cellText, colIdx) => (
            <View
              key={colIdx}
              style={{
                width: colWidths[colIdx] ?? `${100 / colCount}%`,
                paddingHorizontal: 4,
                paddingVertical: 5,
              }}
            >
              <Text style={{ fontSize: 7.5, color: "#1e293b", lineHeight: 1.5 }}>
                {stripMarkdown(cellText)}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function ReportBody({ markdown }: { markdown: string }) {
  const blocks = parseBlocks(markdown);

  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          const headStyle =
            block.level === 1 ? styles.h1 : block.level === 2 ? styles.h2 : styles.h3;
          return (
            <Text key={i} style={headStyle}>
              {block.text}
            </Text>
          );
        }
        if (block.type === "table") {
          return <MarkdownTable key={i} data={block.tableData!} />;
        }
        // Strip inline markdown tokens from body text before rendering
        const clean = stripMarkdown(block.text || "");
        if (!clean) return null;
        return (
          <Text key={i} style={styles.bodyText}>
            {clean}
          </Text>
        );
      })}
    </>
  );
}

function ResearchReportPDF({
  report,
  papers = [],
  topK = 10,
}: {
  report: string;
  papers?: RankedPaper[];
  topK?: number;
}) {
  const generatedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Use landscape when the AI report contains a markdown table so the wide
  // 6-column comparison table has enough horizontal space (~755pt vs ~500pt portrait).
  const hasMarkdownTable = /^\|.+\|/m.test(report);
  const pageSize = "A4";
  const orientation = hasMarkdownTable ? "landscape" : undefined;
  const pageStyle = hasMarkdownTable ? styles.pageLandscape : styles.page;

  return (
    <Document
      title="Scholarian Research Report"
      author="Scholarian"
      subject="AI-powered academic research report"
    >
      <Page size={pageSize} orientation={orientation} style={pageStyle}>
        {/* Header band */}
        <View style={styles.headerBand} fixed>
          <Text style={styles.headerTitle}>Scholarian Research Report</Text>
          <Text style={styles.headerSub}>Generated {generatedAt} · scholarian.vercel.app</Text>
        </View>

        {/* Report body — renders all blocks including MarkdownTable in order */}
        <ReportBody markdown={report} />

        {/* Papers score table appended after the report */}
        {papers.length > 0 && (
          <>
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionLabel}>Paper Comparison Table</Text>
            <Text style={[styles.bodyText, { marginBottom: 10, color: "#475569" }]}>
              All retrieved papers ranked by composite score. Green rows (rank ≤ {topK}) were used
              to generate this report.
            </Text>
            <PaperTable papers={papers} topK={topK} />
          </>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Scholarian · AI Research Assistant</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------
export function PDFDownloadButton({
  report,
  papers = [],
  topK = 10,
  isGenerating,
  variant = "default",
}: {
  report: string;
  papers?: RankedPaper[];
  topK?: number;
  isGenerating: boolean;
  variant?: "default" | "compact";
}) {
  // Show a disabled "Generating report…" state while the SSE stream is open
  if (isGenerating || !report) {
    if (variant === "compact") {
      return (
        <button
          type="button"
          disabled
          className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/50 cursor-not-allowed opacity-60"
        >
          <Loader2 className="size-3 animate-spin" />
          Generating…
        </button>
      );
    }
    return (
      <Button
        variant="outline"
        disabled
        className="h-10 border-secondary/10 bg-white text-secondary cursor-not-allowed opacity-60"
      >
        <Loader2 className="size-4 animate-spin" />
        {isGenerating ? "Generating report…" : "Download PDF"}
      </Button>
    );
  }

  const isComparison = papers.length === 0;

  return (
    <PDFDownloadLink
      document={<ResearchReportPDF report={report} papers={papers} topK={topK} />}
      fileName={isComparison ? "scholarian-comparison.pdf" : "scholarian-report.pdf"}
    >
      {({ loading }) => {
        if (variant === "compact") {
          return (
            <button
              type="button"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-white/30 disabled:opacity-60"
            >
              {loading ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
              {loading ? "Preparing…" : "Download PDF"}
            </button>
          );
        }
        return (
          <Button
            variant="outline"
            disabled={loading}
            className="h-10 border-secondary/10 bg-white text-primary hover:bg-surface"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Preparing PDF…
              </>
            ) : (
              <>
                <Download className="size-4" />
                Download PDF
              </>
            )}
          </Button>
        );
      }}
    </PDFDownloadLink>
  );
}
