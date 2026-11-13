import type { ReactNode } from "react";

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">{title}</h2>
        {hint && <span className="text-xs text-neutral-500">{hint}</span>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function Skeleton() {
  return (
    <div className="mt-8 space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />
      ))}
    </div>
  );
}