import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "anon-key";
const isConfigured =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export async function updateSession(request: NextRequest) {
  if (!isConfigured) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: { path?: string; expires?: Date; httpOnly?: boolean; secure?: boolean; sameSite?: "lax" | "strict" | "none" } }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname === "/auth" || pathname === "/sign-in" || pathname === "/sign-up";
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isLandingRoute = pathname === "/";

  if (isDashboardRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if ((isAuthRoute || isLandingRoute) && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
