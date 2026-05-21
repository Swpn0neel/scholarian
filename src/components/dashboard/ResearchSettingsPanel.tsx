"use client";

import { useState } from "react";
import { Minus, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ResearchSettings } from "@/types";

interface Props {
  settings: ResearchSettings;
  disabled?: boolean;
  onChange: (settings: Partial<ResearchSettings>) => void;
  onRun: () => void;
}

function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-lg border border-secondary/10 bg-surface p-3">
      <div className="mb-2 text-xs font-semibold text-secondary">{label}</div>
      <div className="flex items-center justify-between gap-2">
        <Button size="icon-sm" variant="ghost" onClick={() => onChange(Math.max(min, value - step))}>
          <Minus className="size-4" />
        </Button>
        <div className="min-w-12 text-center font-heading text-xl font-semibold text-on-surface">{value}</div>
        <Button size="icon-sm" variant="ghost" onClick={() => onChange(Math.min(max, value + step))}>
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function ResearchSettingsPanel({ settings, disabled, onChange, onRun }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const weightSum = settings.weightRelevance + settings.weightCitation + settings.weightRecency;
  const isNormalized = Math.abs(weightSum - 1) < 0.001;
  const isAllZero = weightSum === 0;

  return (
    <section className="rounded-2xl border border-secondary/10 bg-white p-5 shadow-ambient transition-all">
      <div 
        className="flex cursor-pointer items-center justify-between gap-4 select-none"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div>
          <h2 className="font-heading text-xl font-semibold text-on-surface">Research Settings</h2>
          <p className="mt-1 text-sm text-secondary">Tune the ranking lens before starting the pipeline.</p>
        </div>
        <button
          type="button"
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors ${isCollapsed ? "hover:bg-primary/10" : "hover:bg-secondary/10"}`}
          aria-label={isCollapsed ? "Expand settings" : "Collapse settings"}
        >
          <SlidersHorizontal className={`size-5 transition-all duration-300 ${isCollapsed ? "text-secondary opacity-60 hover:opacity-100" : "text-primary rotate-180"}`} />
        </button>
      </div>

      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 pt-5">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-secondary">Topic</span>
              <textarea
                value={settings.topic}
                onChange={(event) => onChange({ topic: event.target.value })}
                placeholder="e.g. retrieval augmented generation for biomedical literature review"
                className="min-h-28 w-full resize-none rounded-lg border border-secondary/10 bg-surface px-4 py-3 text-sm leading-relaxed text-on-surface outline-none transition placeholder:text-secondary/50 focus:border-primary focus:ring-4 focus:ring-primary/15"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <Stepper
                label="Max Papers"
                value={settings.maxPapers}
                min={10}
                max={200}
                step={10}
                onChange={(maxPapers) => onChange({ maxPapers })}
              />
              <Stepper
                label="Top K"
                value={settings.topK}
                min={1}
                max={20}
                onChange={(topK) => onChange({ topK })}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["Relevance", "weightRelevance"],
                ["Citation", "weightCitation"],
                ["Recency", "weightRecency"],
              ].map(([label, key]) => (
                <label key={key} className="rounded-lg border border-secondary/10 bg-surface p-3">
                  <span className="mb-2 block text-xs font-semibold text-secondary">{label}</span>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings[key as keyof ResearchSettings]}
                    onChange={(event) => onChange({ [key]: Number(event.target.value) })}
                    className="h-9 border-secondary/10 bg-white text-on-surface"
                  />
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-secondary/10 pt-4">
              <div className="text-xs text-secondary">
                {isAllZero ? (
                  <span className="text-red-600 font-semibold">⚠ All weights are zero — at least one must be greater than 0.</span>
                ) : (
                  <>
                    Weight sum: <span className={isNormalized ? "text-tertiary" : "text-amber-700"}>{weightSum.toFixed(2)}</span>
                    {!isNormalized && <span className="ml-2">Weights will be normalized automatically.</span>}
                  </>
                )}
              </div>
              <Button
                disabled={disabled || !settings.topic.trim() || isAllZero}
                onClick={onRun}
                className="h-10 rounded-lg bg-primary px-5 text-white hover:bg-primary-container"
              >
                Run Research
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
