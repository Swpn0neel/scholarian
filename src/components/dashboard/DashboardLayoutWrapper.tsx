import { Sidebar } from "@/components/dashboard/Sidebar";

export function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface">
      <Sidebar />

      {/* Main scrollable area — offset by sidebar on desktop */}
      <main className="flex flex-1 flex-col overflow-hidden lg:pl-(--sidebar-width) transition-all duration-300 ease-in-out pt-16 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
