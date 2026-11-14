import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { buildReport } from "@/lib/server/research";

export const maxDuration = 300;            // allow up to 5 minutes on Vercel
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Only signed-in users can spend our AI quota
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Sign in first" }, { status: 401 });
  const { data: auth } = await supabaseAdmin().auth.getUser(token);
  if (!auth?.user) return Response.json({ error: "Sign in first" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const symbol = String(body.symbol ?? "").toUpperCase().replace(/[^A-Z0-9&-]/g, "").slice(0, 20);
  if (!symbol) return Response.json({ error: "Enter an NSE symbol" }, { status: 400 });

  // Stream progress lines, then the result, as newline-delimited JSON
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: object) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const report = await buildReport(symbol, !!body.refresh, (stage) => send({ stage }));
        send({ result: report });
      } catch (e) {
        send({ error: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}