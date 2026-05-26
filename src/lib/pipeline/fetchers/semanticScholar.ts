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
  const headers = hasRealKey ? { "x-api-key": ssKey! } : undefined;

  // Retry once on 429 (rate limit) with a short backoff.
  // Without an API key the public tier allows ~1 req/sec; a single retry
  // after 2 s is usually enough to recover from a transient throttle.
  let response!: Response;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetch(url, {
        headers,
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(10000),
      });
    } catch (err) {
      // Timeout or network error — bail out immediately
      console.warn("Semantic Scholar fetch failed:", err instanceof Error ? err.message : err);
      return [];
    }

    if (response.status !== 429) break;
    if (attempt === 0) await new Promise((r) => setTimeout(r, 2000));
  }

  if (!response.ok) {
    console.warn(`Semantic Scholar API returned ${response.status}: ${response.statusText}`);
    return [];
  }

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
