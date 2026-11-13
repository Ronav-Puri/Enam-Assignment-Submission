import type { Announcement, MgmtExtract, ResultsExtract } from "@/lib/types";
import { CATEGORY_LABEL, pdfAt, timeAgo } from "@/lib/format";
import { ResultsBlock } from "./ResultsBlock";
import { MgmtBlock } from "./MgmtBlock";

const IMPORTANCE_STYLE = [
  "bg-white/5 text-neutral-400",
  "bg-white/5 text-neutral-300",
  "bg-sky-500/10 text-sky-300",
  "bg-amber-500/10 text-amber-300",
];

function asResults(f: Announcement): ResultsExtract | null {
  const x = f.extracted as { type?: string } | null;
  return x?.type === "results" ? (x as ResultsExtract) : null;
}

function asMgmt(f: Announcement): MgmtExtract | null {
  const x = f.extracted as { type?: string } | null;
  return x?.type === "management_change" ? (x as MgmtExtract) : null;
}

export function FilingCard({ f, name }: { f: Announcement; name: string }) {
  const results = asResults(f);
  const mgmt = asMgmt(f);
  const importance = Math.max(0, Math.min(3, f.importance ?? 1));
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-neutral-300">{name}</span>
        <span className="text-neutral-500">{timeAgo(f.published_at)}</span>
      </div>
      <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] ${IMPORTANCE_STYLE[importance]}`}>
        {CATEGORY_LABEL[f.category ?? ""] ?? "Other"}
      </span>
      <p className="mt-2 text-[15px] leading-snug text-neutral-100">{f.summary ?? f.subject}</p>
      {results && <ResultsBlock r={results} url={f.attachment_url} />}
      {mgmt && mgmt.changes.length > 0 && <MgmtBlock m={mgmt} />}
      {!results && f.attachment_url && (
        <a
          href={pdfAt(f.attachment_url)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-xs text-neutral-500 hover:underline"
        >
          Open filing ↗
        </a>
      )}
    </article>
  );
}

export function FilingRow({ f, name }: { f: Announcement; name: string }) {
  return (
    <a
      href={pdfAt(f.attachment_url)}
      target="_blank"
      rel="noreferrer"
      className="flex items-start justify-between gap-3 border-b border-white/5 py-2.5 last:border-0"
    >
      <div className="min-w-0">
        <div className="text-xs text-neutral-500">
          {name} · {CATEGORY_LABEL[f.category ?? ""] ?? "Other"}
        </div>
        <div className="line-clamp-2 text-sm text-neutral-200">{f.summary ?? f.subject}</div>
      </div>
      <span className="shrink-0 text-xs text-neutral-500">{timeAgo(f.published_at)}</span>
    </a>
  );
}