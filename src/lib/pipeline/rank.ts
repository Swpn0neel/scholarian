import type { RankedPaper, RawPaper, ResearchSettings } from "@/types";
import {
  abstractQualityMultiplier,
  calculateDynamicParams,
  citationScore,
  cosineSim,
  recencyScore,
  sourceCredibilityMultiplier,
} from "./score";
import { embedText, embedTexts } from "./embed";

function normalizeWeights(settings: ResearchSettings) {
  const relevance = settings.weightRelevance;
  const citation  = settings.weightCitation;
  const recency   = settings.weightRecency;
  const total     = relevance + citation + recency || 1;

  return {
    relevance: relevance / total,
    citation:  citation  / total,
    recency:   recency   / total,
  };
}

export function hybridScore(
  simScore:  number,
  citScore:  number,
  recScore:  number,
  settings:  ResearchSettings,
  source:    string
): number {
  const weights = normalizeWeights(settings);

  // Weighted combination of the three normalised signals
  const rawScore =
    weights.relevance * simScore +
    weights.citation  * citScore +
    weights.recency   * recScore;

  // Ideas 3 & 4 — source credibility multiplier (includes multi-source bonus)
  const credibility = sourceCredibilityMultiplier(source);

  return Math.min(1, rawScore * credibility);
}

/**
 * Rank papers using real semantic embeddings for similarity scoring.
 *
 * Signal improvements over the baseline:
 *  - Idea 1: Abstract quality multiplier dampens short-snippet embeddings
 *  - Idea 2: Percentile-rank citation score (cohort-relative, preserves ordering)
 *  - Idea 3: Source credibility multiplier on the final composite score
 *  - Idea 4: Multi-source cross-indexing bonus baked into credibility
 *  - Idea 5: Exponential recency decay using a dynamic cohort half-life
 */
export async function rankPapers(
  papers:         RawPaper[],
  settings:       ResearchSettings,
  queryEmbedding: number[]
): Promise<RankedPaper[]> {
  // Build the text to embed for each paper: prefer abstract, fall back to title
  const paperTexts = papers.map((p) =>
    p.abstract ? `${p.title}. ${p.abstract}` : p.title
  );

  // Embed all papers in batches — embedTexts handles batching internally
  const paperEmbeddings = await embedTexts(paperTexts);

  const { citPerYearSorted, recencyHalfLife } = calculateDynamicParams(papers);

  return papers
    .map((paper, i) => {
      const embedding = paperEmbeddings[i] ?? [];

      // Raw cosine similarity against the query vector
      const rawSim = queryEmbedding.length > 0 && embedding.length > 0
        ? cosineSim(queryEmbedding, embedding)
        : 0.5;

      // Idea 1 — scale similarity by how representative the embedded text is
      const qualityMult = abstractQualityMultiplier(paper.abstract);
      const simScore    = rawSim * qualityMult;

      // Idea 2 — cohort percentile-rank citation score
      const citScore = citationScore(paper.citationCount, paper.year, citPerYearSorted);

      // Idea 5 — exponential recency decay with dynamic half-life
      const recScore = recencyScore(paper.year, recencyHalfLife);

      // Ideas 3 & 4 baked into hybridScore via sourceCredibilityMultiplier
      const finalScore = hybridScore(simScore, citScore, recScore, settings, paper.source);

      return {
        ...paper,
        simScore,
        citationScore: citScore,
        recencyScore:  recScore,
        finalScore,
        rank:          0,
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
  papers:              RawPaper[],
  settings:            ResearchSettings,
  similarityForPaper:  (paper: RawPaper) => number = () => 0.5
): RankedPaper[] {
  const { citPerYearSorted, recencyHalfLife } = calculateDynamicParams(papers);

  return papers
    .map((paper) => {
      const rawSim      = similarityForPaper(paper);
      const qualityMult = abstractQualityMultiplier(paper.abstract);
      const simScore    = rawSim * qualityMult;
      const citScore    = citationScore(paper.citationCount, paper.year, citPerYearSorted);
      const recScore    = recencyScore(paper.year, recencyHalfLife);
      const finalScore  = hybridScore(simScore, citScore, recScore, settings, paper.source);

      return {
        ...paper,
        simScore,
        citationScore: citScore,
        recencyScore:  recScore,
        finalScore,
        rank:          0,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .map((paper, index) => ({ ...paper, rank: index + 1 }));
}

/** Embed a query string for use with rankPapers. */
export { embedText as embedQuery };
