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
  let open = true;
  const stream = new ReadableStream({
    async start(controller) {
      // If the phone disconnects, keep working: the finished report is saved to the database,
      // so tapping Go again loads it instantly.
      const send = (o: object) => {
        if (!open) return;
        try {
          controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
        } catch {
          open = false;
        }
      };
      try {
        const report = await buildReport(symbol, !!body.refresh, (stage) => send({ stage }));
        send({ result: report });
      } catch (e) {
        send({ error: e instanceof Error ? e.message : String(e) });
      } finally {
        if (open) {
          try { controller.close(); } catch { /* already closed */ }
        }
      }
    },
    cancel() {
      open = false;
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}