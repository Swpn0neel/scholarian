"use client";

import { useState } from "react";
import { Menu, Sparkles } from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/dashboard/Sidebar";

export function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      {/* Mobile Top Navbar */}
      <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-secondary/10 bg-surface px-4 shadow-sm lg:hidden">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-secondary hover:text-on-surface"
          onClick={() => setIsMobileSidebarOpen(true)}
        >
          <span className="sr-only">Open sidebar</span>
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
        <div className="flex flex-1 items-center gap-x-4 justify-between lg:justify-end">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
              <Sparkles className="size-4" />
            </div>
            <span className="font-heading text-lg font-semibold text-on-surface">Scholarian</span>
          </Link>
          <div className="w-10"> {/* Spacer or minimal NewChatButton */}
            {/* Can leave empty or place a plus icon */}
          </div>
        </div>
      </header>

      <Sidebar 
        isOpen={isMobileSidebarOpen} 
        onClose={() => setIsMobileSidebarOpen(false)} 
      />

      <main className="flex-1 lg:pl-[var(--sidebar-width,280px)] transition-all duration-300 ease-in-out">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
