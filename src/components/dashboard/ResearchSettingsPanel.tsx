"use client";

import { useState } from "react";
import { Minus, Plus, Sparkles, ChevronDown } from "lucide-react";
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
    <div className="rounded-xl border border-secondary/12 bg-surface p-3">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-secondary/60">{label}</div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-lg border border-secondary/15 bg-white text-secondary transition-colors hover:border-primary/30 hover:text-primary"
          onClick={() => onChange(Math.max(min, value - step))}
        >
          <Minus className="size-3.5" />
        </button>
        <div className="min-w-12 text-center font-heading text-xl font-bold text-on-surface">{value}</div>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-lg border border-secondary/15 bg-white text-secondary transition-colors hover:border-primary/30 hover:text-primary"
          onClick={() => onChange(Math.min(max, value + step))}
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  teal,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  teal?: boolean;
}) {
  return (
    <div className="relative inline-flex items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <div
        className={`h-5 w-9 rounded-full transition-colors peer-focus-visible:ring-2 ${teal
            ? "bg-secondary/20 peer-checked:bg-tertiary-fixed-dim peer-focus-visible:ring-tertiary-fixed-dim/20"
            : "bg-secondary/20 peer-checked:bg-primary peer-focus-visible:ring-primary/20"
          }`}
      />
      <div className="absolute left-[2px] top-[2px] size-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
    </div>
  );
}

