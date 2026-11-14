import { Type, type Part, type Schema } from "@google/genai";
import { supabaseAdmin } from "./supabaseAdmin";
import { generateJSON } from "./gemini";
import { downloadPdf, fetchScreener } from "./screener";
import { computeMetrics } from "./metrics";
import type { Analysis, ResearchReport } from "@/lib/types";

const FRESH_MS = 7 * 86_400_000;
const PAGES_PER_TRANSCRIPT = 30;

const S = Type.STRING, N = Type.NUMBER, I = Type.INTEGER;
const quoteFields = {
  quote: { type: S },
  source: { type: I },
  page: { type: I, nullable: true },
};

const SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    one_liner: { type: S },
    business: {
      type: Type.OBJECT,
      properties: {
        summary: { type: S },
        segments: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { name: { type: S }, share_pct: { type: N, nullable: true }, note: { type: S } },
            required: ["name", "note"],
          },
        },
      },
      required: ["summary", "segments"],
    },
    promises: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          said_in: { type: S },
          promise: { type: S },
          outcome: { type: S },
          verdict: { type: S, enum: ["delivered", "partly", "missed", "too_early"] },
          ...quoteFields,
        },
        required: ["said_in", "promise", "outcome", "verdict", "quote", "source"],
      },
    },
    guidance: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { topic: { type: S }, statement: { type: S }, ...quoteFields },
        required: ["topic", "statement", "quote", "source"],
      },
    },
    narrative_vs_numbers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { claim: { type: S }, reality: { type: S }, aligned: { type: Type.BOOLEAN } },
        required: ["claim", "reality", "aligned"],
      },
    },
    bull: { type: Type.ARRAY, items: { type: S } },
    bear: { type: Type.ARRAY, items: { type: S } },
  },
  required: ["one_liner", "business", "promises", "guidance", "narrative_vs_numbers", "bull", "bear"],
};

function prompt(name: string, symbol: string, quarterly: unknown, annual: unknown) {
  return `You are a buy-side equity analyst. Above are the company's most recent earnings-call transcripts
(Doc 1 = most recent). Below are its REPORTED numbers in ₹ crore.
Use ONLY these documents and numbers. Do not use outside knowledge about this company, news or broker views.
If something is not in the documents, leave it out.

Company: ${name} (${symbol})
Reported quarterly numbers (oldest to newest): ${JSON.stringify(quarterly)}
Reported annual numbers: ${JSON.stringify(annual)}

Return:
1. one_liner: one sentence on what the company is, from management's own description.
2. business: summary (max 2 sentences) and segments (name, revenue share % if stated, one-line note).
3. promises: specific, checkable forward-looking statements management made in the OLDER calls (Doc 2 onward)
   about growth, margins, capex, launches, debt or market share. Judge each against later calls and the
   reported numbers. verdict = delivered | partly | missed | too_early. outcome = what actually happened,
   citing numbers. quote = exact words from the transcript (max 25 words). source = Doc number. page = PDF page.
   Give the 4-8 most important; prefer numeric promises.
4. guidance: explicit forward guidance from Doc 1 (topic, statement, quote, source, page). Max 5.
5. narrative_vs_numbers: 2-4 places where management's story and the reported numbers agree or diverge.
6. bull and bear: 3 tight points each, each grounded in the documents or numbers.
Be concise and concrete. No filler.`;
}

export async function buildReport(
  symbol: string,
  refresh: boolean,
  stage: (s: string) => void,
): Promise<ResearchReport> {
  const admin = supabaseAdmin();

  if (!refresh) {
    const { data } = await admin.from("research").select("report, generated_at").eq("symbol", symbol).maybeSingle();
    if (data && Date.now() - new Date(data.generated_at).getTime() < FRESH_MS) {
      stage("Loaded saved report");
      return data.report as ResearchReport;
    }
  }

  stage("Reading reported financials");
  const s = await fetchScreener(symbol);
  const metrics = computeMetrics(s);

  stage(`Downloading ${s.transcripts.length} earnings-call transcripts`);
  const downloaded = await Promise.all(
    s.transcripts.map(async (d) => {
      try {
        return { ...d, bytes: await downloadPdf(d.url, PAGES_PER_TRANSCRIPT) };
      } catch {
        return null;
      }
    }),
  );
  const docs = downloaded.filter((d): d is NonNullable<typeof d> => d !== null);
  if (!docs.length) throw new Error("Couldn't download any earnings-call transcripts for this company.");

  stage("Comparing what management promised with what it delivered");
  const parts: Part[] = [];
  docs.forEach((d, i) => {
    parts.push({ text: `Doc ${i + 1}: ${d.label}` });
    parts.push({ inlineData: { mimeType: "application/pdf", data: Buffer.from(d.bytes).toString("base64") } });
  });
  parts.push({ text: prompt(s.name, symbol, metrics.quarterly, metrics.annual) });
  const { data: analysis, model } = await generateJSON<Analysis>("pro", parts, SCHEMA);

  const report: ResearchReport = {
    symbol,
    name: s.name,
    basis: s.basis,
    screener_url: s.url,
    generated_at: new Date().toISOString(),
    model,
    metrics,
    analysis,
    sources: docs.map(({ label, url }) => ({ label, url })),
  };
  await admin.from("research").upsert({ symbol, name: s.name, generated_at: report.generated_at, model, report });
  stage("Done");
  return report;
}