import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/requireAuth";

const schema = z.object({
  chatId: z.string(),
  runId: z.string().optional(),
  question: z.string().min(1),
  answer: z.string().min(1),
  questionIndex: z.number().int().positive(),
  type: z.enum(["qa", "refine", "compare", "report"]).default("qa"),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = schema.parse(await request.json());
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("messages")
    .insert({
      chat_id: body.chatId,
      run_id: body.runId ?? null,
      question: body.question,
      answer: body.answer,
      question_index: body.questionIndex,
      type: body.type,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
