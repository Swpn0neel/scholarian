import type { RankedPaper, RawPaper, ResearchSettings } from "@/types";
import { citationScore, recencyScore } from "./score";

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

export function rankPapers(
  papers: RawPaper[],
  settings: ResearchSettings,
  similarityForPaper: (paper: RawPaper) => number = () => 0.72
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
