import type { IntentResult } from "@/types";
import { executeWithGeminiFallback } from "@/lib/pipeline/gemini";

// Detects: "compare report 1 with report 2", "compare run 3 and report 1", etc.
// Flexible to support missing labels on the second report, plural forms, and various connectors (and, with, to, vs, &, comma).
const COMPARE_RE = /compare\s+(?:reports?|runs?|numbers?|no\.?)?\s*(\d+)\s*(?:with|and|to|vs\.?|&|,)\s*(?:reports?|runs?|numbers?|no\.?)?\s*(\d+)/i;

// Detects: "generate me the report of paper number 2,6 and 7", "create report for paper 1, 3", etc.
const GENERATE_CUSTOM_RE = /(?:generate|create|make|write|give|custom|targeted)(?:\s+(?:me|us|a|the|custom|targeted))*\s+report\s+(?:for|of|on|from|about)\s+(?:paper[s]?|number[s]?|no\.?|[\s#])*\s*([\d\s,and&]+)/i;

export async function classifyIntent(message: string): Promise<IntentResult> {
  const normalized = message.trim().toLowerCase();

  // 1. Try Gemini first (Smart path, handles semantic variations perfectly)
  try {
    const prompt = `You are a user intent classifier for an academic research dashboard.
Your task is to analyze the user's message and categorize it into one of these five intents:

1. "compare"
   - Description: The user wants to compare two research reports, runs, or results.
   - Example user messages:
     - "compare report 1 with 2"
     - "do a comparison of 3 and 1"
     - "how does run 2 compare to 1"
     - "compare the first and second results"
     - "compare 1 vs 2"
     - "run comparison for 2 and 3"
   - Payload: Extract the two report/run numbers as a comma-separated list of integers, in order (e.g., "1,2" or "3,1"). If they refer to ordinal numbers ("first", "second"), convert them to digits ("1", "2").

2. "generate_custom_report"
   - Description: The user wants to build a targeted report from specific paper numbers in their list.
   - Example user messages:
     - "make a report for papers 1, 3 and 4"
     - "write a report on papers 2 and 5"
     - "custom report on 1,2"
   - Payload: Extract the paper numbers as a comma-separated list of integers (e.g., "1,3,4" or "2,5").

3. "accept"
   - Description: The user wants to finalize the session, accept the results, or lock the report.
   - Example user messages:
     - "looks good"
     - "lock this session"
     - "finalize report"
     - "accept selection"
     - "everything looks great, finish"
   - Payload: The original user message.

4. "refine"
   - Description: The user wants to update the search topic, refine, broaden, or narrow the search query/results.
   - Example user messages:
     - "add papers about DNA encryption"
     - "narrow the topic to medical scanning"
     - "focus on blockchain instead"
     - "re-run with deep learning"
     - "search for quantum computing"
   - Payload: The original user message.

5. "ask"
   - Description: The user is asking a general question, academic question, or inquiring about the papers, the report, or research.
   - Example user messages:
     - "what is the methodology of paper 2?"
     - "explain blockchain"
     - "why is paper 1 ranked higher?"
     - "tell me more about quantum key distribution"
   - Payload: The original user message.

User Message: "${message}"

Respond ONLY with a JSON object in this exact schema:
{
  "intent": "compare" | "generate_custom_report" | "accept" | "refine" | "ask",
  "payload": "string"
}`;

    const text = await executeWithGeminiFallback(async (model) => {
      const res = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      });
      return res.response.text().trim();
    }, "gemini-2.5-flash-lite");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as IntentResult;
      if (["compare", "generate_custom_report", "accept", "refine", "ask"].includes(parsed.intent)) {
        console.log(`[Intent Classification] Gemini classified: "${message}" -> intent: ${parsed.intent}, payload: ${parsed.payload}`);
        return parsed;
      }
    }
  } catch (error) {
    console.warn("[Intent Classification] Gemini primary classification failed, falling back to local patterns:", error);
  }

  // 2. Fallback: Fast regex and local heuristics (if Gemini is offline or fails)

  // A. Check compare regex
  const compareMatch = COMPARE_RE.exec(message);
  if (compareMatch) {
    return {
      intent: "compare",
      payload: `${compareMatch[1]},${compareMatch[2]}`,
    };
  }

  // B. Check comparison heuristic (e.g. "compare 1 and 2")
  if (normalized.includes("compare") || normalized.includes("comparison")) {
    const numbers = normalized.match(/\d+/g);
    if (numbers && numbers.length >= 2) {
      return {
        intent: "compare",
        payload: `${numbers[0]},${numbers[1]}`,
      };
    }
  }

  // C. Check custom report generation regex
  const customMatch = GENERATE_CUSTOM_RE.exec(message);
  if (customMatch) {
    return {
      intent: "generate_custom_report",
      payload: customMatch[1],
    };
  }

  // D. Check accept heuristic
  if (["accept", "finalize", "looks good", "lock", "lock session", "finalize session", "done", "finish"].some((t) => normalized.includes(t))) {
    return { intent: "accept", payload: message };
  }

  // E. Check refinement heuristic
  if (
    [
      "narrow", "broaden", "refine", "instead", "exclude", "more papers", "focus on",
      "add more", "change topic", "add papers", "adding papers", "include papers",
      "search for", "filter by", "filter out", "remove papers", "only papers",
      "search query", "new topic", "update topic", "change query", "run query"
    ].some((t) => normalized.includes(t))
  ) {
    return { intent: "refine", payload: message };
  }

  // F. Default to Q&A
  return { intent: "ask", payload: message };
}
