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
      .channel(`chats-global-${Date.now()}`)
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
      // Optimistic: add a placeholder immediately so sidebar updates instantly
      const tempId = `temp-${Date.now()}`;
      const placeholder: Chat = {
        id: tempId,
        title,
        user_id: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.optimisticAdd(placeholder);

      try {
        const response = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        const chat = (await response.json()) as Chat;

        if (response.ok && chat?.id) {
          // Replace placeholder with real chat
          store.optimisticRemove(tempId);
          store.optimisticAdd(chat);
          router.push(`/dashboard/${chat.id}`);
          return chat;
        } else {
          store.optimisticRemove(tempId);
          throw new Error("Failed to create chat");
        }
      } catch (err) {
        store.optimisticRemove(tempId);
        throw err;
      }
    },
    [store, router]
  );

  const renameChat = useCallback(
    async (id: string, title: string) => {
      store.optimisticRename(id, title);
      await fetch(`/api/chats/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    },
    [store]
  );

  const deleteChat = useCallback(
    async (id: string, activeChatId?: string) => {
      store.optimisticRemove(id);
      await fetch(`/api/chats/${id}`, { method: "DELETE" });

      if (activeChatId === id) {
        // Navigate to most-recent remaining chat or dashboard
        const remaining = useChatStore.getState().chats.filter((c) => c.id !== id);
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
