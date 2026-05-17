import type { RankedPaper, RawPaper, ResearchSettings } from "@/types";
import { citationScore, cosineSim, recencyScore } from "./score";
import { embedText, embedTexts } from "./embed";

function normalizeWeights(settings: ResearchSettings) {
  const relevance = settings.weightRelevance;
  const citation = settings.weightCitation;
  const recency = settings.weightRecency;
  const total = relevance + citation + recency || 1;

  return {
    relevance: relevance / total,
    citation: citation / total,
    recency: recency / total,
  };
}

export function hybridScore(
  simScore: number,
  citScore: number,
  recScore: number,
  settings: ResearchSettings
): number {
  const weights = normalizeWeights(settings);
  return weights.relevance * simScore + weights.citation * citScore + weights.recency * recScore;
}

/**
 * Rank papers using real semantic embeddings for similarity scoring.
 *
 * Each paper's abstract (or title as fallback) is embedded and compared
 * against the query embedding via cosine similarity. This replaces the
 * previous hardcoded 0.72 constant that made the relevance weight meaningless.
 */
export async function rankPapers(
  papers: RawPaper[],
  settings: ResearchSettings,
  queryEmbedding: number[]
): Promise<RankedPaper[]> {
  // Build the text to embed for each paper: prefer abstract, fall back to title
  const paperTexts = papers.map((p) =>
    p.abstract ? `${p.title}. ${p.abstract}` : p.title
  );

  // Embed all papers in batches — embedTexts handles batching internally
  const paperEmbeddings = await embedTexts(paperTexts);

  return papers
    .map((paper, i) => {
      const embedding = paperEmbeddings[i] ?? [];
      const simScore = queryEmbedding.length > 0 && embedding.length > 0
        ? cosineSim(queryEmbedding, embedding)
        : 0.5; // neutral fallback if embeddings unavailable
      const citScore = citationScore(paper.citationCount);
      const recScore = recencyScore(paper.year);
      return {
        ...paper,
        simScore,
        citationScore: citScore,
        recencyScore: recScore,
        finalScore: hybridScore(simScore, citScore, recScore, settings),
        rank: 0,
        embedding,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .map((paper, index) => ({ ...paper, rank: index + 1 }));
}

/**
 * Synchronous rank for cases where embeddings are already computed
 * (e.g. restoring from DB or testing).
 */
export function rankPapersSync(
  papers: RawPaper[],
  settings: ResearchSettings,
  similarityForPaper: (paper: RawPaper) => number = () => 0.5
): RankedPaper[] {
  return papers
    .map((paper) => {
      const simScore = similarityForPaper(paper);
      const citScore = citationScore(paper.citationCount);
      const recScore = recencyScore(paper.year);
      return {
        ...paper,
        simScore,
        citationScore: citScore,
        recencyScore: recScore,
        finalScore: hybridScore(simScore, citScore, recScore, settings),
        rank: 0,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .map((paper, index) => ({ ...paper, rank: index + 1 }));
}

/** Embed a query string for use with rankPapers. */
export { embedText as embedQuery };
