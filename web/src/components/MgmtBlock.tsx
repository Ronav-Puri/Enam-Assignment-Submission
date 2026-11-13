import type { MgmtExtract } from "@/lib/types";

const BADGE: Record<string, string> = {
  appointed: "bg-emerald-500/15 text-emerald-300",
  resigned: "bg-rose-500/15 text-rose-300",
  retired: "bg-rose-500/15 text-rose-300",
  ceased: "bg-rose-500/15 text-rose-300",
};

export function MgmtBlock({ m }: { m: MgmtExtract }) {
  const people = [...m.changes].sort((a, b) => (b.importance ?? 1) - (a.importance ?? 1)).slice(0, 3);
  return (
    <div className="mt-3 space-y-2">
      {people.map((c, i) => {
        const tags = [...(c.previous_employers ?? []), ...(c.education ?? [])];
        return (
          <div key={`${c.person_name}-${i}`} className="rounded-xl bg-white/[0.04] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-neutral-100">{c.person_name}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] capitalize ${BADGE[c.change] ?? "bg-white/10 text-neutral-300"}`}>
                {c.change}
              </span>
            </div>
            <div className="mt-0.5 text-sm text-neutral-400">
              {c.role}
              {c.effective_date ? ` · w.e.f. ${c.effective_date}` : ""}
            </div>
            {c.background && <p className="mt-2 text-sm leading-relaxed text-neutral-300">{c.background}</p>}
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t} className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-neutral-300">{t}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}