"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GripVertical, LogOut, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ChatList } from "./ChatList";
import { NewChatButton } from "./NewChatButton";
import { useChatSync } from "@/hooks/useChat";


export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  useChatSync(); // load + realtime-subscribe once for the whole dashboard
  const [userName, setUserName] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(280);
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const name = data.user.user_metadata?.full_name ?? data.user.email?.split("@")[0] ?? "Scholar";
        setUserName(name);
      }
    });
  }, []);

  // Update CSS variable when sidebar width changes
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", `${sidebarWidth}px`);
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = e.clientX - startXRef.current;
      const newWidth = Math.max(200, Math.min(500, startWidthRef.current + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        setIsResizing(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
    setIsResizing(true);
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
          ref={sidebarRef}
          style={{ width: sidebarWidth }}
          className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-secondary/10 bg-surface-container-lowest transition-transform duration-300 ease-in-out lg:translate-x-0 ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          } ${isResizing ? "select-none" : ""}`}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 pb-0">
              <Link href="/" className="mb-4 flex items-center gap-2 px-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
                  <Sparkles className="size-4" />
                </div>
                <span className="font-heading text-lg font-semibold text-on-surface">Scholarian</span>
              </Link>
            </div>

            {/* User Greeting */}
            {userName && (
              <div className="px-4 pb-4">
                <div className="rounded-xl bg-surface-container-low p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-0.5">Welcome back</p>
                  <p className="text-sm font-semibold text-on-surface truncate">Hello, {userName}</p>
                </div>
              </div>
            )}

            {/* New Chat Button */}
            <div className="px-4 pb-3">
              <NewChatButton />
            </div>

            {/* Chat List */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">
                Research Chats
              </div>
              <ChatList />
            </div>

            {/* Footer */}
            <div className="border-t border-secondary/10 p-4 space-y-2">
              {/* <Link
                href="/dashboard/compare"
                className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                  pathname === "/dashboard/compare"
                    ? "bg-primary/10 text-primary"
                    : "text-secondary hover:bg-surface-container-low hover:text-primary"
                }`}
              >
                <GitCompareArrows className="size-4" />
                Compare Reports
              </Link> */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm text-secondary hover:bg-surface-container-low hover:text-error transition-colors"
              >
                <LogOut className="size-4" />
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Resize Handle (Desktop Only) */}
        <div
          onMouseDown={handleResizeStart}
          className={`fixed inset-y-0 left-0 z-40 hidden lg:block w-1 cursor-ew-resize hover:bg-primary/30 active:bg-primary/50 transition-colors ${isResizing ? "bg-primary/50" : "bg-transparent"}`}
          style={{ width: 8, transform: `translateX(${sidebarWidth - 4}px)` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity">
            <GripVertical className="size-4 text-primary" />
          </div>
        </div>
    </>
  );
}