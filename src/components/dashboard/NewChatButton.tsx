"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/hooks/useChat";

export function NewChatButton() {
  const { createChat } = useChat();
  const [isCreating, setIsCreating] = useState(false);

  const handleClick = useCallback(() => {
    if (isCreating) return;
    setIsCreating(true);
    // Navigation happens immediately inside createChat — no need to await
    void createChat("New research chat").catch((error: unknown) => {
      console.error("Failed to create chat:", error);
    }).finally(() => setIsCreating(false));
  }, [isCreating, createChat]);

  return (
    <Button
      disabled={isCreating}
      onClick={handleClick}
      className="h-10 w-full rounded-lg bg-primary text-white hover:bg-primary-container flex items-center justify-center gap-2"
    >
      <Plus className="size-4" />
      <span>New Chat</span>
    </Button>
  );
}