"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileSearch, Sparkles } from "lucide-react";
import { NewChatButton } from "@/components/dashboard/NewChatButton";
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function redirectToLatestChat() {
      const supabase = createClient();
      const { data } = await supabase
        .from("chats")
        .select("id")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (!cancelled && data?.id) {
        router.replace(`/dashboard/${data.id}`);
      }
    }

    void redirectToLatestChat();
    return () => { cancelled = true; };
  }, [router]);

  // Show a clean loading state while fetching the latest chat.
  // If there are no chats the query will return nothing and we stay here.
  return (
    <div className="flex min-h-[calc(100vh-48px)] items-center justify-center">
      <section className="max-w-xl text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <FileSearch className="size-8" />
        </div>
        <h1 className="font-heading text-4xl font-semibold text-on-surface">
          Create your first research chat
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-secondary">
          Start with a topic, tune the ranking weights, then let Scholarian build a
          transparent paper pipeline.
        </p>
        <div className="mx-auto mt-8 max-w-52">
          <NewChatButton />
        </div>
        <div className="mt-8 inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-secondary">
          <Sparkles className="size-3" />
          Analytical Lens
        </div>
      </section>
    </div>
  );
}
