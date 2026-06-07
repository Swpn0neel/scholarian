"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { GripVertical, LogOut, PanelLeftClose, PanelLeftOpen, Menu } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ChatList } from "./ChatList";
import { NewChatButton } from "./NewChatButton";
import { useChatSync } from "@/hooks/useChat";


export function Sidebar() {
  useChatSync(); // load + realtime-subscribe once for the whole dashboard
  const [userName, setUserName] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(280);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const name = data.user.user_metadata?.full_name ?? data.user.email?.split("@")[0] ?? "Scholar";
        setUserName(name);
      }
    });
  }, []);

  // Update CSS variable when sidebar width changes or when collapsed
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", isDesktopCollapsed ? "0px" : `${sidebarWidth}px`);
  }, [sidebarWidth, isDesktopCollapsed]);

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
      {/* Floating expand button for desktop */}
      {isDesktopCollapsed && (
        <button
          onClick={() => setIsDesktopCollapsed(false)}
          className="fixed top-4 left-4 z-40 hidden lg:flex size-10 items-center justify-center rounded-lg shadow-md border border-white/10 text-white/60 hover:text-white transition-all"
          style={{ background: "#001228" }}
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="size-5" />
        </button>
      )}

      {/* Mobile Top Navbar */}
      <header
        className="fixed top-0 left-0 right-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-white/10 px-4 shadow-sm lg:hidden"
        style={{ background: "rgba(0,18,40,0.97)", backdropFilter: "blur(12px)" }}
      >
        <button
          type="button"
          className="-m-2.5 p-2.5 text-white/50 hover:text-white transition-colors"
          onClick={() => setIsMobileOpen(true)}
        >
          <span className="sr-only">Open sidebar</span>
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
        <div className="flex flex-1 items-center gap-x-4 justify-between lg:justify-end">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/favicon.svg" alt="Scholarian Logo" width={32} height={32} className="size-8 select-none block p-0.5" />
            <span className="font-heading text-lg font-semibold text-white">Scholarian</span>
          </Link>
          <div className="w-10" />
        </div>
      </header>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        ref={sidebarRef}
        style={{
          width: sidebarWidth,
          background: "linear-gradient(180deg, #001228 0%, #001a42 100%)",
        }}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col max-w-[calc(100vw-3rem)] border-r border-white/8 transition-transform duration-300 ease-in-out ${isMobileOpen ? "translate-x-0" : "-translate-x-full"
          } ${isDesktopCollapsed ? "lg:-translate-x-full" : "lg:translate-x-0"} ${isResizing ? "select-none" : ""}`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 pb-0 flex items-center justify-between">
            <Link href="/" className="mb-4 flex items-center gap-2 px-2">
              <Image src="/favicon.svg" alt="Scholarian Logo" width={32} height={32} className="size-8 select-none block p-0.5" />
              <span className="font-heading text-lg font-semibold text-white">Scholarian</span>
            </Link>
            <button
              onClick={() => {
                if (window.innerWidth >= 1024) setIsDesktopCollapsed(true);
                else setIsMobileOpen(false);
              }}
              className="mb-4 flex size-10 items-center justify-center rounded-md text-white/35 hover:bg-white/8 hover:text-white transition-colors"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="size-5" />
            </button>
          </div>

          {/* User Greeting */}
          {userName && (
            <div className="px-4 pb-4">
              <div className="rounded-xl p-3 border border-white/8" style={{ background: "rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-0.5">Welcome back</p>
                <p className="text-sm font-semibold text-white truncate">Hello, {userName}</p>
              </div>
            </div>
          )}

          {/* New Chat Button */}
          <div className="px-4 pb-3">
            <NewChatButton onItemClick={() => setIsMobileOpen(false)} dark />
          </div>

          {/* Chat List */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
              Research Chats
            </div>
            <ChatList onItemClick={() => setIsMobileOpen(false)} dark />
          </div>

          {/* Footer */}
          <div className="border-t border-white/8 p-4 space-y-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm text-white/40 hover:bg-white/8 hover:text-red-400 transition-colors"
            >
              <LogOut className="size-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Resize Handle (Desktop Only) */}
      {!isDesktopCollapsed && (
        <div
          onMouseDown={handleResizeStart}
          className={`fixed inset-y-0 left-0 z-50 hidden lg:block cursor-ew-resize hover:bg-tertiary-fixed-dim/25 active:bg-tertiary-fixed-dim/40 transition-colors ${isResizing ? "bg-tertiary-fixed-dim/40" : "bg-transparent"}`}
          style={{ width: 8, transform: `translateX(${sidebarWidth - 4}px)` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity">
            <GripVertical className="size-4 text-tertiary-fixed-dim" />
          </div>
        </div>
      )}
    </>
  );
}