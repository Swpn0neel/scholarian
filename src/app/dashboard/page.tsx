"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileSearch, Loader2, Sparkles, ArrowRight } from "lucide-react";
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

  // Still loading
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

  // No chats — show rich empty state
  return (
    <div className="flex min-h-[calc(100vh-48px)] items-center justify-center p-6">
      <section className="max-w-lg text-center" style={{ animation: "fadeInUp 0.6s ease-out both" }}>

        {/* Icon cluster */}
        <div className="mx-auto mb-8 relative w-24 h-24">
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-[0_16px_48px_-12px_rgba(0,49,120,0.4)]"
            style={{ background: "linear-gradient(135deg, #001228 0%, #002055 100%)" }}
          >
            <FileSearch className="size-11 text-white" />
          </div>
          {/* Teal badge */}
          <div
            className="absolute -top-2 -right-2 size-7 rounded-full flex items-center justify-center border-2 border-white"
            style={{ background: "#70d8c8" }}
          >
            <Sparkles className="size-3.5 text-[#001228]" />
          </div>
        </div>

        {/* Headline */}
        <h1 className="font-heading text-4xl font-bold text-on-surface tracking-tight mb-3 leading-tight">
          Start your first<br />
          <span
            style={{
              fontFamily: "var(--font-playfair)",
              fontStyle: "italic",
              color: "#001228",
            }}
          >
            research session
          </span>
        </h1>

        {/* Subtext */}
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-secondary mb-8">
          Enter a topic, configure your ranking weights, then let Scholarian build
          a transparent, citation-grounded research pipeline.
        </p>

        {/* CTA */}
        <div className="mx-auto max-w-52">
          <NewChatButton />
        </div>

        {/* Hint strip */}
        <div className="mt-8 inline-flex items-center gap-2 text-xs font-semibold text-secondary/50 uppercase tracking-[0.18em]">
          <ArrowRight className="size-3" />
          Analytical lens · 2,400+ sources
        </div>
      </section>
    </div>
  );
}
