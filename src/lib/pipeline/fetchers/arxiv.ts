import type { RawPaper } from "@/types";

// Server-safe XML text extractor — no DOMParser (browser-only API)
function extractTagText(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].replace(/\s+/g, " ").trim() : null;
}

function extractAllBlocks(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    results.push(match[1].replace(/\s+/g, " ").trim());
  }
  return results;
}

export async function fetchArxivPapers(query: string, maxResults: number): Promise<RawPaper[]> {
  const url = new URL("https://export.arxiv.org/api/query");
  url.searchParams.set("search_query", `all:${query}`);
  url.searchParams.set("max_results", String(maxResults));

  const response = await fetch(url, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return [];

  const xml = await response.text();

  // Split on <entry> blocks
  const entryPattern = /<entry>([\s\S]*?)<\/entry>/gi;
  const papers: RawPaper[] = [];
  let match: RegExpExecArray | null;

  while ((match = entryPattern.exec(xml)) !== null) {
    const entry = match[1];

    const title = extractTagText(entry, "title");
    const summary = extractTagText(entry, "summary");
    const idRaw = extractTagText(entry, "id");
    const published = extractTagText(entry, "published");

    // Authors: collect all <name> within <author> blocks
    const authorBlocks = extractAllBlocks(entry, "author");
    const authors = authorBlocks
      .map((block) => extractTagText(block, "name"))
      .filter((name): name is string => Boolean(name));

    // PDF link: <link title="pdf" href="..."/>
    const pdfMatch = entry.match(/<link[^>]+title="pdf"[^>]+href="([^"]+)"/i)
      ?? entry.match(/<link[^>]+href="([^"]+)"[^>]+title="pdf"/i);
    const pdfUrl = pdfMatch?.[1] ?? null;

    // The <id> field is the canonical arXiv URL like http://arxiv.org/abs/2301.12345v1
    const arxivId = idRaw?.split("/abs/").at(1) ?? null;

    papers.push({
      title: title ?? "Untitled arXiv paper",
      abstract: summary,
      authors,
      year: published ? new Date(published).getFullYear() : null,
      citationCount: 0,
      // arXiv IDs are NOT DOIs — store null so deduplication doesn't confuse
      // arXiv IDs with real DOIs from Semantic Scholar. The canonical URL is
      // preserved in the `url` field for linking purposes.
      doi: null,
      venue: "arXiv",
      url: idRaw,
      pdfUrl,
      source: "arxiv",
    });
  }

  return papers;
}
