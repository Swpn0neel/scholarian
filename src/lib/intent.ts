import type { IntentResult } from "@/types";

// Detects: "compare report 1 with report 2", "compare run 3 and report 1", etc.
const COMPARE_RE = /compare\s+(?:report|run)\s*(\d+)\s+(?:with|and|to|vs\.?)\s+(?:report|run)\s*(\d+)/i;

// Detects: "generate me the report of paper number 2,6 and 7", "create report for paper 1, 3", etc.
const GENERATE_CUSTOM_RE = /(?:generate|create|make|write|give)(?:\s+(?:me|us|a|the))*\s+report\s+(?:for|of|on|from)\s+(?:paper[s]?|number[s]?|no\.?|[\s#])*\s*([\d\s,and&]+)/i;

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

  // Check custom report generation
  const customMatch = GENERATE_CUSTOM_RE.exec(message);
  if (customMatch) {
    return {
      intent: "generate_custom_report",
      payload: customMatch[1],
    };
  }

  if (["accept", "finalize", "looks good", "lock", "lock session", "finalize session"].some((t) => normalized.includes(t))) {
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
