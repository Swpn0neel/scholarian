export type PipelineStep =
  | "idle"
  | "fetching"
  | "deduplicating"
  | "embedding"
  | "scoring"
  | "ranked"
  | "generating_report"
  | "report_ready"
  | "answering"
  | "finalized"
  | "error";

export interface ResearchSettings {
  topic: string;
  maxPapers: number;
  topK: number;
  weightRelevance: number;
  weightCitation: number;
  weightRecency: number;
  enhanceQuery?: boolean;
  enhanceReport?: boolean;
  /** Smart Mode: intelligently re-queries until maxPapers relevant results are found. */
  autoMode?: boolean;
}

export interface Chat {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface RawPaper {
  title: string;
  abstract: string | null;
  authors: string[];
  year: number | null;
  citationCount: number;
  doi: string | null;
  venue: string | null;
  url: string | null;
  pdfUrl: string | null;
  source: "arxiv" | "semantic_scholar" | "serpapi" | string;
}

export interface RankedPaper extends RawPaper {
  id?: string;
  runId?: string;
  embedding?: number[];
  simScore: number;
  citationScore: number;
  recencyScore: number;
  finalScore: number;
  rank: number;
}

export interface Report {
  id: string;
  run_id: string;
  chat_id: string;
  content_md: string;
  type?: "research" | "comparison";
  created_at: string;
}

export type Intent = "refine" | "ask" | "accept" | "compare" | "generate_custom_report";

export interface IntentResult {
  intent: Intent;
  payload: string;
}

export const DEFAULT_RESEARCH_SETTINGS: ResearchSettings = {
  topic: "",
  maxPapers: 20,
  topK: 3,
  weightRelevance: 0.5,
  weightCitation: 0.3,
  weightRecency: 0.2,
  enhanceQuery: false,
  enhanceReport: false,
  autoMode: false,
};
