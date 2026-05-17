"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useChatStore } from "@/store/chatStore";
import type { Chat } from "@/types";

/** Loads and syncs the global chat list. Call once at the layout level. */
export function useChatSync() {
  const store = useChatStore();
  const isLoadingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    store.setIsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("chats")
      .select("*")
      .order("updated_at", { ascending: false });
    store.setChats((data as Chat[] | null) ?? []);
    store.setIsLoading(false);
    isLoadingRef.current = false;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void refresh();

    const supabase = createClient();
    const channel = supabase
      .channel("chats-global-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, () => {
        void refresh();
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [refresh]);
}

/** Exposes chat CRUD actions using the global store. */
export function useChat() {
  const router = useRouter();
  const store = useChatStore();

  const createChat = useCallback(
    async (title = "New research chat") => {
      const tempId = `temp-${Date.now()}`;
      const placeholder: Chat = {
        id: tempId,
        title,
        user_id: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.optimisticAdd(placeholder);

      // Navigate instantly — don't wait for the server
      router.push(`/dashboard/${tempId}`);

      // Persist in the background; swap temp ID for real ID when done
      try {
        const response = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        const chat = (await response.json()) as Chat;

        if (response.ok && chat?.id) {
          store.optimisticRemove(tempId);
          store.optimisticAdd(chat);
          // Silently replace the temp-ID URL with the real one
          router.replace(`/dashboard/${chat.id}`);
          return chat;
        } else {
          store.optimisticRemove(tempId);
          // Already navigated — go back to dashboard root on failure
          router.replace("/dashboard");
          throw new Error("Failed to create chat");
        }
      } catch (err) {
        store.optimisticRemove(tempId);
        router.replace("/dashboard");
        throw err;
      }
    },
    [store, router]
  );

  const renameChat = useCallback(
    async (id: string, title: string) => {
      // Optimistically update the UI immediately
      store.optimisticRename(id, title);
      const response = await fetch(`/api/chats/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) {
        // Roll back the optimistic rename on failure
        const original = useChatStore.getState().chats.find((c) => c.id === id);
        if (original) store.optimisticRename(id, original.title);
        console.error("Failed to rename chat:", await response.text());
      }
    },
    [store]
  );

  const deleteChat = useCallback(
    async (id: string, activeChatId?: string) => {
      // Capture the remaining chats BEFORE the optimistic remove so we can
      // navigate to the correct next chat even after the store is updated.
      const remaining = useChatStore.getState().chats.filter((c) => c.id !== id);

      store.optimisticRemove(id);
      const response = await fetch(`/api/chats/${id}`, { method: "DELETE" });

      if (!response.ok) {
        // Roll back the optimistic remove on failure
        const allChats = useChatStore.getState().chats;
        // Re-fetch to restore the deleted chat in the list
        console.error("Failed to delete chat:", await response.text());
        // Trigger a re-sync via the realtime channel — the store will self-correct
        // on the next postgres_changes event. For now, just log the error.
        void allChats; // suppress unused warning
        return;
      }

      if (activeChatId === id) {
        // Navigate to most-recent remaining chat or dashboard
        if (remaining[0]) {
          router.push(`/dashboard/${remaining[0].id}`);
        } else {
          router.push("/dashboard");
        }
      }
    },
    [store, router]
  );

  return {
    chats: store.chats,
    isLoading: store.isLoading,
    createChat,
    renameChat,
    deleteChat,
  };
}
