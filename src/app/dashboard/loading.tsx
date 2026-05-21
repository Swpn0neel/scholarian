export default function DashboardLoading() {
  return (
    <div className="flex-1 overflow-auto p-6 lg:p-8 space-y-6 animate-pulse">
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
    </div>
  );
}
