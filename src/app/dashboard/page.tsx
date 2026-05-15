"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileSearch, Loader2, Sparkles } from "lucide-react";
import { NewChatButton } from "@/components/dashboard/NewChatButton";
import { useChatStore } from "@/store/chatStore";

export default function DashboardPage() {
  const router = useRouter();
  const { chats, isLoading } = useChatStore();

  // Redirect to most-recent chat as soon as the store has data
  useEffect(() => {
    if (!isLoading && chats.length > 0) {
      router.replace(`/dashboard/${chats[0]!.id}`);
    }
  }, [chats, isLoading, router]);

  // Still loading or no chats yet
  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-secondary">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  // No chats — show the empty state with create prompt
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
