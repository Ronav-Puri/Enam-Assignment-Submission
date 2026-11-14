import type { ResearchReport as Report } from "@/lib/types";
import { num, pctText } from "@/lib/format";
import { Section } from "./ui";
import type { Network } from "@/lib/types";
import { whoToCall } from "@/lib/network";
import { WhoToCall } from "./WhoToCall";

const VERDICT: Record<string, { label: string; cls: string }> = {
  delivered: { label: "Delivered", cls: "bg-emerald-500/15 text-emerald-300" },
  partly: { label: "Partly", cls: "bg-amber-500/15 text-amber-300" },
  missed: { label: "Missed", cls: "bg-rose-500/15 text-rose-300" },
  too_early: { label: "Too early", cls: "bg-white/10 text-neutral-300" },
};

const fy = (p: string) => {
  const y = p.match(/(\d{4})/)?.[1];
  return y && p.startsWith("Mar") ? `FY${y.slice(2)}` : p;
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

export function ResearchReport({ r, net, sector }: { r: Report; net?: Network | null; sector?: string | null }) {
  const m = r.metrics;
  const a = r.analysis;
  const src = (i: number, page?: number | null) => {
    const s = r.sources[i - 1];
    if (!s) return null;
    return (
      <a href={page ? `${s.url}#page=${page}` : s.url} target="_blank" rel="noreferrer"
         className="text-xs text-neutral-500 hover:underline">
        {s.label}{page ? `, p.${page}` : ""} ↗
      </a>
    );
  };
  const maxSales = Math.max(...m.annual.map((x) => x.sales ?? 0), 1);
  const tally = a.promises.reduce<Record<string, number>>((t, p) => ({ ...t, [p.verdict]: (t[p.verdict] ?? 0) + 1 }), {});

  return (
    <div>
      <div className="mt-6">
        <div className="text-xs text-neutral-500">{r.symbol} · {r.basis}</div>
        <h2 className="text-2xl font-semibold tracking-tight">{r.name}</h2>
        <p className="mt-2 text-neutral-300">{a.one_liner}</p>
        {net && (
          <WhoToCall suggestions={whoToCall(net, { symbol: r.symbol, sector })} title="Who to call before you decide" />
        )}
      </div>

      <Section title="Promised vs delivered"
               hint={["delivered", "partly", "missed"].map((k) => `${tally[k] ?? 0} ${k}`).join(" · ")}>
        {a.promises.map((p, i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-neutral-500">Said in {p.said_in}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${VERDICT[p.verdict]?.cls ?? ""}`}>
                {VERDICT[p.verdict]?.label ?? p.verdict}
              </span>
            </div>
            <p className="mt-2 text-[15px] text-neutral-100">{p.promise}</p>
            <p className="mt-1 text-sm text-neutral-400">→ {p.outcome}</p>
            <blockquote className="mt-2 border-l-2 border-white/15 pl-3 text-sm italic text-neutral-400">
              “{p.quote}”
            </blockquote>
            <div className="mt-1">{src(p.source, p.page)}</div>
          </div>
        ))}
      </Section>

      <Section title="At a glance" hint="₹ crore, from reported financials">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Revenue (TTM)" value={m.ttm?.sales != null ? num(m.ttm.sales) : "—"} />
          <Stat label="Net profit (TTM)" value={m.ttm?.net_profit != null ? num(m.ttm.net_profit) : "—"} />
          <Stat label={m.is_financial ? "Financing margin" : "Operating margin"}
                value={m.quarterly.at(-1)?.opm != null ? `${m.quarterly.at(-1)!.opm}%` : "—"}
                sub={m.quarterly.at(-1)?.period} />
          <Stat label="ROCE" value={m.roce != null ? `${m.roce}%` : "—"} />
          {!m.is_financial && <Stat label="Debt / equity" value={m.debt_to_equity != null ? `${m.debt_to_equity}×` : "—"} />}
          {!m.is_financial && <Stat label="Cash conversion" value={m.cash_conversion_3y != null ? `${m.cash_conversion_3y}%` : "—"}
                sub="operating cash ÷ profit, 3 yrs" />}
        </div>
      </Section>

      <Section title="Trajectory"
               hint={`${m.cagr_years}-yr CAGR: revenue ${pctText(m.sales_cagr)} · profit ${pctText(m.profit_cagr)}`}>
        <div className="flex h-32 items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          {m.annual.map((y) => (
            <div key={y.period} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-neutral-500">{y.opm != null ? `${y.opm}%` : ""}</span>
              <div className="w-full rounded-t bg-white/70" style={{ height: `${((y.sales ?? 0) / maxSales) * 70}px` }} />
              <span className="text-[10px] text-neutral-500">{fy(y.period)}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-neutral-500">Bars: revenue. Labels: {m.is_financial ? "financing" : "operating"} margin.</p>
      </Section>

      {a.guidance.length > 0 && (
        <Section title="Current guidance">
          {a.guidance.map((g, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-500">{g.topic}</div>
              <p className="mt-1 text-neutral-100">{g.statement}</p>
              <div className="mt-1">{src(g.source, g.page)}</div>
            </div>
          ))}
        </Section>
      )}

      <Section title="Narrative vs numbers">
        {a.narrative_vs_numbers.map((n, i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className={`text-xs ${n.aligned ? "text-emerald-400" : "text-rose-400"}`}>
              {n.aligned ? "Story matches numbers" : "Story and numbers diverge"}
            </div>
            <p className="mt-1 text-neutral-200">{n.claim}</p>
            <p className="mt-1 text-sm text-neutral-400">{n.reality}</p>
          </div>
        ))}
      </Section>

      <Section title="Bull vs bear">
        <div className="grid grid-cols-1 gap-2">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
            <div className="text-xs font-semibold text-emerald-400">Bull</div>
            <ul className="mt-2 space-y-1.5 text-sm text-neutral-200">{a.bull.map((b, i) => <li key={i}>• {b}</li>)}</ul>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-4">
            <div className="text-xs font-semibold text-rose-400">Bear</div>
            <ul className="mt-2 space-y-1.5 text-sm text-neutral-200">{a.bear.map((b, i) => <li key={i}>• {b}</li>)}</ul>
          </div>
        </div>
      </Section>

      <Section title="Business">
        <p className="text-sm text-neutral-300">{a.business.summary}</p>
        {a.business.segments.map((s) => (
          <div key={s.name} className="flex justify-between gap-3 border-b border-white/5 py-2 text-sm">
            <span className="text-neutral-200">{s.name}<span className="block text-xs text-neutral-500">{s.note}</span></span>
            {s.share_pct != null && <span className="tabular-nums text-neutral-400">{s.share_pct}%</span>}
          </div>
        ))}
      </Section>

      <p className="mt-10 text-xs leading-relaxed text-neutral-600">
        Sources: management&apos;s own earnings-call transcripts ({r.sources.map((s) => s.label).join(", ")}) and
        reported financials (<a href={r.screener_url} target="_blank" rel="noreferrer" className="underline">screener.in</a>,
        from company filings). No news, broker notes or outside knowledge. Generated{" "}
        {new Date(r.generated_at).toLocaleDateString("en-IN")} · {r.model}
      </p>
    </div>
  );
}