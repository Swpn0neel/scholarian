import { NextResponse } from "next/server";
import { z } from "zod";
import { deduplicatePapers } from "@/lib/pipeline/deduplicate";
import { rankPapers, rankPapersPass1, embedQuery } from "@/lib/pipeline/rank";
import { requireAuth } from "@/lib/supabase/requireAuth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchArxivPapers } from "@/lib/pipeline/fetchers/arxiv";
import { fetchSemanticScholarPapers } from "@/lib/pipeline/fetchers/semanticScholar";
import { fetchSerpApiPapers } from "@/lib/pipeline/fetchers/serpapi";
import type { RawPaper } from "@/types";
import { calculateDynamicParams } from "@/lib/pipeline/score";

const schema = z.object({
  chatId: z.string(),
  excludeTitles: z.array(z.string()).optional().default([]),
  settings: z.object({
    topic: z.string().min(1),
    maxPapers: z.number().min(1).max(200),
    topK: z.number().min(1).max(20),
    weightRelevance: z.number().min(0),
    weightCitation: z.number().min(0),
    weightRecency: z.number().min(0),
  }),
});

function send(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}


export async function POST(request: Request) {
  // Auth guard — 401 for unauthenticated callers when Supabase is configured
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { chatId, settings, excludeTitles = [] } = schema.parse(await request.json());
  const supabase = await createServerSupabaseClient();

  // Build a lowercase set of titles to exclude (from the previous run's top-K)
  const excludedSet = new Set(excludeTitles.map((t) => t.toLowerCase().trim()));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const query = settings.topic;

        send(controller, "step", { step: "fetching", message: `Fetching papers using query: "${query}"...` });
        
        // Ask every source for the full maxPapers quota so that if one source
        // under-delivers (or fails), the others can compensate. Each fetcher
        // already clamps to its own API ceiling (SerpAPI → 20, Semantic Scholar
        // → 100), so we won't over-fetch beyond those hard limits.
        const [arxiv, semantic, serp] = await Promise.allSettled([
          fetchArxivPapers(query, settings.maxPapers),
          fetchSemanticScholarPapers(query, settings.maxPapers),
          fetchSerpApiPapers(query, settings.maxPapers),
        ]);
      
        const arxivPapers = arxiv.status === "fulfilled" ? arxiv.value : [];
        const semanticPapers = semantic.status === "fulfilled" ? semantic.value : [];
        const serpPapers = serp.status === "fulfilled" ? serp.value : [];

        // Log per-source counts and surface any sources that failed/contributed nothing
        const failedSources: string[] = [];
        if (arxiv.status === "rejected") failedSources.push("arXiv");
        if (semantic.status === "rejected") failedSources.push("Semantic Scholar");
        if (serp.status === "rejected") failedSources.push("Google Scholar");

        send(controller, "step", {
          step: "fetching",
          message: `Sources returned: arXiv ${arxivPapers.length}, Semantic Scholar ${semanticPapers.length}, Google Scholar ${serpPapers.length}${failedSources.length ? ` · ⚠ ${failedSources.join(", ")} unavailable` : ""}.`,
        });

        // Merge all source results into one pool (no round-robin cap yet —
        // we rank all candidates first and let quality decide the final set).
        const allPapers: RawPaper[] = [...arxivPapers, ...semanticPapers, ...serpPapers];

        send(controller, "step", {
          step: "fetching",
          message: `Combined ${allPapers.length} candidates from all sources. Beginning quality filtering...`,
        });

        // Filter out papers already seen in the previous run so fresh results
        // get ranked higher in refinement cycles.
        const filtered = excludedSet.size > 0
          ? allPapers.filter((p) => !excludedSet.has(p.title.toLowerCase().trim()))
          : allPapers;

        if (excludedSet.size > 0) {
          send(controller, "step", {
            step: "fetching",
            message: `Excluded ${allPapers.length - filtered.length} previously-seen papers. ${filtered.length} new candidates remaining.`,
          });
        }

        // Deduplicate the full pool — no cap yet; we want every candidate
        // available for the internal quality-filter pass.
        const deduped = deduplicatePapers(filtered);
        send(controller, "step", {
          step: "deduplicating",
          message: `${filtered.length} papers → ${deduped.length} unique after deduplication.`,
        });

        send(controller, "step", { step: "embedding", message: "Generating 768-dimensional semantic embeddings..." });

        // Embed the query so we can compute real cosine similarity
        // against each paper's abstract embedding.
        const queryEmbedding = await embedQuery(query);

        send(controller, "step", { step: "embedding", message: "Embeddings complete. Comparing vector distances..." });

        // ── Ranking strategy ──────────────────────────────────────────────────
        // If the deduplicated pool already fits within maxPapers, there is
        // nothing to trim — rank everything in a single pass and show it all.
        //
        // Only when the pool EXCEEDS maxPapers do we run a two-pass approach:
        //   Pass 1 — score the full pool (cohort-relative stats are accurate
        //             because every candidate participates).
        //   Quality filter — drop the bottom 40% of the score distribution so
        //             genuinely weak papers (low relevance + low citations +
        //             very old) never reach the user.
        //   Cap — take the top-N survivors.
        //   Pass 2 — re-rank the final cohort so cohort-relative metrics
        //             (percentile citations, dynamic recency half-life) reflect
        //             the *final* set rather than the larger candidate pool.

        let ranked: Awaited<ReturnType<typeof rankPapers>>;
        let recencyWindow: number;
        let recencyHalfLife: number;
        let cappedCandidates: RawPaper[];

        if (deduped.length <= settings.maxPapers) {
          // ── Single-pass: pool already fits, rank everything ─────────────────
          send(controller, "step", {
            step: "scoring",
            message: `Pool (${deduped.length} papers) fits within the ${settings.maxPapers}-paper limit — ranking all candidates directly.`,
          });
          const params = calculateDynamicParams(deduped);
          recencyWindow    = params.recencyWindow;
          recencyHalfLife  = params.recencyHalfLife;
          cappedCandidates = deduped;
          ranked = await rankPapers(deduped, settings, queryEmbedding);
        } else {
          // ── Two-pass: pool exceeds maxPapers ────────────────────────────────
          // Pass 1 — rank the full pool, then hand the top maxPapers to Pass 2.
          // No quality filter — we simply take the best candidates by score.

          const { recencyWindow: rw1, recencyHalfLife: rhl1 } = calculateDynamicParams(deduped);
          send(controller, "step", {
            step: "scoring",
            message: `Pass 1 — scoring all ${deduped.length} candidates (recency window: ${rw1} yrs · half-life: ${rhl1} yrs)...`,
          });
          const internalRanked = await rankPapersPass1(deduped, settings, queryEmbedding);

          // ── Transparent: send Pass 1 intermediate results to the client ────
          // These are ephemeral — NOT saved to the database.
          // Strip embeddings to prevent blowing up the Vercel SSE payload limit.
          const pass1Payload = internalRanked.map(({ embedding: _e, ...paper }) => paper);
          send(controller, "pass1_papers", pass1Payload);

          // Take the top maxPapers and strip RankedPaper → RawPaper so Pass 2
          // gets a clean input (no stale scores bleeding in).
          cappedCandidates = internalRanked
            .slice(0, settings.maxPapers)
            .map(({ simScore: _s, citationScore: _c, recencyScore: _r, finalScore: _f, rank: _rk, embedding: _e, ...raw }) => raw);

          send(controller, "step", {
            step: "scoring",
            message: `Pass 1 selected top ${cappedCandidates.length} of ${deduped.length} candidates. Re-ranking for Pass 2...`,
          });

          // Pass 2 — re-rank the capped cohort so cohort-relative scores are tight
          const params = calculateDynamicParams(cappedCandidates);
          recencyWindow   = params.recencyWindow;
          recencyHalfLife = params.recencyHalfLife;
          send(controller, "step", {
            step: "scoring",
            message: `Pass 2 — final ranking (recency window: ${recencyWindow} yrs · half-life: ${recencyHalfLife} yrs)...`,
          });
          ranked = await rankPapers(cappedCandidates, settings, queryEmbedding);
        }
        
        const runId = crypto.randomUUID();
        
        send(controller, "step", { step: "ranked", message: "Saving papers to database..." });
        
        // Insert papers into Supabase — use the actual DB column names.
        // Note: this table was created with camelCase column names.
        const papersToInsert = ranked.map((paper) => ({
          run_id: runId,
          chat_id: chatId,
          title: paper.title,
          abstract: paper.abstract,
          authors: paper.authors,
          year: paper.year,
          citationCount: paper.citationCount,
          doi: paper.doi,
          venue: paper.venue,
          url: paper.url,
          pdfUrl: paper.pdfUrl,
          source: paper.source,
          simScore: paper.simScore,
          citationScore: paper.citationScore,
          recencyScore: paper.recencyScore,
          finalScore: paper.finalScore,
          rank: paper.rank,
        }));
        
        const { error: dbError } = await supabase.from("papers").insert(papersToInsert);
        if (dbError) {
          console.error("Failed to save papers to database:", dbError);
        }

        // Persist run metadata (settings + events) immediately on the server so the
        // run is fully recoverable even if the user navigates away before the client
        // has a chance to call /api/pipeline/metadata.
        const scoringEventMsg = deduped.length <= settings.maxPapers
          ? `Pool (${ranked.length} papers) fit within ${settings.maxPapers}-paper limit — ranked directly.`
          : `Pass 1 ranked ${deduped.length} candidates; top ${cappedCandidates.length} passed to Pass 2 (recency window: ${recencyWindow} yrs · half-life: ${recencyHalfLife} yrs).`;

        const pipelineEvents = [
          { step: "fetching",      message: `Sources returned: arXiv ${arxivPapers.length}, Semantic Scholar ${semanticPapers.length}, Google Scholar ${serpPapers.length}${failedSources.length ? ` · ⚠ ${failedSources.join(", ")} unavailable` : ""}.`, ts: Date.now() - 6000 },
          { step: "fetching",      message: `Combined ${allPapers.length} candidates from all sources.`,                                                                                 ts: Date.now() - 5000 },
          { step: "deduplicating", message: `${filtered.length} papers → ${deduped.length} unique after deduplication.`,                                                                ts: Date.now() - 4000 },
          { step: "embedding",     message: "Embeddings complete. Comparing vector distances...",                                                                                         ts: Date.now() - 3000 },
          { step: "scoring",       message: scoringEventMsg,                                                                                                                             ts: Date.now() - 2000 },
          { step: "ranked",        message: `Ranked ${ranked.length} papers by composite score.`,                                                                                        ts: Date.now() - 1000 },
        ];

        const { error: metaError } = await supabase.from("run_metadata").upsert(
          {
            run_id: runId,
            chat_id: chatId,
            topic: settings.topic,
            max_papers: settings.maxPapers,
            top_k: settings.topK,
            weight_relevance: settings.weightRelevance,
            weight_citation: settings.weightCitation,
            weight_recency: settings.weightRecency,
            events: pipelineEvents,
          },
          { onConflict: "run_id" }
        );
        if (metaError) {
          console.error("Failed to save run metadata to database:", metaError);
        }

        const papersPayload = ranked.map(({ embedding: _e, ...paper }) => paper);
        send(controller, "papers", papersPayload);
        send(controller, "done", { runId, chatId });
      } catch (error) {
        send(controller, "error", { message: error instanceof Error ? error.message : "Pipeline failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
