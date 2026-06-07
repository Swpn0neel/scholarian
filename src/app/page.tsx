"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  Network,
  MessageSquare,
  ChevronRight,
  CheckCircle2,
  ArrowRight,
  FileText,
} from "lucide-react";

/* ─── Hooks ─────────────────────────────────────────────── */

function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > threshold);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, [threshold]);
  return scrolled;
}

function useCountUp(target: number, duration = 1600) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started) {
          setStarted(true);
          obs.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const t0 = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(tick);
      else setCount(target);
    };
    requestAnimationFrame(tick);
  }, [started, target, duration]);

  return { ref, count };
}

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

/* ─── Page ──────────────────────────────────────────────── */

export default function Home() {
  const route = "/auth";
  const scrolled = useScrolled();

  const stat1 = useCountUp(2400);
  const stat2 = useCountUp(42);
  const stat3 = useCountUp(3);

  const featReveal = useScrollReveal();
  const pipeReveal = useScrollReveal();
  const statsReveal = useScrollReveal();
  const ctaReveal = useScrollReveal();

  return (
    <main className="min-h-screen bg-surface text-on-surface font-sans overflow-x-hidden selection:bg-primary/20">

      {/* ── NAV ─────────────────────────────────────────── */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled
          ? "bg-surface/95 backdrop-blur-md shadow-[0_1px_16px_rgba(0,49,120,0.06)]"
          : "bg-transparent"
          }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/favicon.svg" alt="Scholarian Logo" width={32} height={32} className="size-8 block p-0.5 select-none" />
            <span className={`text-xl font-heading font-bold tracking-tight transition-colors duration-300 ${scrolled ? "text-on-surface" : "text-white"}`}>Scholarian</span>
          </Link>
          <div className="hidden md:flex items-center gap-7 text-sm font-medium">
            <Link href="#features" className={`transition-colors duration-300 ${scrolled ? "text-secondary hover:text-primary" : "text-white/65 hover:text-white"}`}>Features</Link>
            <Link href="#methodology" className={`transition-colors duration-300 ${scrolled ? "text-secondary hover:text-primary" : "text-white/65 hover:text-white"}`}>Methodology</Link>
            <Link
              href={route}
              className={`inline-flex items-center gap-1.5 rounded-full font-bold px-5 h-9 text-sm transition-all duration-300 hover:-translate-y-px ${scrolled ? "bg-primary hover:bg-primary-container text-white" : "bg-white hover:bg-white/90 text-primary"}`}
            >
              Get Started <ChevronRight className="size-3.5" />
            </Link>
          </div>
          <Link href={route} className={`md:hidden inline-flex items-center rounded-full font-bold px-4 h-8 text-sm transition-colors duration-300 ${scrolled ? "bg-primary text-white" : "bg-white text-primary"}`}>
            Start
          </Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex items-center pt-16 overflow-hidden"
        style={{ background: "linear-gradient(135deg, #001228 0%, #001e50 55%, #002055 100%)" }}
      >
        {/* Dot-grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.11) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Ambient glow behind panel */}
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(13,71,161,0.5) 0%, transparent 70%)" }}
        />

        <div className="max-w-7xl mx-auto px-6 w-full py-24 lg:py-0 grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">

          {/* Left — Copy */}
          <div>
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-1.5 mb-8"
              style={{ animation: "fadeInUp 0.6s ease-out 0.1s both" }}
            >
              <span className="size-1.5 rounded-full bg-tertiary-fixed-dim inline-block animate-pulse" />
              <span className="text-xs font-semibold text-white/75 tracking-wider uppercase">AI Research Intelligence</span>
            </div>

            {/* Headline */}
            <h1
              className="text-6xl md:text-7xl font-heading font-bold leading-[1.03] tracking-[-0.03em] text-white mb-6"
              style={{ animation: "fadeInUp 0.7s ease-out 0.2s both" }}
            >
              Research,<br />
              Redefined by<br />
              <span style={{ fontFamily: "var(--font-playfair)", fontStyle: "italic", color: "#70d8c8" }}>
                Intelligence
              </span>
            </h1>

            {/* Sub-copy */}
            <p
              className="text-lg text-white/60 leading-relaxed mb-10 max-w-lg"
              style={{ animation: "fadeInUp 0.7s ease-out 0.35s both" }}
            >
              An AI agent that doesn&apos;t just read papers — it synthesizes, critiques,
              and connects ideas across thousands of sources in seconds.
            </p>

            {/* CTAs */}
            <div
              className="flex flex-wrap gap-4"
              style={{ animation: "fadeInUp 0.7s ease-out 0.48s both" }}
            >
              <Link
                href={route}
                className="inline-flex items-center gap-2 bg-white hover:bg-white/90 text-primary font-bold rounded-full px-8 h-12 text-base transition-all hover:-translate-y-0.5 shadow-lg shadow-black/20"
              >
                Begin Research <ChevronRight className="size-4" />
              </Link>
              <Link
                href="#methodology"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold rounded-full px-8 h-12 text-base transition-all"
              >
                View Pipeline
              </Link>
            </div>
          </div>

          {/* Right — Live Research Panel */}
          <div className="relative" style={{ animation: "fadeInUp 0.9s ease-out 0.3s both" }}>
            {/* Halo glow */}
            <div
              className="absolute -inset-6 rounded-3xl pointer-events-none"
              style={{ background: "radial-gradient(ellipse at center, rgba(112,216,200,0.12), transparent 70%)" }}
            />

            <div
              className="relative rounded-2xl border border-white/10 overflow-hidden"
              style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(16px)" }}
            >
              {/* Panel chrome */}
              <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="size-2.5 rounded-full bg-white/15" />
                    ))}
                  </div>
                  <span className="text-[0.65rem] text-white/35 font-mono tracking-wide">scholarian.research</span>
                </div>
                <div className="flex items-center gap-1.5 text-tertiary-fixed-dim text-xs font-semibold">
                  <span className="size-1.5 rounded-full bg-tertiary-fixed-dim animate-pulse" />
                  Live
                </div>
              </div>

              {/* Panel content */}
              <div className="p-5 space-y-4">

                {/* Query input */}
                <div className="bg-white/8 rounded-xl px-4 py-3 border border-white/10 flex items-center gap-2.5">
                  <Search className="size-3.5 text-white/35 shrink-0" />
                  <span className="text-sm text-white/65 font-mono">
                    Neuroplasticity mechanisms in adult cortex
                    <span
                      className="inline-block w-0.5 h-4 bg-tertiary-fixed-dim ml-0.5 align-middle"
                      style={{ animation: "blink 1s step-end infinite" }}
                    />
                  </span>
                </div>

                {/* Sources fetched */}
                <div>
                  <div className="text-[0.6rem] font-bold text-white/30 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                    <FileText className="size-3" /> Sources Fetched
                  </div>
                  <div className="space-y-2">
                    {[
                      { src: "arXiv", title: "Synaptic pruning in early cortical development", delay: "0.8s" },
                      { src: "Semantic Scholar", title: "Experience-dependent plasticity in visual cortex", delay: "1.4s" },
                      { src: "Google Scholar", title: "Microglial-mediated synaptic remodeling", delay: "2.0s" },
                    ].map((paper) => (
                      <div
                        key={paper.src}
                        className="flex items-start gap-3 bg-white/5 border border-white/8 rounded-lg px-3 py-2.5"
                        style={{ animation: `fadeInUp 0.5s ease-out ${paper.delay} both` }}
                      >
                        <CheckCircle2 className="size-3.5 text-tertiary-fixed-dim shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[0.58rem] font-bold text-tertiary-fixed-dim/70 uppercase tracking-widest mb-0.5">
                            {paper.src}
                          </div>
                          <div className="text-xs text-white/60">{paper.title}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Synthesis result */}
                <div
                  className="rounded-xl p-4 border border-primary/40"
                  style={{
                    background: "rgba(0,49,120,0.35)",
                    animation: "fadeInUp 0.6s ease-out 2.7s both",
                  }}
                >
                  <div className="flex items-center gap-2 text-[0.6rem] font-bold text-tertiary-fixed-dim uppercase tracking-widest mb-2">
                    <Network className="size-3.5" /> AI Synthesis
                  </div>
                  <p className="text-xs text-white/65 leading-relaxed">
                    Across 42 analyzed papers, bidirectional microglial activity shows consistent
                    evidence of experience-dependent plasticity windows extending into adulthood...
                  </p>
                </div>
              </div>

              {/* Panel footer */}
              <div className="px-5 py-3 border-t border-white/8 flex items-center justify-between">
                <span className="text-[0.65rem] text-white/30">42 papers · 3 databases</span>
                <span className="text-[0.65rem] font-semibold text-tertiary-fixed-dim">Synthesis complete ✓</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/25"
          style={{ animation: "fadeInUp 1s ease-out 1.2s both" }}
        >
          <span className="text-[0.58rem] font-bold uppercase tracking-widest">Scroll</span>
          <div className="w-px h-8 bg-linear-to-b from-white/25 to-transparent" />
        </div>
      </section>

      {/* ── SOURCE CREDIBILITY STRIP ─────────────────────── */}
      {/* <div className="bg-white border-b border-secondary/8 py-4 px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-2">
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-secondary/50">
            Searches across
          </span>
          {["arXiv", "Semantic Scholar", "Google Scholar"].map((src) => (
            <span key={src} className="text-sm font-bold text-on-surface/60 tracking-tight">
              {src}
            </span>
          ))}
        </div>
      </div> */}

      {/* ── FEATURES / BENTO ─────────────────────────────── */}
      <section id="features" className="py-24 px-6 bg-surface-container-low scroll-mt-20">
        <div className="max-w-7xl mx-auto">

          {/* Section header */}
          <div className="mb-14 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/50 mb-3">The Architecture</p>
            <h2 className="text-5xl font-heading font-bold text-on-surface tracking-tight mb-4 leading-tight">
              Built for depth,<br />not just speed.
            </h2>
            <p className="text-secondary text-lg leading-relaxed">
              Every layer of Scholarian is engineered to produce research that rivals months of manual work.
            </p>
          </div>

          {/* Bento grid */}
          <div
            ref={featReveal.ref}
            className={`grid grid-cols-1 md:grid-cols-3 gap-4 transition-all duration-700 ${featReveal.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
          >
            {/* Card 1 — Deep Paper Search (2-col wide) */}
            <div className="md:col-span-2 bg-white rounded-3xl p-8 border border-secondary/10 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
              <div className="w-11 h-11 bg-primary/8 rounded-2xl flex items-center justify-center text-primary mb-6">
                <Search className="size-5" />
              </div>
              <h3 className="text-2xl font-heading font-bold text-on-surface mb-3">Deep Paper Search</h3>
              <p className="text-secondary leading-relaxed mb-6">
                Bypass generic search engines. Our agent queries semantic databases across disciplines,
                surfacing foundational papers and obscure pre-prints through citation graph traversal.
              </p>
              <div className="flex gap-2 flex-wrap">
                {["arXiv", "Semantic Scholar", "Google Scholar", "PubMed"].map((tag) => (
                  <span
                    key={tag}
                    className="text-[0.7rem] font-bold bg-primary/6 text-primary px-3 py-1 rounded-full tracking-wide"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Card 2 — AI Synthesis (spans 2 rows) */}
            <div
              className="md:row-span-2 md:col-start-3 md:row-start-1 rounded-3xl p-8 flex flex-col hover:-translate-y-0.5 transition-all duration-300"
              style={{
                background: "linear-gradient(160deg, #002055 0%, #001a50 100%)",
                boxShadow: "0 8px 32px -8px rgba(0,49,120,0.35)",
              }}
            >
              <div className="w-11 h-11 bg-white/15 rounded-2xl flex items-center justify-center text-white mb-6">
                <Network className="size-5" />
              </div>
              <h3 className="text-2xl font-heading font-bold text-white mb-3">Automated Synthesis</h3>
              <p className="text-white/60 leading-relaxed mb-auto">
                Scholarian reads full texts, extracting methodologies, results, and limitations to
                construct a unified narrative that highlights consensus and contradictions across
                your entire corpus.
              </p>
              <div className="mt-8 space-y-2">
                <div className="text-[0.6rem] font-bold text-white/35 uppercase tracking-widest mb-3">
                  Sample Output
                </div>
                {[
                  "Consensus identified across 38 papers",
                  "3 contradicting methodologies flagged",
                  "Citation map: 214 connections built",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 text-xs text-white/65 rounded-lg px-3 py-2"
                    style={{ background: "rgba(255,255,255,0.07)" }}
                  >
                    <div className="size-1.5 rounded-full bg-tertiary-fixed-dim shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Card 3 — Context-Aware Q&A */}
            <div className="bg-white rounded-3xl p-8 border border-secondary/10 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
              <div className="w-11 h-11 bg-tertiary/8 rounded-2xl flex items-center justify-center text-tertiary mb-6">
                <MessageSquare className="size-5" />
              </div>
              <h3 className="text-xl font-heading font-bold text-on-surface mb-2">
                Context-Aware Interrogation
              </h3>
              <p className="text-secondary text-sm leading-relaxed">
                Ask complex questions and get answers anchored to the exact source passage with live
                citations.
              </p>
            </div>

            {/* Card 4 — Stats */}
            <div className="bg-primary/5 border border-primary/10 rounded-3xl p-8 flex flex-col hover:-translate-y-0.5 transition-all duration-300">
              <div className="text-6xl font-heading font-bold text-primary mb-1 leading-none">2,400+</div>
              <div className="text-xs font-bold text-secondary uppercase tracking-widest mt-1 mb-auto">
                Citations per Query
              </div>
              <p className="text-secondary text-sm mt-6 leading-relaxed">
                Average papers analyzed in a single research session.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PIPELINE (dark) ──────────────────────────────── */}
      <section
        id="methodology"
        className="py-24 px-6 scroll-mt-20 relative overflow-hidden"
        style={{ background: "linear-gradient(180deg, #001228 0%, #002060 100%)" }}
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-tertiary-fixed-dim/50 mb-3">The Methodology</p>
            <h2 className="text-5xl font-heading font-bold text-white tracking-tight mb-4">
              The Research Pipeline
            </h2>
            <p className="text-white/45 text-lg max-w-lg leading-relaxed">
              A transparent, step-by-step view of how Scholarian transforms a topic into actionable intelligence.
            </p>
          </div>

          <div
            ref={pipeReveal.ref}
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 transition-all duration-700 ${pipeReveal.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
          >
            {[
              {
                num: "01",
                title: "Input Topic",
                desc: "Define your research parameter or upload seed papers to establish the initial vector space.",
                graphic: (
                  <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 font-mono text-xs text-white/45">
                    <span className="text-tertiary-fixed-dim">{">"}</span> Neural plasticity...{" "}
                    <span
                      className="inline-block w-0.5 h-3.5 bg-tertiary-fixed-dim align-middle"
                      style={{ animation: "blink 1s step-end infinite" }}
                    />
                  </div>
                ),
              },
              {
                num: "02",
                title: "Fetch & Rank",
                desc: "The agent scours repositories, ranking relevance based on citation graphs and semantic similarity.",
                graphic: (
                  <div className="flex items-end gap-1.5 h-10">
                    {[55, 80, 40, 100, 65, 88, 50].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm"
                        style={{
                          height: `${h}%`,
                          background: `rgba(112,216,200,${0.25 + i * 0.1})`,
                        }}
                      />
                    ))}
                  </div>
                ),
              },
              {
                num: "03",
                title: "Synthesize",
                desc: "Extraction of core findings, methodologies, and data points assembled into a coherent literature matrix.",
                graphic: (
                  <div className="flex items-center gap-3">
                    <div className="relative size-10 shrink-0">
                      <svg className="size-10 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="14" fill="none"
                          stroke="#70d8c8" strokeWidth="3"
                          strokeDasharray="88" strokeDashoffset="20"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <span className="text-xs text-white/45">Analyzing context...</span>
                  </div>
                ),
              },
              {
                num: "04",
                title: "Refine & Report",
                desc: "Iterative human-in-the-loop chat to drill into methodological details and receive the final report.",
                graphic: (
                  <div className="flex items-center gap-2 bg-tertiary-fixed-dim/10 border border-tertiary-fixed-dim/20 rounded-lg px-3 py-2">
                    <CheckCircle2 className="size-4 text-tertiary-fixed-dim shrink-0" />
                    <span className="text-xs font-semibold text-tertiary-fixed-dim">Report Ready</span>
                  </div>
                ),
              },
            ].map((step) => (
              <div
                key={step.num}
                className="relative rounded-2xl p-6 border border-white/8 flex flex-col gap-5"
                style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(8px)" }}
              >
                {/* Watermark number */}
                <div className="absolute -top-2 -right-1 text-8xl font-heading font-bold text-white/[0.035] pointer-events-none select-none leading-none">
                  {step.num}
                </div>
                <div>
                  <div className="text-[0.58rem] font-bold text-white/28 uppercase tracking-widest mb-2">
                    Step {step.num}
                  </div>
                  <h3 className="text-lg font-heading font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-white/45 leading-relaxed">{step.desc}</p>
                </div>
                <div className="mt-auto pt-4 border-t border-white/8">{step.graphic}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white border-b border-secondary/8">
        <div className="max-w-5xl mx-auto">
          <div
            ref={statsReveal.ref}
            className={`grid grid-cols-1 md:grid-cols-3 gap-12 text-center transition-all duration-700 ${statsReveal.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
          >
            <div ref={stat1.ref} className="space-y-2">
              <div className="text-7xl font-heading font-bold text-primary tabular-nums leading-none">
                {stat1.count.toLocaleString()}+
              </div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">
                Papers per Query
              </div>
            </div>
            <div ref={stat2.ref} className="space-y-2">
              <div className="text-7xl font-heading font-bold text-primary tabular-nums leading-none">
                {stat2.count}s
              </div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">
                Avg. Synthesis Time
              </div>
            </div>
            <div ref={stat3.ref} className="space-y-2">
              <div className="text-7xl font-heading font-bold text-primary tabular-nums leading-none">
                {stat3.count}
              </div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">
                Academic Databases
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section
        className="py-28 px-6 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #001a42 0%, #002055 100%)" }}
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Teal glow */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[320px] rounded-full pointer-events-none opacity-15"
          style={{ background: "radial-gradient(ellipse, #70d8c8 0%, transparent 70%)" }}
        />

        <div
          ref={ctaReveal.ref}
          className={`max-w-4xl mx-auto text-center relative z-10 transition-all duration-700 ${ctaReveal.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-tertiary-fixed-dim/55 mb-5">
            Get Started Today
          </p>
          <h2 className="text-5xl md:text-6xl font-heading font-bold text-white tracking-tight mb-6 leading-tight">
            Start your first<br />
            <span style={{ fontFamily: "var(--font-playfair)", fontStyle: "italic", color: "#70d8c8" }}>
              research session
            </span>
            <br />in 60 seconds.
          </h2>
          <p className="text-white/45 text-lg mb-10 max-w-md mx-auto">
            No setup required. Sign in and let Scholarian do the heavy lifting.
          </p>
          <Link
            href={route}
            className="inline-flex items-center gap-3 bg-white hover:bg-white/90 text-primary font-bold rounded-full px-10 h-14 text-lg transition-all hover:-translate-y-0.5 shadow-[0_8px_40px_-8px_rgba(0,0,0,0.4)]"
          >
            Begin Analysis <ArrowRight className="size-5" />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="bg-surface border-t border-secondary/10 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Image src="/favicon.svg" alt="Scholarian Logo" width={28} height={28} className="size-7 block p-0.5 select-none" />
            <span className="text-base font-heading font-bold tracking-tight text-primary">Scholarian</span>
          </div>
          <div className="text-[0.68rem] text-secondary/50 uppercase tracking-widest">
            © 2026 Scholarian
          </div>
        </div>
      </footer>
    </main>
  );
}
