import type { Suggestion } from "@/lib/network";

export function Closeness({ n }: { n: number | null }) {
  return (
    <span className="flex gap-0.5" title={`Closeness ${n ?? "?"}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= (n ?? 0) ? "bg-violet-300" : "bg-white/10"}`} />
      ))}
    </span>
  );
}

export function WhoToCall({ suggestions, title = "Who to call" }: { suggestions: Suggestion[]; title?: string }) {
  if (!suggestions.length) return null;
  return (
    <div className="mt-3 rounded-xl border border-violet-400/20 bg-violet-500/[0.05] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-300">{title}</div>
      {suggestions.map((s) => (
        <div key={s.contact.id} className="mt-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-neutral-100">{s.contact.full_name}</span>
            <Closeness n={s.contact.closeness} />
          </div>
          {s.contact.relationship && <div className="text-xs text-neutral-500">{s.contact.relationship}</div>}
          <ul className="mt-1 space-y-0.5 text-xs text-neutral-300">
            {s.reasons.map((r, i) => <li key={i}>· {r}</li>)}
          </ul>
          {s.stale != null && s.stale >= 6 && (
            <div className="mt-1 text-xs text-amber-300/80">Last spoke {s.stale} months ago, a good reason to reconnect</div>
          )}
        </div>
      ))}
    </div>
  );
}