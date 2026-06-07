"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/hooks/useChat";

export function NewChatButton({
  onItemClick,
  dark,
}: {
  onItemClick?: () => void;
  dark?: boolean;
}) {
  const { createChat } = useChat();
  const [isCreating, setIsCreating] = useState(false);

  const handleClick = useCallback(() => {
    if (isCreating) return;
    setIsCreating(true);
    onItemClick?.();
    void createChat("New research chat")
      .catch((error: unknown) => {
        console.error("Failed to create chat:", error);
      })
      .finally(() => setIsCreating(false));
  }, [isCreating, createChat, onItemClick]);

  return (
    <Button
      disabled={isCreating}
      onClick={handleClick}
      className={
        dark
          ? "h-10 w-full rounded-lg font-bold flex items-center justify-center gap-2 bg-tertiary-fixed-dim text-[#001228] hover:bg-[#5cbfb0] transition-colors"
          : "h-10 w-full rounded-lg bg-primary text-white hover:bg-primary-container flex items-center justify-center gap-2"
      }
    >
      <Plus className="size-4" />
      <span>New Chat</span>
    </Button>
  );
}