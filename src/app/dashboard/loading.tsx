export default function DashboardLoading() {
  return (
    <div className="flex h-screen w-full animate-pulse">
      {/* Sidebar skeleton */}
      <aside className="hidden lg:flex flex-col w-[280px] shrink-0 border-r border-secondary/10 bg-surface-container-lowest p-4 gap-4">
        {/* Logo */}
        <div className="h-8 w-32 rounded-lg bg-secondary/10" />
        {/* Greeting card */}
        <div className="h-16 rounded-xl bg-secondary/8" />
        {/* New chat button */}
        <div className="h-9 rounded-lg bg-secondary/10" />
        {/* Chat list items */}
        <div className="space-y-2 flex-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 rounded-md bg-secondary/8" />
          ))}
        </div>
        {/* Footer */}
        <div className="h-9 rounded-md bg-secondary/8 mt-auto" />
      </aside>

      {/* Main content skeleton */}
      <main className="flex-1 overflow-auto p-6 lg:p-8 space-y-6">
        {/* Page title */}
        <div className="h-9 w-64 rounded-lg bg-secondary/10" />

        {/* Settings panel skeleton */}
        <div className="rounded-xl border border-secondary/10 bg-white p-5 space-y-4 shadow-sm">
          <div className="h-6 w-40 rounded bg-secondary/10" />
          <div className="h-28 rounded-lg bg-secondary/8" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-16 rounded-lg bg-secondary/8" />
            <div className="h-16 rounded-lg bg-secondary/8" />
          </div>
        </div>

        {/* Pipeline progress skeleton */}
        <div className="rounded-xl border border-secondary/10 bg-white p-5 shadow-sm">
          <div className="h-5 w-36 rounded bg-secondary/10 mb-4" />
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-secondary/8" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
