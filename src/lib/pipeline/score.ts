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

// ─── Fallback defaults (used when no cohort data is available) ────────────────
const DEFAULT_RECENCY_WINDOW_YEARS = 12;
const DEFAULT_RECENCY_HALF_LIFE = 5;      // years at which recency score = 0.5

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

// ─── Idea 2: Percentile-rank citation score ───────────────────────────────────
/**
 * Scores a paper by its cohort percentile rank on citations-per-year.
 *
 * Instead of a hard cap that collapses high-citation outliers to the same
 * score as moderately-cited papers, this converts each paper's cit/yr into
 * its fractional rank within the sorted cohort array:
 *
 *   score = (number of cohort papers with lower cit/yr) / total_papers
 *
 * A paper at the 95th percentile scores 0.95; the median paper scores 0.50.
 * This preserves full ordering information while remaining cohort-relative.
 *
 * @param citationCount  Raw citation count for the paper
 * @param year           Publication year (null → treated as age 1)
 * @param citPerYearSorted  Sorted ascending array of cit/yr for the whole cohort
 */
export function citationScore(
  citationCount: number,
  year: number | null,
  citPerYearSorted: number[]
): number {
  if (citPerYearSorted.length === 0) return 0;

  const currentYear = new Date().getFullYear();
  const ageFactor   = year ? Math.max(1, currentYear - year) : 1;
  const citPerYear  = citationCount / ageFactor;

  // Count how many cohort papers have strictly lower cit/yr
  let rank = 0;
  for (const v of citPerYearSorted) {
    if (v < citPerYear) rank++;
    else break; // array is sorted
  }

  return rank / citPerYearSorted.length;
}

// ─── Idea 5: Exponential recency decay ───────────────────────────────────────
/**
 * Computes an exponential decay score using a dynamic half-life.
 * A paper published exactly `halfLife` years ago receives a score of 0.5.
 * Papers published in the current year receive ≈ 1.0; future-dated → capped 1.0.
 */
export function recencyScore(
  year: number | null,
  halfLife = DEFAULT_RECENCY_HALF_LIFE
): number {
  if (!year) return 0;
  const age = new Date().getFullYear() - year;
  if (age < 0) return 1.0;                          // future-dated → max
  const lambda = Math.LN2 / halfLife;
  return Math.exp(-lambda * age);
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
 * Derives all dynamic scoring parameters from the fetched paper cohort:
 *  - citPerYearSorted:  ascending sorted array of cit/yr (used for percentile rank)
 *  - recencyWindow:     span from oldest paper to today  (clamped 3 – 25 yr)
 *  - recencyHalfLife:   half of recencyWindow            (clamped 2 – 12 yr)
 */
export function calculateDynamicParams(
  papers: Array<{ citationCount: number; year: number | null }>
): { citPerYearSorted: number[]; recencyWindow: number; recencyHalfLife: number } {
  if (papers.length === 0) {
    return {
      citPerYearSorted: [],
      recencyWindow:    DEFAULT_RECENCY_WINDOW_YEARS,
      recencyHalfLife:  DEFAULT_RECENCY_HALF_LIFE,
    };
  }

  const currentYear = new Date().getFullYear();

  // Idea 2 — sorted cit/yr array for percentile rank scoring
  const citPerYearSorted = papers
    .map((p) => {
      const ageFactor = p.year ? Math.max(1, currentYear - p.year) : 1;
      return p.citationCount / ageFactor;
    })
    .sort((a, b) => a - b);

  // Idea 5 — dynamic recency window from cohort age span
  const years = papers
    .map((p) => p.year)
    .filter((y): y is number => typeof y === "number" && y > 0);

  let recencyWindow = DEFAULT_RECENCY_WINDOW_YEARS;
  if (years.length > 0) {
    const minYear = Math.min(...years);
    recencyWindow = Math.max(3, Math.min(25, currentYear - minYear));
  }

  // Dynamic half-life = half the window, clamped between 2 and 12 years
  const recencyHalfLife = Math.max(2, Math.min(12, recencyWindow / 2));

  return { citPerYearSorted, recencyWindow, recencyHalfLife };
}
