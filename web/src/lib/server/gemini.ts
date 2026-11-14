import { GoogleGenAI, type Part, type Schema } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const RETRYABLE = new Set([429, 500, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Same idea as data/scripts/llm.py: try each model in the tier, retry on overload, fall back. */
export async function generateJSON<T>(tier: "lite" | "flash" | "pro", parts: Part[], schema: Schema) {
  const models = (process.env[`GEMINI_MODEL_${tier.toUpperCase()}`] ?? "")
    .split(",").map((m) => m.trim()).filter(Boolean);
  let lastError: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0 },
        });
        return { data: JSON.parse(res.text ?? "{}") as T, model };
      } catch (e) {
        lastError = e;
        const status = (e as { status?: number }).status;
        if (status === 400) throw e;
        if (status === 429 && String(e).includes("PerDay")) break;   // out of daily quota: next model
        if (status && !RETRYABLE.has(status)) break;
        await sleep(status === 429 ? 20_000 : 2_000 * (attempt + 1));
      }
    }
  }
  throw new Error(`AI is busy right now (${String(lastError).slice(0, 120)}). Try again in a minute.`);
}