import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Helper to map DB paper rows (snake_case, nullable) to clean camelCase RankedPaper objects.
// Numeric score fields default to 0 so .toFixed() never crashes on null/undefined values.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapDbPaper = (p: Record<string, any>) => ({
  title: p.title as string,
  abstract: (p.abstract ?? null) as string | null,
  authors: (p.authors ?? []) as string[],
  year: (p.year ?? null) as number | null,
  citationCount: ((p.citation_count ?? p.citationCount) ?? 0) as number,
  doi: (p.doi ?? null) as string | null,
  venue: (p.venue ?? null) as string | null,
  url: (p.url ?? null) as string | null,
  pdfUrl: ((p.pdf_url ?? p.pdfUrl) ?? null) as string | null,
  source: (p.source ?? "") as string,
  simScore: ((p.sim_score ?? p.simScore) ?? 0) as number,
  citationScore: ((p.citation_score ?? p.citationScore) ?? 0) as number,
  recencyScore: ((p.recency_score ?? p.recencyScore) ?? 0) as number,
  finalScore: ((p.final_score ?? p.finalScore) ?? 0) as number,
  rank: (p.rank ?? 0) as number,
});

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id: chatId } = await props.params;
  const supabase = await createServerSupabaseClient();

  // Fetch the chat record
  const { data: chat } = await supabase
    .from("chats")
    .select("title")
    .eq("id", chatId)
    .single();

  // Fetch ALL papers for this chat (all runs), ordered chronologically
  const { data: allPapers } = await supabase
    .from("papers")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  // Fetch ALL reports for this chat, ordered chronologically
  const { data: allReports } = await supabase
    .from("reports")
    .select("run_id, content_md, created_at")
    .eq("chat_id", chatId)
    .not("type", "eq", "comparison") // skip comparison reports
    .order("created_at", { ascending: true });

  // Fetch run metadata (settings + events) for all runs in this chat
  const { data: allMetadata } = await supabase
    .from("run_metadata")
    .select("run_id, topic, max_papers, top_k, weight_relevance, weight_citation, weight_recency, events")
    .eq("chat_id", chatId);

  // Fetch Q&A messages
  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  // Group papers by run_id, preserving insertion order
  const runOrder: string[] = [];
  const papersByRunId: Record<string, typeof allPapers> = {};
  for (const paper of allPapers ?? []) {
    if (!papersByRunId[paper.run_id]) {
      runOrder.push(paper.run_id);
      papersByRunId[paper.run_id] = [];
    }
    papersByRunId[paper.run_id]!.push(paper);
  }

  // Map reports to run_ids
  const reportByRunId: Record<string, string> = {};
  for (const report of allReports ?? []) {
    if (report.run_id) reportByRunId[report.run_id] = report.content_md;
  }

  // Map run_metadata (settings + events) to run_ids
  const metaByRunId: Record<string, {
    settings: { topic: string; maxPapers: number; topK: number; weightRelevance: number; weightCitation: number; weightRecency: number };
    events: Array<{ step: string; message: string; ts: number }>;
  }> = {};
  for (const m of allMetadata ?? []) {
    metaByRunId[m.run_id] = {
      settings: {
        topic: m.topic ?? "",
        maxPapers: m.max_papers ?? 50,
        topK: m.top_k ?? 5,
        weightRelevance: m.weight_relevance ?? 0.5,
        weightCitation: m.weight_citation ?? 0.3,
        weightRecency: m.weight_recency ?? 0.2,
      },
      events: (m.events as Array<{ step: string; message: string; ts: number }>) ?? [],
    };
  }

  // Supplement runOrder with any run_ids that exist in run_metadata or reports
  // but NOT in papers — this recovers old chats where papers failed to save (e.g.
  // due to the camelCase column bug that has since been fixed). The run will render
  // with an empty papers list but its report and messages will still be restored.
  const runOrderSet = new Set(runOrder);
  for (const runId of Object.keys(metaByRunId)) {
    if (!runOrderSet.has(runId)) {
      runOrder.push(runId);
      runOrderSet.add(runId);
    }
  }
  for (const runId of Object.keys(reportByRunId)) {
    if (!runOrderSet.has(runId)) {
      runOrder.push(runId);
      runOrderSet.add(runId);
    }
  }

  // Build ordered runs array with settings + events attached
  const runs = runOrder.map((runId) => ({
    runId,
    papers: (papersByRunId[runId] ?? [])
      .sort((a, b) => a.rank - b.rank)
      .map(mapDbPaper),
    reportMarkdown: reportByRunId[runId] ?? "",
    settings: metaByRunId[runId]?.settings ?? null,
    events: metaByRunId[runId]?.events ?? [],
  }));

  // Shape messages — enrich report-type messages with their ranked papers
  const shapedMessages = (messages ?? []).map((m) => {
    const base = {
      id: m.id,
      question: m.question,
      answer: m.answer,
      index: m.question_index,
      type: m.type ?? "qa",
      createdAt: new Date(m.created_at).getTime(),
      runId: m.run_id,
    };

    // For report messages, attach the ranked papers from that run so ReportViewer
    // renders them correctly without a separate DB lookup.
    if (m.type === "report" && m.run_id) {
      const runPapers = (papersByRunId[m.run_id] ?? [])
        .sort((a, b) => a.rank - b.rank)
        .map(mapDbPaper);
      const runMeta = metaByRunId[m.run_id];
      return {
        ...base,
        reportPapers: runPapers,
        reportTopK: runMeta?.settings?.topK ?? runPapers.length,
      };
    }

    return base;
  });

  if (runs.length === 0) {
    return NextResponse.json({
      chatTitle: chat?.title ?? null,
      runs: [],
      messages: shapedMessages,
    });
  }

  return NextResponse.json({
    chatTitle: chat?.title ?? null,
    runs,
    messages: shapedMessages,
  });
}
