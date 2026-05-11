import Link from "next/link";
import { 
  ArrowRight, 
  Search, 
  Network, 
  MessageSquare,
  Sparkles,
  ChevronRight,
  Database,
  FileText
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  // Redirect to auth only as dashboard is removed
  const newProjectRoute = "/auth";

  return (
    <main className="min-h-screen bg-surface selection:bg-primary/20 text-on-surface font-sans">
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-md border-b border-secondary/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-xl font-heading font-bold tracking-tight text-on-surface">Scholarian</span>
          </div>
          
          <div className="flex items-center gap-4 text-secondary">
            <Link href={newProjectRoute} className="inline-flex items-center justify-center rounded-full bg-primary hover:bg-primary-container text-white border-0 h-9 px-6 ml-2 font-medium text-sm transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 lg:pt-40 pb-24 px-6 max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-8">
        
        <div className="flex-1 max-w-2xl">
          {/* Removed announcement badge per user request */}
          
          <h1 className="text-6xl md:text-7xl font-heading font-semibold leading-[1.05] tracking-tight mb-8">
            Research <br />
            Redefined by <br />
            <span className="text-primary">Intelligence</span>
          </h1>
          
          <p className="text-xl text-secondary leading-relaxed mb-10 max-w-xl">
            Automate deep academic research with an AI agent that doesn&apos;t just read papers— it synthesizes, critiques, and connects complex ideas to accelerate your analytical workflow.
          </p>
          
          <div className="flex flex-wrap items-center gap-4 mb-12">
            <Link href={newProjectRoute} className="inline-flex items-center justify-center rounded-full bg-primary hover:bg-primary-container text-white px-8 h-12 text-base font-semibold group transition-colors">
              Begin Analysis
              <ChevronRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="#pipeline" className="inline-flex items-center justify-center rounded-full bg-white border border-secondary/20 text-primary hover:bg-surface-container-low px-8 h-12 text-base font-semibold cursor-pointer transition-colors shadow-sm">
              View Methodology
            </Link>
          </div>

          {/* Removed trust badges per user request */}
        </div>

        {/* Hero Graphic (The overlapping cards) */}
        <div className="flex-1 w-full relative">
          <div className="relative z-10 bg-white rounded-3xl p-6 shadow-[0_32px_64px_-12px_rgba(0,49,120,0.1)] border border-secondary/10 ml-auto max-w-md">
            
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 font-medium">
                <Search className="w-4 h-4 text-primary" />
                <span className="text-on-surface">Query: Neural Plasticity Mechanisms</span>
              </div>
              <Badge className="bg-tertiary-fixed-dim/30 text-tertiary border-none rounded-sm">Active</Badge>
            </div>

            <div className="bg-surface rounded-xl p-4 mb-4 border border-secondary/5">
              <div className="flex items-center gap-2 text-xs font-bold text-secondary tracking-widest uppercase mb-2">
                <FileText className="w-3.5 h-3.5" /> SOURCE EXTRACTED
              </div>
              <h4 className="font-semibold text-on-surface mb-1 text-sm">Synaptic pruning in early development</h4>
              <p className="text-xs text-secondary leading-relaxed">
                Recent longitudinal studies indicate a higher rate of microglial-mediated pruning than previously modeled in standard cortical...
              </p>
            </div>

            <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
              <div className="flex items-center gap-2 text-xs font-bold text-primary tracking-widest uppercase mb-2">
                <Network className="w-3.5 h-3.5" /> AI SYNTHESIS
              </div>
              <p className="text-sm text-on-surface leading-relaxed">
                Across 42 analyzed papers, the consensus points toward a bidirectional interaction between microglial activity and experience-dependent...
              </p>
            </div>

          </div>

          <div className="absolute -bottom-8 -right-4 md:-right-12 z-20 bg-white rounded-2xl p-6 shadow-[0_24px_48px_-12px_rgba(0,49,120,0.15)] border border-secondary/10 flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-tertiary-fixed-dim/30 flex items-center justify-center text-tertiary shrink-0 mt-1">
               <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="text-3xl font-heading font-bold text-on-surface mb-1">2,410</div>
              <div className="text-[0.65rem] font-bold text-secondary tracking-widest uppercase">CITATIONS ANALYZED</div>
            </div>
          </div>
        </div>

      </section>

      {/* Architecture Section */}
      <section className="bg-surface-container-low py-24 px-6 border-y border-secondary/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-4xl font-heading font-semibold text-on-surface mb-6">The Architecture of Insight</h2>
            <p className="text-[1.1rem] text-secondary leading-relaxed">
              Scholarian replaces manual literature reviews with an intelligent pipeline designed for exhaustive, context-aware analysis.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-secondary/10 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-6">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-heading font-semibold mb-4 text-on-surface">Deep Paper Search</h3>
              <p className="text-secondary leading-relaxed text-sm mb-8">
                Bypass generic academic search engines. Our agent queries semantic databases across multiple disciplines, surfacing foundational papers and obscure pre-prints alike.
              </p>
              <Link href="#" className="flex items-center text-primary text-xs font-bold uppercase tracking-widest hover:gap-3 gap-2 transition-all">
                EXPLORE COVERAGE <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-sm border border-secondary/10 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-tertiary-container/10 rounded-xl flex items-center justify-center text-tertiary mb-6">
                <Network className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-heading font-semibold mb-4 text-on-surface">Automated Synthesis</h3>
              <p className="text-secondary leading-relaxed text-sm mb-8">
                Scholarian reads full texts, extracting methodologies, results, and limitations to construct a unified narrative that highlights consensus and contradictions.
              </p>
              <Link href="#" className="flex items-center text-tertiary text-xs font-bold uppercase tracking-widest hover:gap-3 gap-2 transition-all">
                VIEW SAMPLE SYNTHESIS <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-sm border border-secondary/10 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-tertiary-fixed-dim/20 rounded-xl flex items-center justify-center text-tertiary mb-6">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-heading font-semibold mb-4 text-on-surface">Context-Aware Interrogation</h3>
              <p className="text-secondary leading-relaxed text-sm mb-8">
                Engage in a dynamic dialogue with your curated library. Ask complex, multi-variable questions and receive citations anchored directly to the source text.
              </p>
              <Link href="#" className="flex items-center text-tertiary text-xs font-bold uppercase tracking-widest hover:gap-3 gap-2 transition-all">
                TRY INTERACTIVE CHAT <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* The Research Pipeline Section */}
      <section id="pipeline" className="py-24 px-6 bg-surface relative overflow-hidden scroll-mt-20">
        <div className="max-w-7xl mx-auto relative z-10">
          
          <div className="max-w-2xl mb-20">
            <h2 className="text-4xl font-heading font-semibold text-on-surface mb-6">The Research Pipeline</h2>
            <p className="text-[1.1rem] text-secondary leading-relaxed font-medium opacity-80">
              A transparent, step-by-step view of how Scholarian processes complex academic queries into actionable Intelligence.
            </p>
          </div>

          <div className="relative">
            {/* Horizontal Line behind steps - aligned to center of circles */}
            <div className="absolute top-5 left-8 right-8 h-[1px] bg-secondary/10 -z-10 hidden lg:block" />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Step 1 */}
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm mb-6 border-4 border-surface shadow-sm">
                  1
                </div>
                <div className="bg-white rounded-xl p-8 shadow-sm border border-secondary/5 h-[320px] flex flex-col">
                  <h3 className="text-xl font-heading font-bold mb-4 text-on-surface">Input Topic</h3>
                  <p className="text-sm text-secondary leading-relaxed mb-6 font-medium">
                    Define your research parameter or upload seed papers to establish the initial vector space.
                  </p>
                  <div className="mt-auto">
                    <div className="bg-[#f8fafc] rounded-lg p-4 text-[0.7rem] font-mono text-secondary leading-relaxed border border-secondary/5">
                      {">"} Initialize research <br /> directive...
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm mb-6 border-4 border-surface shadow-sm">
                  2
                </div>
                <div className="bg-white rounded-xl p-8 shadow-sm border border-secondary/5 h-[320px] flex flex-col">
                  <h3 className="text-xl font-heading font-bold mb-4 text-on-surface">Fetch & Rank</h3>
                  <p className="text-sm text-secondary leading-relaxed mb-6 font-medium">
                    The agent scours repositories, ranking relevance based on citation graphs and semantic similarity.
                  </p>
                  <div className="mt-auto flex gap-3">
                    <div className="bg-[#e0f2fe] text-[#0369a1] px-3 py-1 text-[0.65rem] font-bold rounded-sm tracking-widest">SEMANTIC</div>
                    <div className="bg-[#e0f2fe] text-[#0369a1] px-3 py-1 text-[0.65rem] font-bold rounded-sm tracking-widest">GRAPH DATA</div>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm mb-6 border-4 border-surface shadow-sm">
                  3
                </div>
                <div className="bg-white rounded-xl p-8 shadow-sm border border-secondary/5 h-[320px] flex flex-col">
                  <h3 className="text-xl font-heading font-bold mb-4 text-on-surface">Synthesize</h3>
                  <p className="text-sm text-secondary leading-relaxed mb-6 font-medium">
                    Extraction of core findings, methodologies, and data points, assembled into a coherent literature matrix.
                  </p>
                  <div className="mt-auto flex items-center gap-2 text-xs font-bold text-[#0d9488]">
                    <div className="w-4 h-4 rounded-full border-2 border-[#0d9488]/30 border-t-[#0d9488] animate-spin" />
                    Processing Context...
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm mb-6 border-4 border-surface shadow-sm">
                  4
                </div>
                <div className="bg-white rounded-xl p-8 shadow-sm border border-secondary/5 h-[320px] flex flex-col">
                  <h3 className="text-xl font-heading font-bold mb-4 text-on-surface">Refine</h3>
                  <p className="text-sm text-secondary leading-relaxed mb-6 font-medium">
                    Iterative review through human-in-the-loop chat to drill down into specific methodological details.
                  </p>
                  <div className="mt-auto">
                    <div className="w-full bg-[#eff6ff] text-[#1d4ed8] font-bold py-4 text-[0.8rem] rounded-md text-center">
                      View Final Report
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface py-12 px-6 border-t border-secondary/10">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-8">
          
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center text-white">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span className="text-lg font-heading font-bold tracking-tight text-primary">Scholarian</span>
          </div>

          {/* <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4 text-[0.7rem] font-bold text-secondary tracking-widest uppercase">
            <Link href="#" className="hover:text-primary transition-colors">Methodology</Link>
            <Link href="#" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-primary transition-colors">Terms of Service</Link>
            <Link href="#" className="hover:text-primary transition-colors">API Documentation</Link>
            <Link href="#" className="hover:text-primary transition-colors">Research Ethics</Link>
          </div> */}

          <div className="text-[0.7rem] text-secondary tracking-widest uppercase text-center lg:text-right max-w-[200px] leading-relaxed">
            © 2026 Scholarian. Precision in every insight.
          </div>

        </div>
      </footer>
    </main>
  );
}
