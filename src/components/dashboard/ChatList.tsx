"use client";

import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash2, X, Check, Loader2, AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/hooks/useChat";
import { cn } from "@/lib/utils";

export function ChatList({ onItemClick, dark }: { onItemClick?: () => void; dark?: boolean }) {
  const params = useParams<{ chatId?: string }>();
  const router = useRouter();
  const activeChatId = params?.chatId;

  const { chats, isLoading, renameChat, deleteChat } = useChat();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [navigatingToId, setNavigatingToId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear navigation indicator once the route actually changes
  useEffect(() => {
    setNavigatingToId(null);
  }, [activeChatId]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // Clean up the auto-cancel timer on unmount
  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  const handleStartEdit = useCallback(
    (e: React.MouseEvent, chat: { id: string; title: string }) => {
      e.preventDefault();
      e.stopPropagation();
      // Cancel any pending delete if we switch to editing
      setPendingDeleteId(null);
      setEditingId(chat.id);
      setTitle(chat.title);
    },
    []
  );

  const handleCancelEdit = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setEditingId(null);
    setTitle("");
  }, []);

  const handleSubmitEdit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (editingId && title.trim()) {
        await renameChat(editingId, title.trim());
      }
      setEditingId(null);
      setTitle("");
    },
    [editingId, title, renameChat]
  );

  // First click → arm the confirmation; second click → delete
  const handleDeleteClick = useCallback(
    (e: React.MouseEvent, chatId: string) => {
      e.preventDefault();
      e.stopPropagation();

      if (pendingDeleteId === chatId) {
        // Already armed — confirm delete
        if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
        setPendingDeleteId(null);
        setDeletingId(chatId);
        void deleteChat(chatId, activeChatId).then(() => {
          setDeletingId(null);
        });
      } else {
        // Arm the confirmation
        if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
        setPendingDeleteId(chatId);
        // Auto-cancel after 3 s if user changes their mind
        deleteTimerRef.current = setTimeout(() => setPendingDeleteId(null), 3000);
      }
    },
    [pendingDeleteId, deleteChat, activeChatId]
  );

  const handleCancelDelete = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      setPendingDeleteId(null);
    },
    []
  );

  // Loading state
  if (isLoading && !chats.length) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className={`size-4 animate-spin ${dark ? "text-white/30" : "text-secondary"}`} />
      </div>
    );
  }

  if (!chats.length) {
    return (
      <div className={`px-3 py-4 text-xs text-center ${dark ? "text-white/35" : "text-secondary"}`}>
        No research chats yet.
        <br />
        <span className="text-[10px] opacity-60">Click &quot;New Chat&quot; to get started</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {chats.map((chat) => {
        const isActive = chat.id === activeChatId;
        const isPendingDelete = pendingDeleteId === chat.id;
        const isActuallyDeleting = deletingId === chat.id;

        return (
          <div
            key={chat.id}
            className={cn(
              "group relative flex min-h-10 flex-col rounded-md border-l-2 border-transparent transition-all",
              dark ? [
                isActive && "border-tertiary-fixed-dim/60 bg-white/8",
                !isActive && !isPendingDelete && "hover:translate-x-1 hover:bg-white/5",
                isPendingDelete && "border-red-400/50 bg-red-900/20",
              ] : [
                isActive && "border-primary bg-primary/10",
                !isActive && !isPendingDelete && "hover:translate-x-1 hover:bg-surface-container-low",
                isPendingDelete && "border-red-400/60 bg-red-50/70",
              ],
              isActuallyDeleting && "opacity-40 pointer-events-none"
            )}
          >
            {/* ── Main row ── */}
            {editingId === chat.id ? (
              /* Rename form */
              <form
                className="flex flex-1 min-w-0 items-center gap-1 px-2 py-1"
                onSubmit={handleSubmitEdit}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  ref={inputRef}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") handleCancelEdit();
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSubmitEdit(e);
                    }
                  }}
                  className={`h-8 flex-1 min-w-0 rounded px-2 text-sm outline-none ring-1 focus:ring-primary/30 ${dark
                      ? "bg-white/10 text-white placeholder-white/30 ring-white/15"
                      : "bg-white text-on-surface ring-secondary/15"
                    }`}
                  placeholder="Chat name"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded p-1 text-green-600 hover:bg-green-50"
                  title="Save"
                >
                  <Check className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="shrink-0 rounded p-1 text-secondary hover:bg-secondary/10"
                  title="Cancel"
                >
                  <X className="size-3.5" />
                </button>
              </form>
            ) : (
              /* Normal view */
              <div className="flex flex-1 min-w-0 items-center gap-2 px-2">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (chat.id === activeChatId || navigatingToId === chat.id) return;
                    setNavigatingToId(chat.id);
                    router.push(`/dashboard/${chat.id}`);
                    onItemClick?.();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      if (chat.id === activeChatId || navigatingToId === chat.id) return;
                      setNavigatingToId(chat.id);
                      router.push(`/dashboard/${chat.id}`);
                      onItemClick?.();
                    }
                  }}
                  className={cn(
                    "flex-1 min-w-0 cursor-pointer truncate py-2 text-sm transition-colors",
                    isPendingDelete
                      ? (dark ? "text-red-400 font-medium" : "text-red-700 font-medium")
                      : dark
                        ? (isActive ? "text-white" : "text-white/65 hover:text-white")
                        : "text-on-surface hover:text-primary"
                  )}
                >
                  {isActuallyDeleting ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="size-3 animate-spin" />
                      Deleting…
                    </span>
                  ) : navigatingToId === chat.id ? (
                    <span className="flex items-center gap-1.5 text-primary">
                      <Loader2 className="size-3 animate-spin" />
                      <span className="text-xs">Switching…</span>
                    </span>
                  ) : (
                    chat.title
                  )}
                </div>

                {/* Action buttons — visible on hover (or always when pending) */}
                {!isPendingDelete && (
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className={dark ? "hover:bg-white/10" : "hover:bg-secondary/10"}
                      aria-label="Rename chat"
                      onClick={(e) => handleStartEdit(e, chat)}
                    >
                      <Pencil className={`size-3.5 ${dark ? "text-white/35" : "text-secondary"}`} />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className={dark ? "hover:bg-red-900/30" : "hover:bg-red-50"}
                      aria-label="Delete chat"
                      onClick={(e) => handleDeleteClick(e, chat.id)}
                    >
                      <Trash2 className={`size-3.5 ${dark ? "text-white/35" : "text-secondary"}`} />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ── Inline confirmation strip ── */}
            {isPendingDelete && (
              <div className="flex items-center justify-between gap-2 px-2 pb-2">
                <span className={`flex items-center gap-1 text-[11px] font-medium ${dark ? "text-red-400" : "text-red-600"}`}>
                  <AlertTriangle className="size-3 shrink-0" />
                  Delete this chat?
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleCancelDelete(e)}
                    className={`rounded px-2 py-0.5 text-[11px] transition-colors ${dark ? "text-white/40 hover:bg-white/10" : "text-secondary hover:bg-secondary/10"}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={(e) => handleDeleteClick(e, chat.id)}
                    className="rounded bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-red-600 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}