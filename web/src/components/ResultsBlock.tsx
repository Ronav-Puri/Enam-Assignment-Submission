import type { ResultsExtract } from "@/lib/types";
import { num, pctText, pdfAt } from "@/lib/format";

const ROWS = [
  { key: "revenue", label: "Revenue" },
  { key: "ebitda", label: "EBITDA" },
  { key: "pbt", label: "PBT" },
  { key: "pat", label: "PAT" },
] as const;

function Delta({ v }: { v: number | null }) {
  const color = v == null ? "text-neutral-600" : v >= 0 ? "text-emerald-400" : "text-rose-400";
  return <span className={color}>{pctText(v)}</span>;
}

export function ResultsBlock({ r, url }: { r: ResultsExtract; url: string | null }) {
  const exceptional = r.current.exceptional_items;
  const patYoY = r.growth.pat?.yoy ?? null;
  return (
    <div className="mt-3">
      <div className="text-xs text-neutral-500">{r.current.label}</div>
      <table className="mt-1 w-full text-sm tabular-nums">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-neutral-500">
            <th className="pb-1 text-left font-normal">₹ crore</th>
            <th className="pb-1 text-right font-normal">Qtr</th>
            <th className="pb-1 text-right font-normal">QoQ</th>
            <th className="pb-1 text-right font-normal">YoY</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ key, label }) => {
            const v = r.current[key];
            if (v == null) return null;
            return (
              <tr key={key} className="border-t border-white/5">
                <td className="py-1.5 text-neutral-300">
                  {label}
                  {key === "ebitda" && r.current.ebitda_margin != null && (
                    <span className="ml-1.5 text-xs text-neutral-500">{r.current.ebitda_margin}%</span>
                  )}
                </td>
                <td className="py-1.5 text-right text-neutral-100">{num(v)}</td>
                <td className="py-1.5 text-right"><Delta v={r.growth[key]?.qoq ?? null} /></td>
                <td className="py-1.5 text-right"><Delta v={r.growth[key]?.yoy ?? null} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {exceptional ? (
        <p className="mt-2 text-xs text-amber-300">
          Includes a one-off {exceptional > 0 ? "gain" : "loss"} of ₹{num(Math.abs(exceptional))} cr, so PAT
          growth is {exceptional > 0 ? "flattered" : "understated"}.
        </p>
      ) : patYoY != null && Math.abs(patYoY) > 100 ? (
        <p className="mt-2 text-xs text-amber-300">Unusually large PAT swing; check the filing before relying on it.</p>
      ) : null}
      <a
        href={pdfAt(url, r.page)}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-xs text-neutral-500 hover:underline"
      >
        {r.basis} figures · source: filing{r.page ? `, p.${r.page}` : ""} ↗
      </a>
    </div>
  );
}