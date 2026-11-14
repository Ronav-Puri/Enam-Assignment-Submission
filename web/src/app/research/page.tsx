"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { loadNetwork, loadWatchlists, searchSymbols } from "@/lib/data";
import type { Company, Network, ResearchReport as Report } from "@/lib/types";
import { ResearchReport } from "@/components/ResearchReport";

export default function ResearchPage() {
  const [query, setQuery] = useState("");
  const [lists, setLists] = useState<{ portfolio: Company[]; research: Company[] } | null>(null);
  const [net, setNet] = useState<Network | null>(null);
  const [suggest, setSuggest] = useState<{ symbol: string; name: string }[]>([]);
  const [typing, setTyping] = useState(false);
  const [stages, setStages] = useState<string[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Watchlists (for the chips) and the network (for "who to call"), loaded independently
  useEffect(() => {
    loadWatchlists()
      .then(setLists)
      .catch((e) => {
        console.error("loadWatchlists failed", e);
        setLists({ portfolio: [], research: [] });
      });
    loadNetwork()
      .then(setNet)
      .catch((e) => console.error("loadNetwork failed", e));
  }, []);

  // Type-ahead suggestions, 200 ms after the user stops typing
  useEffect(() => {
    if (!typing || query.trim().length < 2) {
      setSuggest([]);
      return;
    }
    const t = setTimeout(() => {
      searchSymbols(query).then(setSuggest).catch(() => setSuggest([]));
    }, 200);
    return () => clearTimeout(t);
  }, [query, typing]);

  async function run(symbol: string, refresh = false) {
    const s = symbol.trim().toUpperCase();
    if (!s || busy) return;
    setTyping(false);
    setQuery(s);
    setBusy(true);
    setStages([]);
    setReport(null);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ symbol: s, refresh }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const msg = JSON.parse(line);
          if (msg.stage) setStages((prev) => [...prev, msg.stage]);
          if (msg.result) setReport(msg.result);
          if (msg.error) setError(msg.error);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        /network|fetch|load failed/i.test(msg)
          ? "Connection dropped (phones pause pages in the background). The analysis may still be finishing. Tap Go again in a minute."
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  const chips = [...(lists?.research ?? []), ...(lists?.portfolio ?? [])];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Research</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Any NSE company, from management&apos;s own words and reported numbers.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); run(query); }} className="mt-5 flex gap-2">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setTyping(true); }}
          placeholder="Company or NSE symbol"
          autoCapitalize="characters"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[15px] placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/30"
        />
        <button disabled={busy} className="rounded-full bg-white px-5 font-medium text-neutral-950 disabled:opacity-50">
          {busy ? "…" : "Go"}
        </button>
      </form>

      {typing && suggest.length > 0 && (
        <ul className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900">
          {suggest.map((s) => (
            <li key={s.symbol}>
              <button type="button" onClick={() => run(s.symbol)}
                      className="flex w-full justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/5">
                <span className="text-neutral-100">{s.name}</span>
                <span className="shrink-0 text-neutral-500">{s.symbol}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!report && !busy && !typing && chips.length > 0 && (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {chips.map((c) => (
            <button key={c.symbol} onClick={() => run(c.symbol)}
                    className="shrink-0 rounded-full bg-white/5 px-3 py-1.5 text-sm text-neutral-300">
              {c.symbol}
            </button>
          ))}
        </div>
      )}

      {(busy || (stages.length > 0 && !report)) && (
        <ol className="mt-6 space-y-2 text-sm">
          {stages.map((s, i) => (
            <li key={i} className={i === stages.length - 1 && busy ? "text-neutral-100" : "text-neutral-500"}>
              {i === stages.length - 1 && busy ? "◌ " : "✓ "}{s}
            </li>
          ))}
          {busy && stages.length === 0 && <li className="text-neutral-400">◌ Starting…</li>}
        </ol>
      )}

      {error && <p className="mt-6 text-sm text-rose-400">{error}</p>}

      {report && (
        <>
          <ResearchReport
            r={report}
            net={net}
            sector={chips.find((c) => c.symbol === report.symbol)?.sector ?? null}
          />
          <button onClick={() => run(report.symbol, true)} className="mt-6 w-full text-sm text-neutral-500">
            Refresh analysis
          </button>
        </>
      )}
    </div>
  );
}