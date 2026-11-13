"use client";

import { useEffect, useMemo, useState } from "react";
import { loadFilings, loadPortfolio, loadPrefs, loadSignals } from "@/lib/data";
import type { Announcement, Company, Prefs, Signal } from "@/lib/types";
import { greeting } from "@/lib/format";
import { FilingCard, FilingRow } from "@/components/FilingCard";
import { MovesStrip } from "@/components/MovesStrip";
import { WindowPicker } from "@/components/WindowPicker";
import { Section, Skeleton } from "@/components/ui";

type Data = { companies: Company[]; filings: Announcement[]; signals: Signal[]; prefs: Prefs };

/** NSE sometimes files the same thing twice; keep the newest copy. */
function dedupe(list: Announcement[]) {
  const seen = new Set<string>();
  return list.filter((f) => {
    const key = `${f.symbol}|${f.category}|${f.summary ?? f.subject}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function TodayPage() {
  const [days, setDays] = useState(1);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    (async () => {
      try {
        const companies = await loadPortfolio();
        const symbols = companies.map((c) => c.symbol);
        const since = new Date(Date.now() - days * 86_400_000).toISOString();
        const [filings, signals, prefs] = await Promise.all([
          loadFilings(symbols, since),
          loadSignals(symbols),
          loadPrefs(),
        ]);
        if (!cancelled) setData({ companies, filings: dedupe(filings), signals, prefs });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  const view = useMemo(() => {
    if (!data) return null;
    const { filings, signals, prefs } = data;
    const imp = (f: Announcement) => f.importance ?? 1;
    const moves = signals
      .filter((s) => Math.abs(s.pct_change ?? 0) >= prefs.price_move_pct || (s.volume_ratio ?? 0) >= prefs.volume_multiple)
      .sort((a, b) => Math.abs(b.pct_change ?? 0) - Math.abs(a.pct_change ?? 0));
    const alerts = filings
      .filter((f) => imp(f) >= 2 && prefs.alert_categories.includes(f.category ?? ""))
      .sort((a, b) => imp(b) - imp(a));
    const alertIds = new Set(alerts.map((f) => f.id));
    return {
      moves,
      alerts,
      worth: filings.filter((f) => imp(f) >= 2 && !alertIds.has(f.id)),
      minor: filings.filter((f) => imp(f) === 1),
      routine: filings.filter((f) => imp(f) === 0),
      asOf: signals[0]?.date,
    };
  }, [data]);

  const names = useMemo(
    () => Object.fromEntries((data?.companies ?? []).map((c) => [c.symbol, c.name])),
    [data],
  );

  const quiet = view && view.alerts.length + view.worth.length + view.moves.length === 0;

  return (
    <div>
      <p className="text-sm text-neutral-500">
        {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{greeting()}, Arjun</h1>
      <WindowPicker days={days} onChange={setDays} />

      {error && <p className="mt-6 text-sm text-rose-400">Couldn&apos;t load: {error}</p>}

      {!view || !data ? (
        !error && <Skeleton />
      ) : (
        <>
          <Section
            title="Alerts"
            hint={`your rules: ±${data.prefs.price_move_pct}% · ${data.prefs.volume_multiple}× volume`}
          >
            <MovesStrip moves={view.moves} prefs={data.prefs} />
            {view.alerts.map((f) => (
              <FilingCard key={f.id} f={f} name={names[f.symbol] ?? f.symbol} />
            ))}
            {view.alerts.length === 0 && view.moves.length === 0 && (
              <p className="text-sm text-neutral-500">Nothing crossed your thresholds in this window.</p>
            )}
          </Section>

          {view.worth.length > 0 && (
            <Section title="Worth a look">
              {view.worth.map((f) => (
                <FilingCard key={f.id} f={f} name={names[f.symbol] ?? f.symbol} />
              ))}
            </Section>
          )}

          {view.minor.length > 0 && (
            <Section title="Minor">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4">
                {view.minor.map((f) => (
                  <FilingRow key={f.id} f={f} name={names[f.symbol] ?? f.symbol} />
                ))}
              </div>
            </Section>
          )}

          {view.routine.length > 0 && (
            <details className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <summary className="text-sm text-neutral-400">
                {view.routine.length} routine filings hidden <span className="text-neutral-600">· tap to show</span>
              </summary>
              <div className="mt-2">
                {view.routine.map((f) => (
                  <FilingRow key={f.id} f={f} name={names[f.symbol] ?? f.symbol} />
                ))}
              </div>
            </details>
          )}

          {quiet && days < 7 && (
            <button
              onClick={() => setDays(7)}
              className="mt-8 w-full rounded-2xl border border-dashed border-white/15 py-4 text-sm text-neutral-400"
            >
              Quiet {days === 1 ? "24 hours" : `${days} days`}. Show the last 7 days?
            </button>
          )}

          {view.asOf && <p className="mt-10 text-center text-xs text-neutral-600">Prices as of close {view.asOf}</p>}
        </>
      )}
    </div>
  );
}