# Scholarian: Research Redefined by Intelligence

Scholarian is a high-end, editorial research platform designed to transform the traditional "dashboard fatigue" of academic tools into a focused, analytical journey. It replaces manual literature reviews with an intelligent pipeline that scours semantic databases, synthesizes multi-variable findings, and engages in context-aware interrogation.

![Project Landing Page](./public/landing.png)

## 🏛 The Architecture of Insight

Scholarian is built on three core pillars designed for exhaustive academic analysis:

### 1. Deep Paper Search
Bypass generic academic search engines. Our agent queries semantic databases across multiple disciplines, surfacing foundational papers and obscure pre-prints alike through high-precision vector spaces.

### 2. Automated Synthesis
Scholarian extracts core findings, methodologies, and data points from full texts, assembling them into a unified narrative that highlights both academic consensus and critical contradictions.

### 3. Context-Aware Interrogation
Engage in a dynamic dialogue with your curated library. Ask complex questions and receive citations anchored directly to the source text, ensuring every insight is verifiable.

---

## ✨ Key Features

- **Persistent Research History**: Every search run, ranked paper set, and generated report is persisted via Supabase, allowing you to resume your research across sessions.
- **Stateful Research Pipeline**: A real-time, event-driven pipeline that tracks every stage from query enrichment to report generation with detailed logging.
- **Optimistic UI Updates**: Instantaneous sidebar navigation and chat management (create, rename, delete) powered by a global Zustand state.
- **Smart Refinement**: Built-in intent analysis that understands when you want to narrow down your topic, re-running the pipeline with excluded previous results to surface fresh insights.
- **Analytical Lens Workspace**: A premium, responsive research dashboard featuring resizable sidebars, fullscreen report viewing, and horizontal data grids optimized for all devices.
- **PDF Export Engine**: Generate high-fidelity PDF versions of your research reports and comparative analyses for offline study.

---

## 🎨 The "Analytical Lens" Design System

Scholarian follows a unique design philosophy we call **The Analytical Lens**.

- **Editorial Layout**: Moving away from complex spreadsheets toward a high-fidelity, readable editorial layout.
- **Micro-interactions**: Subtle hover effects and state transitions (like the Research Pipeline progress indicators) that provide immediate, premium feedback.
- **Premium Aesthetics**: A custom-curated color palette (Surface, On-Surface, Primary) and modern typography (Cabinet Grotesk / Inter) optimized for long-form reading and analysis.

---

## 🛠 Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, Turbopack)
- **AI Core**: [Google Generative AI (Gemini)](https://ai.google.dev/)
- **Database & Auth**: [Supabase](https://supabase.com/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Styling**: [Tailwind CSS 4.0](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Components**: [Base UI](https://base-ui.com/) & Radix-inspired custom builders
- **Language**: [TypeScript](https://www.typescriptlang.org/)

---

## 🚀 Getting Started

### Prerequisites

You will need the following environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

### Installation

1. Install the dependencies using `pnpm`:
```bash
pnpm install
```

2. Run the development server:
```bash
pnpm dev
```

3. Open [http://localhost:3000](http://localhost:3000) with your browser to explore the landing page and the research workspace.

---

## 🗝 License

Copyright © 2026 Scholarian AI. Distributed under the MIT License. Precision in every insight.
