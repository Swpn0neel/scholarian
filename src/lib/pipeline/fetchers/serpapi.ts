import type { RawPaper } from "@/types";

interface SerpOrganicResult {
  title?: string;
  snippet?: string;
  link?: string;
  publication_info?: {
    summary?: string;
    authors?: Array<{ name?: string }>;
  };
  inline_links?: {
    cited_by?: {
      total?: number;
    };
  };
}

const YEAR_PATTERN = /\b(19|20)\d{2}\b/;
const DOI_PATTERN = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;

export async function fetchSerpApiPapers(query: string, maxResults: number): Promise<RawPaper[]> {
  if (!process.env.SERPAPI_KEY) return [];

  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google_scholar");
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(Math.min(maxResults, 20)));
  url.searchParams.set("api_key", process.env.SERPAPI_KEY);

  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) return [];

  const body = (await response.json()) as { organic_results?: SerpOrganicResult[] };

  return (body.organic_results ?? []).map((result) => {
    const summary = result.publication_info?.summary ?? "";
    const link = result.link ?? null;

    return {
      title: result.title ?? "Untitled Google Scholar result",
      abstract: result.snippet ?? null,
      authors:
        result.publication_info?.authors
          ?.map((author) => author.name)
          .filter((author): author is string => Boolean(author)) ?? [],
      year: Number(summary.match(YEAR_PATTERN)?.[0]) || null,
      citationCount: result.inline_links?.cited_by?.total ?? 0,
      doi: link?.match(DOI_PATTERN)?.[0] ?? null,
      venue: summary || null,
      url: link,
      pdfUrl: null,
      source: "serpapi",
    };
  });
}
