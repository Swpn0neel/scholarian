export function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    magA += a[index] * a[index];
    magB += b[index] * b[index];
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function citationScore(citationCount: number, cap = Number(process.env.CITATION_CAP ?? 1000)): number {
  return Math.min(1, Math.log(1 + Math.max(0, citationCount)) / Math.log(1 + cap));
}

export function recencyScore(
  year: number | null,
  windowYears = Number(process.env.RECENCY_WINDOW_YEARS ?? 12)
): number {
  if (!year) return 0;
  const currentYear = new Date().getFullYear();
  return Math.max(0, 1 - (currentYear - year) / windowYears);
}