export function ResearchSettingsPanel({ settings, disabled, onChange, onRun }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showTopicOptions, setShowTopicOptions] = useState(false);
  const weightSum = settings.weightRelevance + settings.weightCitation + settings.weightRecency;
  const isNormalized = Math.abs(weightSum - 1) < 0.001;
  const isAllZero = weightSum === 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-secondary/10 shadow-[0_20px_60px_-15px_rgba(0,49,120,0.14)]">

      {/* ── Navy header bar ── */}
      <div
        className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4 select-none"
        style={{ background: "linear-gradient(135deg, #001228 0%, #002055 100%)" }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Configuration</p>
            <h2 className="text-base font-bold text-white leading-tight">Research Settings</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isCollapsed && settings.topic && (
            <p className="hidden sm:block max-w-[280px] truncate text-xs italic text-white/40">
              &ldquo;{settings.topic}&rdquo;
            </p>
          )}
          <ChevronDown
            className={`size-4 text-white/40 transition-transform duration-300 ${isCollapsed ? "" : "rotate-180"}`}
          />
        </div>
      </div>

      {/* ── Collapsible body ── */}
      <div
        className={`grid bg-white transition-all duration-300 ease-in-out ${isCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
          }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-5 p-6">

            {/* Topic label + options */}
            <label className="block">
              {/* Desktop toggles */}
              <div className="hidden sm:flex sm:items-center sm:justify-between mb-2">
                <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">Topic</span>
                <div className="flex gap-4 items-center">
                  <label className="flex cursor-pointer items-center gap-2" title="Automatically enrich vague queries for better results">
                    <span className="text-xs font-semibold text-secondary">Query Enhance</span>
                    <Toggle checked={settings.enhanceQuery ?? false} onChange={(v) => onChange({ enhanceQuery: v })} />
                  </label>
                  <label className="flex cursor-pointer items-center gap-2" title="Dynamically enhance report structure based on topic">
                    <span className="text-xs font-semibold text-secondary">Report Enhance</span>
                    <Toggle checked={settings.enhanceReport ?? false} onChange={(v) => onChange({ enhanceReport: v })} />
                  </label>
                  <label
                    className="flex cursor-pointer items-center gap-1.5"
                    title="Intelligently re-queries databases until max papers quota is filled with relevant results."
                  >
                    <Sparkles className={`size-3.5 transition-colors ${settings.autoMode ? "text-tertiary-fixed-dim" : "text-secondary/60"}`} />
                    <span className={`text-xs font-semibold transition-colors ${settings.autoMode ? "text-primary" : "text-secondary"}`}>
                      Smart Mode
                    </span>
                    <Toggle checked={settings.autoMode ?? false} onChange={(v) => onChange({ autoMode: v })} teal />
                  </label>
                </div>
              </div>

              {/* Mobile toggles (collapsible) */}
              <div className="sm:hidden block w-full mb-3">
                <div className="flex items-center justify-between w-full">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">Topic</span>
                  <button
                    type="button"
                    onClick={() => setShowTopicOptions(!showTopicOptions)}
                    className="flex items-center gap-1.5 rounded bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    <span>Options</span>
                    <ChevronDown className={`size-3.5 transition-transform duration-200 ${showTopicOptions ? "rotate-180" : ""}`} />
                  </button>
                </div>
                <div
                  className={`grid transition-all duration-300 ease-in-out ${showTopicOptions ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0 pointer-events-none"
                    }`}
                >
                  <div className="overflow-hidden">
                    <div className="mt-1 flex flex-col gap-2 rounded-xl border border-secondary/8 bg-surface p-3">
                      <label className="flex cursor-pointer items-center justify-between gap-4 border-b border-secondary/8 py-1.5" title="Automatically enrich vague queries">
                        <span className="text-xs font-semibold text-secondary">Query Enhance</span>
                        <Toggle checked={settings.enhanceQuery ?? false} onChange={(v) => onChange({ enhanceQuery: v })} />
                      </label>
                      <label className="flex cursor-pointer items-center justify-between gap-4 border-b border-secondary/8 py-1.5" title="Dynamically enhance report structure">
                        <span className="text-xs font-semibold text-secondary">Report Enhance</span>
                        <Toggle checked={settings.enhanceReport ?? false} onChange={(v) => onChange({ enhanceReport: v })} />
                      </label>
                      <label className="flex cursor-pointer items-center justify-between gap-4 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className={`size-3.5 transition-colors ${settings.autoMode ? "text-tertiary-fixed-dim" : "text-secondary/60"}`} />
                          <span className={`text-xs font-semibold transition-colors ${settings.autoMode ? "text-primary" : "text-secondary"}`}>Smart Mode</span>
                        </div>
                        <Toggle checked={settings.autoMode ?? false} onChange={(v) => onChange({ autoMode: v })} teal />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Textarea */}
              <textarea
                value={settings.topic}
                onChange={(event) => onChange({ topic: event.target.value })}
                placeholder="e.g. retrieval augmented generation for biomedical literature review"
                className="min-h-28 w-full resize-none rounded-xl border border-secondary/15 bg-surface px-4 py-3 text-sm leading-relaxed text-on-surface outline-none transition placeholder:text-secondary/40 focus:border-primary/30 focus:bg-white focus:ring-4 focus:ring-primary/8"
              />
            </label>

            {/* Steppers */}
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

            {/* Ranking weights */}
            <div>
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">
                Ranking Weights
              </span>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ["Relevance", "weightRelevance"],
                  ["Citation", "weightCitation"],
                  ["Recency", "weightRecency"],
                ].map(([label, key]) => (
                  <label
                    key={key}
                    className={`rounded-xl border p-3 transition-all ${settings.autoMode
                        ? "cursor-not-allowed border-secondary/5 bg-secondary/5 opacity-50 grayscale"
                        : "border-secondary/12 bg-surface hover:border-primary/20"
                      }`}
                  >
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-secondary/70">
                      {label}
                    </span>
                    <Input
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      disabled={settings.autoMode}
                      value={settings[key as "weightRelevance" | "weightCitation" | "weightRecency"]}
                      onChange={(event) => onChange({ [key]: Number(event.target.value) })}
                      className="h-9 rounded-lg border-secondary/10 bg-white text-on-surface disabled:cursor-not-allowed"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-secondary/8 pt-4">
              <div className="text-xs text-secondary">
                {settings.autoMode ? (
                  <span className="flex items-center gap-1 font-semibold text-primary">
                    <Sparkles className="size-3 text-tertiary-fixed-dim" /> Weights are managed automatically.
                  </span>
                ) : isAllZero ? (
                  <span className="font-semibold text-red-600">⚠ All weights are zero — at least one must be &gt; 0.</span>
                ) : (
                  <>
                    Weight sum:{" "}
                    <span className={isNormalized ? "text-tertiary font-semibold" : "text-amber-700"}>
                      {weightSum.toFixed(2)}
                    </span>
                    {!isNormalized && <span className="ml-2 text-secondary/60">Weights will be normalized automatically.</span>}
                  </>
                )}
              </div>
              <Button
                disabled={disabled || !settings.topic.trim() || isAllZero}
                onClick={onRun}
                className="h-10 rounded-xl px-8 text-sm font-bold shadow-sm transition-all disabled:opacity-40"
                style={{ background: "#001228", color: "#70d8c8" }}
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
