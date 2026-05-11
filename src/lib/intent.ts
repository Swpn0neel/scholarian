import type { IntentResult } from "@/types";

// Detects: "compare report 1 with report 2", "compare run 3 and report 1", etc.
const COMPARE_RE = /compare\s+(?:report|run)\s*(\d+)\s+(?:with|and|to|vs\.?)\s+(?:report|run)\s*(\d+)/i;

export async function classifyIntent(message: string): Promise<IntentResult> {
  const normalized = message.trim().toLowerCase();

  // Check compare first (most specific)
  const compareMatch = COMPARE_RE.exec(message);
  if (compareMatch) {
    return {
      intent: "compare",
      payload: `${compareMatch[1]},${compareMatch[2]}`,
    };
  }

  if (["accept", "finalize", "looks good", "done", "lock"].some((t) => normalized.includes(t))) {
    return { intent: "accept", payload: message };
  }

  if (
    ["narrow", "broaden", "refine", "instead", "exclude", "more papers", "focus on", "add more", "change topic"].some(
      (t) => normalized.includes(t)
    )
  ) {
    return { intent: "refine", payload: message };
  }

  return { intent: "ask", payload: message };
}
