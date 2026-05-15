import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  // Build ordered runs array with settings + events attached
  const runs = runOrder.map((runId) => ({
    runId,
    papers: (papersByRunId[runId] ?? []).sort((a, b) => a.rank - b.rank),
    reportMarkdown: reportByRunId[runId] ?? "",
    settings: metaByRunId[runId]?.settings ?? null,
    events: metaByRunId[runId]?.events ?? [],
  }));

  // Shape messages
  const shapedMessages = (messages ?? []).map((m) => ({
    id: m.id,
    question: m.question,
    answer: m.answer,
    index: m.question_index,
    type: m.type ?? "qa",
    createdAt: new Date(m.created_at).getTime(),
    runId: m.run_id,
  }));

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
