"use client";

import { useCallback, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/hooks/useChat";

export function NewChatButton() {
  const { createChat } = useChat();
  const [isCreating, setIsCreating] = useState(false);

  const handleClick = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      await createChat("New research chat");
    } catch (error) {
      console.error("Failed to create chat:", error);
      alert(error instanceof Error ? error.message : "Failed to create chat");
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, createChat]);

  return (
    <Button
      disabled={isCreating}
      onClick={handleClick}
      className="h-10 w-full rounded-lg bg-primary text-white hover:bg-primary-container flex items-center justify-center gap-2"
    >
      {isCreating ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          <span>Creating...</span>
        </>
      ) : (
        <>
          <Plus className="size-4" />
          <span>New Chat</span>
        </>
      )}
    </Button>
  );
}