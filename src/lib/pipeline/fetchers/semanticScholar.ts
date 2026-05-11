import type { RawPaper } from "@/types";

interface SemanticScholarPaper {
  title?: string;
  abstract?: string | null;
  authors?: Array<{ name?: string }>;
  year?: number | null;
  citationCount?: number;
  externalIds?: { DOI?: string };
  venue?: string | null;
  url?: string | null;
  openAccessPdf?: { url?: string | null } | null;
}

export async function fetchSemanticScholarPapers(query: string, limit: number): Promise<RawPaper[]> {
  const url = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(Math.min(limit, 100)));
  url.searchParams.set(
    "fields",
    "title,abstract,authors,year,citationCount,externalIds,venue,url,openAccessPdf"
  );

  const ssKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  const hasRealKey = Boolean(ssKey) && !ssKey?.toLowerCase().startsWith("your-");

  const response = await fetch(url, {
    headers: hasRealKey ? { "x-api-key": ssKey! } : undefined,
    next: { revalidate: 3600 },
  });

  if (!response.ok) return [];

  const body = (await response.json()) as { data?: SemanticScholarPaper[] };
  return (body.data ?? []).map((paper) => ({
    title: paper.title ?? "Untitled Semantic Scholar paper",
    abstract: paper.abstract ?? null,
    authors: paper.authors?.map((author) => author.name).filter((author): author is string => Boolean(author)) ?? [],
    year: paper.year ?? null,
    citationCount: paper.citationCount ?? 0,
    doi: paper.externalIds?.DOI ?? null,
    venue: paper.venue ?? null,
    url: paper.url ?? null,
    pdfUrl: paper.openAccessPdf?.url ?? null,
    source: "semantic_scholar",
  }));
}
