import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Returns the authenticated user, or a 401 NextResponse if the caller is not authenticated.
 * Pass the response through immediately if it is a NextResponse.
 */
export async function requireAuth(): Promise<
  { user: { id: string } } | NextResponse
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { user };
}
