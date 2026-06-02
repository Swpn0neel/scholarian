import { NextResponse } from "next/server";
import { z } from "zod";
import { deduplicatePapers } from "@/lib/pipeline/deduplicate";
import { rankPapers, embedQuery } from "@/lib/pipeline/rank";
import { requireAuth } from "@/lib/supabase/requireAuth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchArxivPapers } from "@/lib/pipeline/fetchers/arxiv";
import { fetchSemanticScholarPapers } from "@/lib/pipeline/fetchers/semanticScholar";
import { fetchSerpApiPapers } from "@/lib/pipeline/fetchers/serpapi";
import type { RankedPaper, RawPaper } from "@/types";
import { executeWithGeminiFallback } from "@/lib/pipeline/gemini";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum semantic similarity score for a paper to count toward the auto-mode quota. */
const AUTO_RELEVANCE_THRESHOLD = 0.5;

/** Maximum fetch rounds in Smart Mode (1 initial + up to 3 retries). */
const AUTO_MAX_ROUNDS = 4;

// ─── Query helpers ────────────────────────────────────────────────────────────

/**
 * Uses gemini-2.5-flash-lite to assess whether the user's query is vague and,
 * if so, rewrites it into a precise, academic-grade search query.
 * Returns the original query if refinement fails.
 */
