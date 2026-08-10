import { z } from "zod";
import type { InvestigationAnswer } from "@trace/shared";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiProvider {
  name: string;
  completeJson<T>(args: {
    messages: AiMessage[];
    schemaName: string;
    temperature?: number;
  }): Promise<T>;
}

export interface AiProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider?: "openai" | "openrouter";
}

const investigationSchema = z.object({
  answer: z.string(),
  confidence: z.number().min(0).max(1),
  claims: z.array(
    z.object({
      text: z.string(),
      evidenceIds: z.array(z.string()),
    }),
  ),
  evidenceSummary: z.string().optional(),
});

export class OpenAICompatibleProvider implements AiProvider {
  name: string;
  constructor(private readonly config: AiProviderConfig) {
    this.name = config.provider ?? "openai";
  }

  async completeJson<T>(args: {
    messages: AiMessage[];
    schemaName: string;
    temperature?: number;
  }): Promise<T> {
    if (!this.config.apiKey) {
      throw new Error("AI_API_KEY is not configured. Investigation LLM is unavailable.");
    }

    const res = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        ...(this.config.provider === "openrouter"
          ? { "HTTP-Referer": "https://trace.dev", "X-Title": "TRACE" }
          : {}),
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: args.temperature ?? 0.2,
        response_format: { type: "json_object" },
        messages: args.messages,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI provider error ${res.status}: ${body.slice(0, 400)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI provider returned empty content");
    return JSON.parse(content) as T;
  }
}

export interface EvidenceItem {
  id: string;
  label: string;
  excerpt: string;
  sourceType: "snapshot" | "change" | "event" | "page";
  occurredAt?: string;
}

export async function runInvestigation(
  provider: AiProvider,
  question: string,
  evidence: EvidenceItem[],
): Promise<InvestigationAnswer> {
  if (evidence.length === 0) {
    return {
      answer:
        "No evidence was retrieved for this question. TRACE will not invent an explanation without snapshots or changes to cite.",
      confidence: 0,
      claims: [],
      evidenceSummary: "0 evidence items",
    };
  }

  const system = `You are TRACE's investigation engine.
You MUST reason ONLY over the provided evidence.
Never invent URLs, dates, prices, or events that are not in the evidence.
Every claim must cite one or more evidenceIds.
If evidence is insufficient, say so and lower confidence.
Return strict JSON matching:
{ "answer": string, "confidence": number, "claims": [{"text": string, "evidenceIds": string[]}], "evidenceSummary": string }`;

  const user = `Question: ${question}\n\nEvidence:\n${evidence
    .map(
      (e) =>
        `- id=${e.id} type=${e.sourceType} label=${e.label} at=${e.occurredAt ?? "unknown"}\n  ${e.excerpt}`,
    )
    .join("\n")}`;

  const raw = await provider.completeJson<unknown>({
    schemaName: "investigation",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const parsed = investigationSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("AI returned invalid investigation JSON");
  }

  // Drop claims that cite unknown evidence
  const known = new Set(evidence.map((e) => e.id));
  const claims = parsed.data.claims
    .map((c) => ({ ...c, evidenceIds: c.evidenceIds.filter((id) => known.has(id)) }))
    .filter((c) => c.evidenceIds.length > 0);

  return {
    ...parsed.data,
    claims,
    confidence: claims.length === 0 ? Math.min(parsed.data.confidence, 0.2) : parsed.data.confidence,
  };
}

/** Deterministic fallback used when AI key is absent — still evidence-backed. */
export function heuristicInvestigation(question: string, evidence: EvidenceItem[]): InvestigationAnswer {
  const priceEvidence = evidence.filter((e) => /price|\$|pricing/i.test(e.excerpt + e.label));
  const featureEvidence = evidence.filter((e) => /enterprise|feature|plan/i.test(e.excerpt + e.label));

  if (/why.*pric/i.test(question) && priceEvidence.length) {
    const ids = [...priceEvidence, ...featureEvidence].slice(0, 5).map((e) => e.id);
    const claims = [
      {
        text: "Pricing text changed between monitored snapshots.",
        evidenceIds: priceEvidence.slice(0, 3).map((e) => e.id),
      },
    ];
    if (featureEvidence.length) {
      claims.push({
        text: "Nearby evidence mentions plan or feature changes that may contextualize the pricing update.",
        evidenceIds: featureEvidence.slice(0, 2).map((e) => e.id),
      });
    }
    return {
      answer:
        "Based on retrieved TRACE evidence, pricing copy changed across snapshots. " +
        (featureEvidence.length
          ? "This appears to coincide with plan/feature messaging changes in the same monitoring window."
          : "No additional announcement evidence was found in the current project corpus."),
      confidence: featureEvidence.length ? 0.74 : 0.62,
      claims,
      evidenceSummary: `${ids.length} evidence items cited`,
    };
  }

  const top = evidence.slice(0, 5);
  return {
    answer:
      "TRACE retrieved related evidence but could not form a high-confidence causal explanation without additional corroborating snapshots.",
    confidence: 0.35,
    claims: top.slice(0, 2).map((e) => ({
      text: `Relevant evidence: ${e.label}`,
      evidenceIds: [e.id],
    })),
    evidenceSummary: `${top.length} evidence items`,
  };
}

export function createAiProvider(config: AiProviderConfig): AiProvider {
  return new OpenAICompatibleProvider(config);
}
