import { GitCompareArrows } from "lucide-react";

export function CompareReportsView() {
  return (
    <section className="min-h-[70vh] rounded-lg border border-secondary/10 bg-white p-8 text-on-surface shadow-sm">
      <div className="mb-8 flex items-center gap-3">
        <GitCompareArrows className="size-6 text-primary" />
        <h1 className="font-heading text-3xl font-semibold">Compare Reports</h1>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-secondary/10 bg-surface p-5">
          <h2 className="font-heading text-lg font-semibold">Report A</h2>
          <p className="mt-2 text-sm text-secondary">Select a report from a chat thread to populate this side.</p>
        </div>
        <div className="rounded-lg border border-secondary/10 bg-surface p-5">
          <h2 className="font-heading text-lg font-semibold">Report B</h2>
          <p className="mt-2 text-sm text-secondary">The comparison route is ready for the Gemini synthesis handler.</p>
        </div>
      </div>
    </section>
  );
}
