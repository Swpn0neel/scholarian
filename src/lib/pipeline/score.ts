/**
 * Scoring utilities for the Scholarian ranking pipeline.
 *
 * Implements a multi-signal hybrid scoring system:
 *  - Idea 1: Abstract quality multiplier applied to semantic similarity
 *  - Idea 2: Percentile-rank citation scoring (cohort-relative)
 *  - Idea 3: Source credibility multiplier on the final score
 *  - Idea 4: Multi-source cross-indexing boost
 *  - Idea 5: Exponential recency decay with a dynamic half-life
 */


// ─── Source credibility weights ───────────────────────────────────────────────
const SOURCE_CREDIBILITY: Record<string, number> = {
  semantic_scholar: 1.00,
  arxiv:            0.95,
  serpapi:          0.90,
};

// ─── Helper: cosine similarity ────────────────────────────────────────────────
export function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot  += a[index] * b[index];
    magA += a[index] * a[index];
    magB += b[index] * b[index];
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ─── Idea 1: Abstract quality multiplier ─────────────────────────────────────
/**
 * Returns a soft multiplier [0.65, 1.0] reflecting how complete the text
 * fed into the embedding is.  Longer, richer abstracts produce more
 * representative vectors; short snippets or title-only fallbacks skew scores.
 */
export function abstractQualityMultiplier(abstract: string | null): number {
  if (!abstract) return 0.65;
  const wordCount = abstract.trim().split(/\s+/).length;
  if (wordCount >= 100) return 1.0;
  if (wordCount >= 50)  return 0.85;
  return 0.65;
}

// ─── Idea 2: Logarithmic citation score ───────────────────────────────────────
/**
 * Scores a paper using a simple logarithmic function without a hard cap.
 * It is normalised against the max citations-per-year in the current cohort
 * to keep the output roughly in the [0, 1] range.
 *
 * @param citationCount  Raw citation count for the paper
 * @param year           Publication year (null → treated as age 1)
 * @param maxCitPerYearInCohort The max citations-per-year in the fetched pool
 */
export function citationScore(
  citationCount: number,
  year: number | null,
  maxCitPerYearInCohort: number
): number {
  const currentYear = new Date().getFullYear();
  const ageFactor   = year ? Math.max(1, currentYear - year) : 1;
  const citPerYear  = citationCount / ageFactor;

  if (maxCitPerYearInCohort <= 0) return 0;
  return Math.log1p(citPerYear) / Math.log1p(maxCitPerYearInCohort);
}

// ─── Idea 5: Simple logarithmic recency decay ────────────────────────────────
/**
 * Computes a recency score using simple inverse logarithmic decay without a hard cap.
 * Age 0 receives 1.0. Older papers gracefully decay towards 0 over time.
 */
export function recencyScore(
  year: number | null
): number {
  if (!year) return 0;
  const age = Math.max(0, new Date().getFullYear() - year);
  return 1 / Math.log2(2 + age);
}

// ─── Ideas 3 & 4: Source credibility + multi-source boost ────────────────────
/**
 * Returns a combined credibility score for a paper's `source` field.
 *
 * Idea 3 — each recognised source has a credibility weight.
 * Idea 4 — papers indexed by more than one source receive an additive bonus
 *           (the `source` field stores comma-joined names after deduplication).
 *
 * The output may slightly exceed 1.0 (e.g. all-three sources → ~1.05);
 * callers should clamp the final score to [0, 1].
 */
export function sourceCredibilityMultiplier(source: string): number {
  const sources = source.split(",").map((s) => s.trim()).filter(Boolean);

  const avgCredibility =
    sources.reduce((sum, s) => sum + (SOURCE_CREDIBILITY[s] ?? 0.90), 0) /
    Math.max(1, sources.length);

  // Multi-source cross-indexing bonus (idea 4)
  const multiBonus =
    sources.length === 2 ? 0.04 :
    sources.length >= 3 ? 0.08 : 0.0;

  return avgCredibility + multiBonus;
}

// ─── Dynamic parameter calculation ───────────────────────────────────────────
/**
 * Calculates the maximum citations-per-year in the cohort.
 */
export function calculateMaxCitPerYear(
  papers: Array<{ citationCount: number; year: number | null }>
): number {
  const currentYear = new Date().getFullYear();
  return papers.reduce((max, p) => {
    const ageFactor = p.year ? Math.max(1, currentYear - p.year) : 1;
    const citPerYear = p.citationCount / ageFactor;
    return Math.max(max, citPerYear);
  }, 0);
}
