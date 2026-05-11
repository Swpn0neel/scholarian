"use client";

import { create } from "zustand";
import type { PipelineStep, RankedPaper, Report, ResearchSettings } from "@/types";
import { DEFAULT_RESEARCH_SETTINGS } from "@/types";

interface PipelineEvent {
  step: PipelineStep;
  message: string;
  ts: number;
}

export interface QAMessage {
  id: string;
  question: string;
  answer: string;
  index: number;
  type: "qa" | "refine" | "compare";
  createdAt: number;
}

/** A snapshot of a completed research run (used when refining) */
export interface CompletedRun {
  id: string;
  topic: string;
  /** The exact settings used for this run (topK, weights, maxPapers) */
  settings: ResearchSettings;
  papers: RankedPaper[];
  reportMarkdown: string;
  runId: string | null;
  events: PipelineEvent[];
  completedAt: number;
}

interface ResearchStore {
  settings: ResearchSettings;
  step: PipelineStep;
  events: PipelineEvent[];
  papers: RankedPaper[];
  report: Report | null;
  reportMarkdown: string;
  currentRunId: string | null;
  isRunning: boolean;
  isLoadingHistory: boolean;
  chatTitle: string | null;
  messages: QAMessage[];
  isAnswering: boolean;
  /** Snapshots of previous runs — populated when the user refines and re-runs */
  completedRuns: CompletedRun[];

  setSettings: (settings: Partial<ResearchSettings>) => void;
  setStep: (step: PipelineStep, message?: string) => void;
  addEvent: (step: PipelineStep, message: string) => void;
  setPapers: (papers: RankedPaper[]) => void;
  appendReportMarkdown: (chunk: string) => void;
  setReport: (report: Report | null) => void;
  setCurrentRunId: (runId: string | null) => void;
  setIsLoadingHistory: (loading: boolean) => void;
  setChatTitle: (title: string | null) => void;
  addMessage: (msg: QAMessage) => void;
  setMessages: (msgs: QAMessage[]) => void;
  setIsAnswering: (v: boolean) => void;
  /** Archive current active run into completedRuns, then reset live state */
  archiveAndReset: () => void;
  /** Full reset — used when switching chats (clears completedRuns too) */
  resetAll: () => void;
  addCompletedRun: (run: CompletedRun) => void;
}

export const useResearchStore = create<ResearchStore>((set, get) => ({
  settings: DEFAULT_RESEARCH_SETTINGS,
  step: "idle",
  events: [],
  papers: [],
  report: null,
  reportMarkdown: "",
  currentRunId: null,
  isRunning: false,
  isLoadingHistory: false,
  chatTitle: null,
  messages: [],
  isAnswering: false,
  completedRuns: [],

  setSettings: (settings) =>
    set((state) => ({ settings: { ...state.settings, ...settings } })),

  setStep: (step, message) =>
    set((state) => ({
      step,
      isRunning: !["idle", "ranked", "report_ready", "finalized", "error"].includes(step),
      events: message
        ? [...state.events, { step, message, ts: Date.now() }]
        : state.events,
    })),

  addEvent: (step, message) =>
    set((state) => ({
      events: [...state.events, { step, message, ts: Date.now() }],
    })),

  setPapers: (papers) => set({ papers, step: "ranked", isRunning: false }),

  appendReportMarkdown: (chunk) =>
    set((state) => ({ reportMarkdown: `${state.reportMarkdown}${chunk}` })),

  setReport: (report) => set({ report, reportMarkdown: report?.content_md ?? "" }),
  setCurrentRunId: (runId) => set({ currentRunId: runId }),
  setIsLoadingHistory: (loading) => set({ isLoadingHistory: loading }),
  setChatTitle: (title) => set({ chatTitle: title }),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  setMessages: (msgs) => set({ messages: msgs }),
  setIsAnswering: (v) => set({ isAnswering: v }),
  addCompletedRun: (run) =>
    set((state) => ({ completedRuns: [...state.completedRuns, run] })),

  /**
   * If the active run has meaningful data, snapshot it into completedRuns
   * first so the user can still see previous results, then reset the live state
   * for the new run. Settings are NOT reset — the new topic is applied by caller.
   */
  archiveAndReset: () => {
    const state = get();
    const hasData = state.papers.length > 0 || state.reportMarkdown;
    if (hasData) {
      const snapshot: CompletedRun = {
        id: crypto.randomUUID(),
        topic: state.settings.topic,
        settings: { ...state.settings }, // capture exact topK, weights, maxPapers
        papers: state.papers,
        reportMarkdown: state.reportMarkdown,
        runId: state.currentRunId,
        events: state.events,
        completedAt: Date.now(),
      };
      set((s) => ({
        completedRuns: [...s.completedRuns, snapshot],
        // Reset live pipeline state only
        step: "idle",
        events: [],
        papers: [],
        report: null,
        reportMarkdown: "",
        currentRunId: null,
        isRunning: false,
      }));
    } else {
      set({
        step: "idle",
        events: [],
        papers: [],
        report: null,
        reportMarkdown: "",
        currentRunId: null,
        isRunning: false,
      });
    }
  },

  /**
   * Full reset — used only when switching to a different chat.
   * Resets EVERYTHING including settings, completedRuns, and messages.
   */
  resetAll: () =>
    set({
      settings: DEFAULT_RESEARCH_SETTINGS,
      step: "idle",
      events: [],
      papers: [],
      report: null,
      reportMarkdown: "",
      currentRunId: null,
      isRunning: false,
      chatTitle: null,
      messages: [],
      isAnswering: false,
      completedRuns: [],
    }),
}));