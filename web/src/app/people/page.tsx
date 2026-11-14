"use client";

import { useEffect, useMemo, useState } from "react";
import { loadNetwork, loadWatchlists } from "@/lib/data";
import type { Company, Contact, Network } from "@/lib/types";
import { colleagues, coverage, monthsSince, sharedWithMe, span } from "@/lib/network";
import { Closeness } from "@/components/WhoToCall";
import { Section, Skeleton } from "@/components/ui";

function PersonCard({ c, net, names }: { c: Contact; net: Network; names: Record<string, string> }) {
  const months = monthsSince(c.last_contacted);
  const worked = colleagues(net, c);
  const mine = sharedWithMe(net, c);
  const stints = [...c.stints].sort((a, b) => (b.start_year ?? 0) - (a.start_year ?? 0));
  const companies = [...new Set(c.stints.map((s) => s.symbol).filter((s): s is string => !!s && !!names[s]))];

  return (
    <details className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <summary>
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-neutral-100">{c.full_name}</span>
          <Closeness n={c.closeness} />
        </div>
        <div className="text-sm text-neutral-400">{c.headline}</div>
        <div className="mt-1 flex justify-between text-xs text-neutral-500">
          <span>{c.relationship}</span>
          {months != null && (
            <span className={months >= 6 ? "text-amber-300/80" : ""}>
              {months === 0 ? "spoke this month" : `${months} mo ago`}
            </span>
          )}
        </div>
      </summary>

      <div className="mt-4 space-y-4 text-sm">
        {mine.length > 0 && <div className="text-violet-300">{mine.join(" · ")}</div>}

        {companies.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {companies.map((s) => (
              <span key={s} className="rounded-full bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300">
                in your portfolio: {names[s]}
              </span>
            ))}
          </div>
        )}

        <div>
          <div className="text-[11px] uppercase tracking-wide text-neutral-500">Career</div>
          {stints.map((s, i) => (
            <div key={i} className="mt-1.5 flex justify-between gap-3">
              <span className="text-neutral-200">
                {s.org_name}
                <span className="block text-xs text-neutral-500">{s.title}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-neutral-500">{span(s)}</span>
            </div>
          ))}
        </div>

        {worked.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">Overlapped with</div>
            {worked.map((w) => (
              <div key={w.other.id} className="mt-1 text-neutral-300">
                {w.other.full_name} <span className="text-xs text-neutral-500">· {w.org}, {w.years}</span>
              </div>
            ))}
          </div>
        )}

        {c.expertise?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {c.expertise.map((t) => (
              <span key={t} className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-neutral-300">{t}</span>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

export default function PeoplePage() {
  const [net, setNet] = useState<Network | null>(null);
  const [portfolio, setPortfolio] = useState<Company[]>([]);
  const [tag, setTag] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    loadNetwork().then(setNet);
    loadWatchlists().then((w) => setPortfolio(w.portfolio));
  }, []);

  const names = useMemo(() => Object.fromEntries(portfolio.map((c) => [c.symbol, c.name])), [portfolio]);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    net?.contacts.forEach((c) => c.expertise?.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  }, [net]);

  if (!net) return <Skeleton />;

  const cov = coverage(net, portfolio.map((c) => c.symbol));
  const blind = cov.filter((x) => x.count === 0);
  const needle = q.trim().toLowerCase();
  const shown = net.contacts
    .filter((c) => !tag || c.expertise?.includes(tag))
    .filter((c) => !needle || JSON.stringify(c).toLowerCase().includes(needle))
    .sort((a, b) => (b.closeness ?? 0) - (a.closeness ?? 0));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Your network</h1>
      <p className="mt-1 text-sm text-neutral-400">
        {net.contacts.length} people · you know someone at {cov.length - blind.length} of your {cov.length} companies
      </p>

      {blind.length > 0 && (
        <Section title="Blind spots" hint="portfolio companies where you know no one">
          <div className="flex flex-wrap gap-1.5">
            {blind.map((b) => (
              <span key={b.symbol} className="rounded-full bg-rose-500/10 px-2.5 py-1 text-xs text-rose-300">
                {names[b.symbol] ?? b.symbol}
              </span>
            ))}
          </div>
        </Section>
      )}

      <Section title="Expertise map" hint="tap a theme">
        <div className="flex flex-wrap gap-1.5">
          {tags.map(([t, n]) => (
            <button key={t} onClick={() => setTag(tag === t ? null : t)}
                    className={`rounded-full px-2.5 py-1 text-xs ${tag === t ? "bg-white text-neutral-950" : "bg-white/5 text-neutral-300"}`}>
              {t} <span className="opacity-60">{n}</span>
            </button>
          ))}
        </div>
      </Section>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people, companies, colleges…"
             className="mt-8 w-full rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[15px] placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/30" />

      <div className="mt-4 space-y-3">
        {shown.map((c) => <PersonCard key={c.id} c={c} net={net} names={names} />)}
      </div>
      <p className="mt-8 text-center text-xs text-neutral-600">
        Synthetic demo network. Private to you: enforced by database row-level security.
      </p>
    </div>
  );
}