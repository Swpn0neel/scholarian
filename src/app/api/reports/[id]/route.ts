import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({
    id,
    run_id: "local",
    chat_id: "local",
    content_md: "# Report\n\nConnect Supabase to load persisted reports.",
    type: "research",
    created_at: new Date().toISOString(),
  });
}
