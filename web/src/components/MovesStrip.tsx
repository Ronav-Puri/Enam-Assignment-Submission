import type { Prefs, Signal } from "@/lib/types";
import { pctText } from "@/lib/format";

export function MovesStrip({ moves, prefs }: { moves: Signal[]; prefs: Prefs }) {
  if (!moves.length) return null;
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {moves.map((m) => {
        const up = (m.pct_change ?? 0) >= 0;
        const volumeHit = (m.volume_ratio ?? 0) >= prefs.volume_multiple;
        return (
          <div key={m.symbol} className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <div className="text-xs text-neutral-400">{m.symbol}</div>
            <div className={`text-lg font-semibold tabular-nums ${up ? "text-emerald-400" : "text-rose-400"}`}>
              {pctText(m.pct_change)}
            </div>
            <div className={`text-xs tabular-nums ${volumeHit ? "text-amber-300" : "text-neutral-500"}`}>
              vol {m.volume_ratio != null ? m.volume_ratio.toFixed(1) : "–"}× avg
            </div>
          </div>
        );
      })}
    </div>
  );
}