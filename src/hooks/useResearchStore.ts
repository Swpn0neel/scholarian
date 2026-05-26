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
  type: "qa" | "refine" | "compare" | "report";
  createdAt: number;
  runId: string | null;
  /** Only for type='report' — the ranked papers used to generate it */
  reportPapers?: import("@/types").RankedPaper[];
  reportTopK?: number;
  isGenerating?: boolean;
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
  /**
   * Pass 1 intermediate results — ephemeral, never saved to DB.
   * Only populated during the two-pass ranking flow (when pool > maxPapers).
   * Cleared when Pass 2 results arrive or when the run is reset.
   */
  pass1Papers: RankedPaper[];
  report: Report | null;
  reportMarkdown: string;
  currentRunId: string | null;
  isRunning: boolean;
  isLoadingHistory: boolean;
  chatTitle: string | null;
  messages: QAMessage[];
  isAnswering: boolean;
  completedRuns: CompletedRun[];
  /** chatId whose data is currently loaded in the store — null means store is empty/reset */
  loadedChatId: string | null;

  setSettings: (settings: Partial<ResearchSettings>) => void;
  setStep: (step: PipelineStep, message?: string) => void;
  addEvent: (step: PipelineStep, message: string) => void;
  setPapers: (papers: RankedPaper[]) => void;
  /** Set ephemeral Pass 1 intermediate results (transparent mode) */
  setPass1Papers: (papers: RankedPaper[]) => void;
  appendReportMarkdown: (chunk: string) => void;
  setReport: (report: Report | null) => void;
  setCurrentRunId: (runId: string | null) => void;
  setIsLoadingHistory: (loading: boolean) => void;
  setChatTitle: (title: string | null) => void;
  addMessage: (msg: QAMessage) => void;
  setMessages: (msgs: QAMessage[]) => void;
  setIsAnswering: (v: boolean) => void;
  setLoadedChatId: (id: string | null) => void;
  clearReport: () => void;
  /** Archive current active run into completedRuns, then reset live state */
  archiveAndReset: () => void;
  /** Snapshot the current report into completedRuns but keep the papers for a new report */
  archiveAndKeepPapers: () => void;
  /** Full reset — used when switching chats (clears completedRuns too) */
  resetAll: () => void;
  addCompletedRun: (run: CompletedRun) => void;
}

export const useResearchStore = create<ResearchStore>((set, get) => ({
  settings: DEFAULT_RESEARCH_SETTINGS,
  step: "idle",
  events: [],
  papers: [],
  pass1Papers: [],
  report: null,
  reportMarkdown: "",
  currentRunId: null,
  isRunning: false,
  isLoadingHistory: false,
  chatTitle: null,
  messages: [],
  isAnswering: false,
  completedRuns: [],
  loadedChatId: null as string | null,

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

  setPapers: (papers) => set({ papers, step: "ranked", isRunning: false, pass1Papers: [] }),

  setPass1Papers: (papers) => set({ pass1Papers: papers }),

  appendReportMarkdown: (chunk) =>
    set((state) => ({ reportMarkdown: `${state.reportMarkdown}${chunk}` })),

  setReport: (report) => set({ report, reportMarkdown: report?.content_md ?? "" }),
  setCurrentRunId: (runId) => set({ currentRunId: runId }),
  setIsLoadingHistory: (loading) => set({ isLoadingHistory: loading }),
  setChatTitle: (title) => set({ chatTitle: title }),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  setMessages: (msgs) => set({ messages: msgs }),
  setIsAnswering: (v) => set({ isAnswering: v }),
  setLoadedChatId: (id) => set({ loadedChatId: id }),
  clearReport: () => set({ report: null, reportMarkdown: "" }),
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
        pass1Papers: [],
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
        pass1Papers: [],
        report: null,
        reportMarkdown: "",
        currentRunId: null,
        isRunning: false,
      });
    }
  },

  /**
   * Snapshot the current report into completedRuns, but keep the papers and
   * settings intact. Used when generating a custom report on the same papers.
   */
  archiveAndKeepPapers: () => {
    const state = get();
    if (state.reportMarkdown) {
      const snapshot: CompletedRun = {
        id: crypto.randomUUID(),
        topic: state.settings.topic,
        settings: { ...state.settings },
        papers: state.papers,
        reportMarkdown: state.reportMarkdown,
        runId: state.currentRunId,
        events: state.events,
        completedAt: Date.now(),
      };
      set((s) => ({
        completedRuns: [...s.completedRuns, snapshot],
        // Reset only the report state so we can generate a new one
        report: null,
        reportMarkdown: "",
        step: "ranked",
      }));
    } else {
      // Just clear the report state if it's empty or failed
      set({ report: null, reportMarkdown: "", step: "ranked" });
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
      pass1Papers: [],
      report: null,
      reportMarkdown: "",
      currentRunId: null,
      isRunning: false,
      chatTitle: null,
      messages: [],
      isAnswering: false,
      completedRuns: [],
      loadedChatId: null,
    }),
}));