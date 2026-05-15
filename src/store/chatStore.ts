"use client";

import { create } from "zustand";
import type { Chat } from "@/types";

interface ChatStore {
  chats: Chat[];
  isLoading: boolean;
  setChats: (chats: Chat[]) => void;
  setIsLoading: (v: boolean) => void;
  optimisticAdd: (chat: Chat) => void;
  optimisticRemove: (id: string) => void;
  optimisticRename: (id: string, title: string) => void;
}

/** Global singleton store — all components share the same chat list. */
export const useChatStore = create<ChatStore>((set) => ({
  chats: [],
  isLoading: true,
  setChats: (chats) => set({ chats }),
  setIsLoading: (v) => set({ isLoading: v }),
  optimisticAdd: (chat) =>
    set((s) => ({ chats: [chat, ...s.chats] })),
  optimisticRemove: (id) =>
    set((s) => ({ chats: s.chats.filter((c) => c.id !== id) })),
  optimisticRename: (id, title) =>
    set((s) => ({
      chats: s.chats.map((c) => (c.id === id ? { ...c, title } : c)),
    })),
}));
