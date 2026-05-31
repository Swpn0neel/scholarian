import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/requireAuth";

const settingsSchema = z.object({
  topic: z.string(),
  maxPapers: z.number(),
  topK: z.number(),
  weightRelevance: z.number(),
  weightCitation: z.number(),
  weightRecency: z.number(),
  enhanceQuery: z.boolean().optional(),
  enhanceReport: z.boolean().optional(),
});

const schema = z.object({
  runId: z.string(),
  chatId: z.string(),
  settings: settingsSchema,
  events: z
    .array(
      z.object({
        step: z.string(),
        message: z.string(),
        ts: z.number(),
      })
    )
    .optional()
    .default([]),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = schema.parse(await request.json());
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from("run_metadata").upsert(
    {
      run_id: body.runId,
      chat_id: body.chatId,
      topic: body.settings.topic,
      max_papers: body.settings.maxPapers,
      top_k: body.settings.topK,
      weight_relevance: body.settings.weightRelevance,
      weight_citation: body.settings.weightCitation,
      weight_recency: body.settings.weightRecency,
      enhance_query: body.settings.enhanceQuery ?? false,
      enhance_report: body.settings.enhanceReport ?? false,
      events: body.events,
    },
    { onConflict: "run_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