async function refineQueryIfNeeded(originalQuery: string): Promise<string> {
  const wordCount = originalQuery.trim().split(/\s+/).length;

  const prompt = `You are an expert academic research librarian. Your job is to transform a user's research topic into a rich, precise academic search query optimised for databases like arXiv and Semantic Scholar.

User's topic: "${originalQuery}"

Rules:
1. ALWAYS expand and enrich the query — even if it already sounds technical. Short queries (fewer than 6 words) are ALWAYS too vague and MUST be expanded significantly.
2. Add specific techniques, methods, algorithms, or sub-domains relevant to the topic.
3. Include application context or problem framing where it helps narrow the scope.
4. Use terminology that would appear in academic paper titles and abstracts.
5. Keep the final query under 20 words.
6. Return ONLY the refined query — no explanation, no quotes, no bullet points. Just the raw query text.

Examples:
- "image encryption" → "chaos-based image encryption algorithms using hyperchaotic maps and pixel scrambling"
- "AI in medicine" → "deep learning for medical image segmentation and clinical decision support systems"
- "quantum computers" → "quantum error correction algorithms for fault-tolerant superconducting qubit systems"
- "climate change" → "climate change impacts on ecosystem resilience and biodiversity loss mechanisms"
- "drug discovery" → "machine learning approaches for molecular property prediction and de novo drug design"
- "neural networks" → "deep neural network architectures for image classification and transfer learning"
- "blockchain security" → "blockchain consensus mechanisms and smart contract vulnerability detection"

Current query word count: ${wordCount} word${wordCount === 1 ? "" : "s"} — ${wordCount < 6 ? "DEFINITELY too short, must be expanded significantly" : "may still need enrichment"}.

Refined academic query:`;

  try {
    const result = await executeWithGeminiFallback(
      async (model) => {
        const response = await model.generateContent(prompt);
        return response.response.text().trim();
      },
      "gemini-2.5-flash-lite"
    );
    // Sanity check: if the model returns something wildly long or empty, fall back
    if (!result || result.length > 300) return originalQuery;
    // Strip any accidental leading/trailing quotes the model may add
    const cleaned = result.replace(/^["']|["']$/g, "").trim();
    return cleaned || originalQuery;
  } catch {
    // Refinement is a best-effort step — never block the pipeline
    return originalQuery;
  }
}

/**
 * Produces an alternative search query using synonym/terminology expansion.
 *
 * The goal is to surface papers that use DIFFERENT VOCABULARY for the EXACT
 * SAME research topic — not to shift angle or broaden the domain.
 *
 * Each round uses a different expansion strategy so successive rounds aren't
 * just paraphrasing each other:
 *   Round 2 → preferred technical synonyms & method names
 *   Round 3 → sub-domain / specialised application of the same concept
 *   Round 4 → foundational / formal terminology of the same concept
 */
async function diversifyQuery(baseQuery: string, round: number): Promise<string> {
  const strategies: [string, string][] = [
    [
      "alternative technical synonyms and method names",
      `Replace key terms with widely-used synonyms or alternative method names in the same field.
Example: "deep learning image classification" → "convolutional neural network visual recognition CNN"
Example: "quantum error correction superconducting qubits" → "fault-tolerant quantum gates qubit decoherence topological codes"`,
    ],
    [
      "sub-domain and specialised application within the same field",
      `Narrow to a recognised sub-domain or specialised application context of the same research area.
Example: "natural language processing text generation" → "large language model autoregressive text synthesis transformer"
Example: "federated learning privacy" → "differential privacy decentralized gradient aggregation secure computation"`,
    ],
    [
      "foundational and formal terminology of the same concept",
      `Express the same concept using more theoretical, mathematical, or foundational terminology.
Example: "image segmentation deep learning" → "pixel-wise semantic labelling fully convolutional network feature pyramid"
Example: "reinforcement learning robotics" → "Markov decision process policy gradient reward shaping autonomous agent"`,
    ],
  ];

  // round starts from 2 when this is called; index = round - 2
  const [strategyName, strategyHint] = strategies[(round - 2) % strategies.length] ?? strategies[0]!;

  const prompt = `You are an academic search expert specialising in query expansion for databases like arXiv and Semantic Scholar.

Task: produce an ALTERNATIVE search query that uses DIFFERENT but EQUIVALENT terminology to find additional papers on the EXACT SAME research topic.

Original query: "${baseQuery}"
Expansion strategy: ${strategyName}
How to apply it:
${strategyHint}

STRICT RULES (violations will produce useless results):
1. The output MUST target the exact same research topic — zero topic drift allowed.
2. Do NOT generalise, broaden, or shift to a related-but-different domain.
3. Do NOT introduce unrelated applications or tangential fields.
4. Use only terms that a researcher in this field would recognise as equivalent.
5. Keep the result under 20 words.
6. Return ONLY the query text — no explanation, no quotes, no punctuation.

Alternative query:`;

  try {
    const result = await executeWithGeminiFallback(
      async (model) => {
        const response = await model.generateContent(prompt);
        return response.response.text().trim();
      },
      "gemini-2.5-flash-lite"
    );
    if (!result || result.length > 300) return baseQuery;
    const cleaned = result.replace(/^["']|["']$/g, "").trim();
    return cleaned || baseQuery;
  } catch {
    return baseQuery;
  }
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

/** Fetch from all 3 sources in parallel, merging into a single flat array. */
async function fetchAllSources(query: string, limit: number): Promise<{
  papers: RawPaper[];
  sourceCounts: { arxiv: number; semantic: number; serp: number };
  failedSources: string[];
}> {
  const [arxiv, semantic, serp] = await Promise.allSettled([
    fetchArxivPapers(query, limit),
    fetchSemanticScholarPapers(query, limit),
    fetchSerpApiPapers(query, limit),
  ]);

  const arxivPapers = arxiv.status === "fulfilled" ? arxiv.value : [];
  const semanticPapers = semantic.status === "fulfilled" ? semantic.value : [];
  const serpPapers = serp.status === "fulfilled" ? serp.value : [];

  const failedSources: string[] = [];
  if (arxiv.status === "rejected") failedSources.push("arXiv");
  if (semantic.status === "rejected") failedSources.push("Semantic Scholar");
  if (serp.status === "rejected") failedSources.push("Google Scholar");

  return {
    papers: [...arxivPapers, ...semanticPapers, ...serpPapers],
    sourceCounts: { arxiv: arxivPapers.length, semantic: semanticPapers.length, serp: serpPapers.length },
    failedSources,
  };
}

// ─── Schema ───────────────────────────────────────────────────────────────────

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
    enhanceQuery: z.boolean().optional().default(false),
    autoMode: z.boolean().optional().default(false),
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
        const originalQuery = settings.topic;
        let query = originalQuery;

        if (settings.enhanceQuery) {
          send(controller, "step", { step: "fetching", message: `Analysing query with Gemini...` });
          query = await refineQueryIfNeeded(originalQuery);
          const wasRefined = query.toLowerCase().trim() !== originalQuery.toLowerCase().trim();

          if (wasRefined) {
            send(controller, "step", {
              step: "fetching",
              message: `Query refined: "${originalQuery}" → "${query}"`,
            });
          } else {
            send(controller, "step", {
              step: "fetching",
              message: `Query is already specific — using as-is: "${query}"`,
            });
          }
        }

        let ranked: RankedPaper[];

        // ── Smart Mode ─────────────────────────────────────────────────────────
        if (settings.autoMode) {
          ranked = await runAutoMode({
            controller,
            settings,
            baseQuery: query,
            excludedSet,
            send,
          });
        } else {
          // ── STANDARD SINGLE-PASS MODE ─────────────────────────────────────
          send(controller, "step", { step: "fetching", message: `Fetching papers using query: "${query}"...` });

          // Ask every source for the full maxPapers quota so that if one source
          // under-delivers (or fails), the others can compensate. Each fetcher
          // already clamps to its own API ceiling (SerpAPI → 20, Semantic Scholar
          // → 100), so we won't over-fetch beyond those hard limits.
          const { papers: allPapers, sourceCounts, failedSources } = await fetchAllSources(query, settings.maxPapers);

          send(controller, "step", {
            step: "fetching",
            message: `Sources returned: arXiv ${sourceCounts.arxiv}, Semantic Scholar ${sourceCounts.semantic}, Google Scholar ${sourceCounts.serp}${failedSources.length ? ` · ⚠ ${failedSources.join(", ")} unavailable` : ""}.`,
          });

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

          // ── Single-pass ranking ───────────────────────────────────────────────
          send(controller, "step", {
            step: "scoring",
            message: `Ranking all ${deduped.length} candidates directly.`,
          });

          ranked = await rankPapers(deduped, settings, queryEmbedding);
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
        const scoringEventMsg = settings.autoMode
          ? `Smart Mode: collected ${ranked.length} relevant papers across multiple rounds.`
          : `Ranked all ${ranked.length} candidates directly.`;

        const pipelineEvents = [
          { step: "fetching", message: `Pipeline started for topic: "${settings.topic}".`, ts: Date.now() - 6000 },
          { step: "deduplicating", message: `Deduplication complete.`, ts: Date.now() - 4000 },
          { step: "embedding", message: "Embeddings complete. Comparing vector distances...", ts: Date.now() - 3000 },
          { step: "scoring", message: scoringEventMsg, ts: Date.now() - 2000 },
          { step: "ranked", message: `Ranked ${ranked.length} papers by composite score.`, ts: Date.now() - 1000 },
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
            enhance_query: settings.enhanceQuery ?? false,
            enhance_report: false, // enhanceReport is not in the run schema; persisted by /metadata route
            auto_mode: settings.autoMode ?? false,
            events: pipelineEvents,
          },
          { onConflict: "run_id" }
        );
        if (metaError) {
          console.error("Failed to save run metadata to database:", metaError);
        }

        send(controller, "papers", ranked);
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

// ─── Smart Mode Implementation ─────────────────────────────────────────────────

interface AutoModeOptions {
  controller: ReadableStreamDefaultController;
  settings: {
    topic: string;
    maxPapers: number;
    topK: number;
    weightRelevance: number;
    weightCitation: number;
    weightRecency: number;
    enhanceQuery?: boolean;
    autoMode?: boolean;
  };
  baseQuery: string;
  excludedSet: Set<string>;
  send: (controller: ReadableStreamDefaultController, event: string, data: unknown) => void;
}

/**
 * Intelligent multi-round fetch loop.
 *
 * Guarantees:
 * - Only papers with simScore ≥ AUTO_RELEVANCE_THRESHOLD count toward the quota.
 * - Each round's fetched titles are added to seenTitles to prevent repeats across rounds.
 * - Cross-run excluded titles (from client) are also respected from round 1.
 * - User weights are fully preserved — only fetch depth and relevance gating change.
 * - After all rounds, the collected pool is re-ranked by finalScore and trimmed to maxPapers.
 */
async function runAutoMode({
  controller,
  settings,
  baseQuery,
  excludedSet,
  send,
}: AutoModeOptions): Promise<RankedPaper[]> {
  const { maxPapers } = settings;

  // Smart Mode uses equal weights internally regardless of what the user has set.
  // We never mutate the caller's settings — this override stays server-side only.
  const autoSettings = {
    ...settings,
    weightRelevance: 1,
    weightCitation: 1,
    weightRecency: 1,
  };

  const collectedRelevant: RankedPaper[] = [];

  // Track all titles seen across ALL rounds (union of client excludes + fetched)
  // to prevent any paper appearing in a second round even if it scores poorly.
  const seenTitles = new Set(excludedSet);

  // Embed the query once — reused across all rounds for consistent scoring
  send(controller, "step", { step: "embedding", message: "Smart Mode: generating semantic embeddings for query…" });
  const queryEmbedding = await embedQuery(baseQuery);
  send(controller, "step", { step: "embedding", message: "Embeddings ready. Starting intelligent fetch loop…" });

  // Log that weights have been equalised
  send(controller, "step", {
    step: "scoring",
    message: `Smart Mode: weights equalised to 1:1:1 (relevance · citation · recency) — relevance gate set at simScore ≥ ${AUTO_RELEVANCE_THRESHOLD}.`,
  });

  for (let round = 1; round <= AUTO_MAX_ROUNDS; round++) {
    const stillNeeded = maxPapers - collectedRelevant.length;
    if (stillNeeded <= 0) break;

    // Pick query variant: round 1 uses the (optionally refined) base query,
    // subsequent rounds use Gemini-diversified variants.
    let roundQuery = baseQuery;
    if (round > 1) {
      send(controller, "step", {
        step: "fetching",
        message: `Smart Mode — Round ${round}: diversifying query to surface new papers…`,
      });
      roundQuery = await diversifyQuery(baseQuery, round);
      send(controller, "step", {
        step: "fetching",
        message: `Smart Mode — Round ${round}: using query variant "${roundQuery}"`,
      });
    } else {
      send(controller, "step", {
        step: "fetching",
        message: `Smart Mode — Round 1: fetching papers for "${baseQuery}"…`,
      });
    }

    // Fetch from all sources — ask for the full remaining quota so sources can
    // compensate for each other's gaps.
    const fetchLimit = Math.max(stillNeeded * 3, 50); // over-fetch to compensate for dedup + relevance filter
    const { papers: rawPapers, sourceCounts, failedSources } = await fetchAllSources(roundQuery, fetchLimit);

    send(controller, "step", {
      step: "fetching",
      message: `Round ${round} sources: arXiv ${sourceCounts.arxiv}, Semantic Scholar ${sourceCounts.semantic}, Google Scholar ${sourceCounts.serp}${failedSources.length ? ` · ⚠ ${failedSources.join(", ")} unavailable` : ""}.`,
    });

    // Filter out ALL previously-seen titles (cross-round + cross-run)
    const newPapers = rawPapers.filter((p) => !seenTitles.has(p.title.toLowerCase().trim()));

    // Mark this round's papers as seen immediately (before dedup) so even
    // papers that fail the relevance gate don't reappear in later rounds.
    rawPapers.forEach((p) => seenTitles.add(p.title.toLowerCase().trim()));

    if (newPapers.length === 0) {
      send(controller, "step", {
        step: "fetching",
        message: `Round ${round}: no new papers found. ${round < AUTO_MAX_ROUNDS ? "Trying another query variant…" : "Stopping."}`,
      });
      continue;
    }

    // Deduplicate within this round's new papers
    const deduped = deduplicatePapers(newPapers);

    send(controller, "step", {
      step: "deduplicating",
      message: `Round ${round}: ${newPapers.length} new papers → ${deduped.length} unique after deduplication.`,
    });

    // Rank the round's candidates using equalised weights (Smart Mode internal)
    send(controller, "step", {
      step: "scoring",
      message: `Round ${round}: scoring ${deduped.length} candidates with equalised weights…`,
    });

    const roundRanked = await rankPapers(deduped, autoSettings, queryEmbedding);

    // Partition into relevant (simScore ≥ threshold) and borderline
    const relevant = roundRanked.filter((p) => p.simScore >= AUTO_RELEVANCE_THRESHOLD);
    const borderline = roundRanked.filter((p) => p.simScore < AUTO_RELEVANCE_THRESHOLD);

    send(controller, "step", {
      step: "scoring",
      message: `Round ${round}: ${relevant.length} relevant (simScore ≥ ${AUTO_RELEVANCE_THRESHOLD}) · ${borderline.length} below threshold (excluded from quota).`,
    });

    // Merge relevant papers into the collection (avoid title duplicates across rounds)
    const collectedTitles = new Set(collectedRelevant.map((p) => p.title.toLowerCase().trim()));
    for (const paper of relevant) {
      if (!collectedTitles.has(paper.title.toLowerCase().trim())) {
        collectedRelevant.push(paper);
        collectedTitles.add(paper.title.toLowerCase().trim());
      }
    }

    const totalFound = collectedRelevant.length;

    if (totalFound >= maxPapers) {
      send(controller, "step", {
        step: "fetching",
        message: `Smart Mode ✓ Quota filled after Round ${round} — ${totalFound}/${maxPapers} relevant papers collected.`,
      });
      break;
    }

    if (round < AUTO_MAX_ROUNDS) {
      const pct = Math.round((totalFound / maxPapers) * 100);
      send(controller, "step", {
        step: "fetching",
        message: `Smart Mode: ${totalFound}/${maxPapers} (${pct}%) relevant papers so far. Starting Round ${round + 1} with a diversified query…`,
      });
    } else {
      send(controller, "step", {
        step: "fetching",
        message: `Smart Mode: exhausted ${AUTO_MAX_ROUNDS} rounds — ${totalFound}/${maxPapers} relevant papers collected. Proceeding with best available results.`,
      });
    }
  }

  // Final re-rank: sort the full collection by finalScore (user weights respected),
  // take the top maxPapers, and assign sequential ranks.
  const finalPapers = collectedRelevant
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, maxPapers)
    .map((paper, index) => ({ ...paper, rank: index + 1 }));

  send(controller, "step", {
    step: "scoring",
    message: `Smart Mode complete: top ${finalPapers.length} papers selected from pool of ${collectedRelevant.length} relevant candidates, re-ranked by weighted composite score.`,
  });

  return finalPapers;
}

