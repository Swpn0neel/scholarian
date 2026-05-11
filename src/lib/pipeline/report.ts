import type { RankedPaper } from "@/types";

export function buildReportPrompt(papers: RankedPaper[]) {
  return papers
    .slice(0, 20)
    .map((paper) => {
      return [
        `[${paper.rank}] ${paper.title}`,
        `Authors: ${paper.authors.join(", ") || "Unknown"}`,
        `Year: ${paper.year ?? "Unknown"}`,
        `Venue: ${paper.venue ?? "Unknown"}`,
        `Citations: ${paper.citationCount}`,
        `Abstract: ${paper.abstract ?? "No abstract available."}`,
      ].join("\n");
    })
    .join("\n\n");
}

export function fallbackMarkdownReport(topic: string, papers: RankedPaper[]) {
  const references = papers
    .slice(0, 10)
    .map((paper) => `${paper.rank}. ${paper.title}${paper.year ? ` (${paper.year})` : ""}`)
    .join("\n");

  return `# Scholarian Research Report

## Executive Summary
This draft report summarizes the top ranked papers for "${topic}". Connect Gemini to replace this local draft with a streamed grounded synthesis.

## Background & Core Concepts
The selected set emphasizes semantic relevance, citation strength, and recency using the configured hybrid weights.

## Comparative Analysis
| Rank | Paper | Year | Citations | Final Score |
| --- | --- | --- | ---: | ---: |
${papers
  .slice(0, 10)
  .map((paper) => `| ${paper.rank} | ${paper.title} | ${paper.year ?? "n/a"} | ${paper.citationCount} | ${paper.finalScore.toFixed(3)} |`)
  .join("\n")}

## Gap Analysis
Evidence gaps should be reviewed after live source fetching and LLM synthesis are enabled.

## Future Research Directions
Use refinement feedback to narrow the topic, exclude already-used papers, and re-run the pipeline.

## Risks & Limitations
This fallback report is generated without a live Gemini report call.

## Conclusion
The dashboard foundation is ready for live provider credentials and Supabase persistence.

## References
${references}
`;
}
