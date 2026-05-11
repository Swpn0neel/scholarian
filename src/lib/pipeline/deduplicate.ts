import type { RawPaper } from "@/types";

function normalizeDoi(doi: string | null) {
  return doi?.toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "").trim() ?? null;
}

function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

function mergePaper(a: RawPaper, b: RawPaper): RawPaper {
  const sourceSet = new Set(`${a.source},${b.source}`.split(",").map((source) => source.trim()).filter(Boolean));

  return {
    title: a.title || b.title,
    abstract: a.abstract ?? b.abstract,
    authors: a.authors.length >= b.authors.length ? a.authors : b.authors,
    year: a.year ?? b.year,
    citationCount: Math.max(a.citationCount, b.citationCount),
    doi: a.doi ?? b.doi,
    venue: a.venue ?? b.venue,
    url: a.url ?? b.url,
    pdfUrl: a.pdfUrl ?? b.pdfUrl,
    source: Array.from(sourceSet).join(","),
  };
}

export function deduplicatePapers(input: RawPaper[]): RawPaper[] {
  const byDoi = new Map<string, RawPaper>();
  const withoutDoi: RawPaper[] = [];

  for (const paper of input) {
    const doi = normalizeDoi(paper.doi);
    if (!doi) {
      withoutDoi.push(paper);
      continue;
    }

    byDoi.set(doi, byDoi.has(doi) ? mergePaper(byDoi.get(doi)!, paper) : paper);
  }

  const byTitleYear = new Map<string, RawPaper>();

  for (const paper of [...byDoi.values(), ...withoutDoi]) {
    const key = `${normalizeTitle(paper.title)}|${paper.year ?? "unknown"}`;
    byTitleYear.set(key, byTitleYear.has(key) ? mergePaper(byTitleYear.get(key)!, paper) : paper);
  }

  return [...byTitleYear.values()];
}
