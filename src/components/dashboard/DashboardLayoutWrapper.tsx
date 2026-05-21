"use client";

import { useState } from "react";
import { Menu, Sparkles } from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/dashboard/Sidebar";

export function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface">
      <Sidebar />

      {/* Main scrollable area — offset by sidebar on desktop */}
      <main className="flex flex-1 flex-col overflow-hidden lg:pl-[var(--sidebar-width,280px)] transition-all duration-300 ease-in-out pt-16 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
