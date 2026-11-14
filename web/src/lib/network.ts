import type { Announcement, Contact, MgmtChange, Network, Stint } from "./types";

const NOW = new Date().getFullYear();
const ORG_STOP = new Set(["ltd", "limited", "pvt", "private", "india", "the", "and", "company", "co", "of", "group", "inc", "llp"]);
const GENERIC = new Set(["services", "industries", "company", "business", "mfg", "manufacturing"]);
const TITLE_STOP = new Set(["head", "chief", "officer", "director", "manager", "senior", "group", "business", "general",
  "deputy", "assistant", "president", "vice", "executive", "designated", "whole", "additional", "capacity",
  "management", "personnel"]);

function orgWords(s: string) {
  return s.toLowerCase()
    .replace(/indian institute of technology/g, "iit")
    .replace(/indian institute of management/g, "iim")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !ORG_STOP.has(w));
}

/** Loose match for organisation names: "HAL" style names differ between filings and profiles. */
export function sameOrg(a: string, b: string) {
  const A = orgWords(a), B = orgWords(b);
  if (!A.length || !B.length) return false;
  const sa = A.join(" "), sb = B.join(" ");
  if (sa === sb || sa.includes(sb) || sb.includes(sa)) return true;
  const setB = new Set(B);
  return A.filter((w) => setB.has(w)).length / Math.max(A.length, B.length) >= 0.6;
}

export const span = (s: Stint) => `${s.start_year ?? "?"}–${s.end_year ?? "now"}`;

export function overlap(a: Stint, b: Stint): [number, number] | null {
  const start = Math.max(a.start_year ?? 0, b.start_year ?? 0);
  const end = Math.min(a.end_year ?? NOW, b.end_year ?? NOW);
  return end >= start ? [start, end] : null;
}

export function monthsSince(date: string | null) {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / (30.4 * 86_400_000));
}

function sectorTag(c: Contact, sector?: string | null) {
  if (!sector) return null;
  const words = sector.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4 && !GENERIC.has(w));
  for (const tag of c.expertise ?? []) {
    for (const t of tag.toLowerCase().split(/[^a-z]+/)) {
      if (t.length >= 4 && !GENERIC.has(t) && words.some((w) => w.startsWith(t) || t.startsWith(w))) return tag;
    }
  }
  return null;
}

function sharedUnit(title: string | null, role: string) {
  if (!title) return null;
  const words = new Set(title.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 5 && !TITLE_STOP.has(w)));
  return role.toLowerCase().split(/[^a-z]+/).find((w) => words.has(w)) ?? null;
}

export interface Suggestion {
  contact: Contact;
  score: number;
  reasons: string[];
  stale: number | null;
}

/** Rank contacts by how well placed they are to explain an event at `symbol` (optionally about one person). */
export function whoToCall(
  net: Network,
  opts: { symbol: string; sector?: string | null; person?: MgmtChange | null },
  limit = 3,
): Suggestion[] {
  const out: Suggestion[] = [];
  const p = opts.person ?? null;
  for (const c of net.contacts) {
    const reasons: string[] = [];
    let score = 0;
    for (const s of c.stints) {
      if (s.kind === "work" && s.symbol === opts.symbol) {
        const current = s.end_year == null;
        score += current ? 4 : 3;
        reasons.push(`${current ? "Works at" : "Was at"} ${s.org_name}: ${s.title ?? "role n/a"}, ${span(s)}`);
        const unit = p ? sharedUnit(s.title, p.role) : null;
        if (p && unit) {
          score += 2;
          reasons.push(`Same part of the business as ${p.person_name} (“${unit}”)`);
        }
      }
      if (p && s.kind === "work" && s.symbol !== opts.symbol &&
          (p.previous_employers ?? []).some((e) => sameOrg(s.org_name, e))) {
        score += 3;
        reasons.push(`Also worked at ${s.org_name}, like ${p.person_name}`);
      }
      if (p && s.kind === "education" && (p.education ?? []).some((e) => sameOrg(s.org_name, e))) {
        score += 2;
        reasons.push(`Studied at ${s.org_name}, like ${p.person_name}`);
      }
    }
    if (!reasons.length) {
      const tag = sectorTag(c, opts.sector);
      if (tag) {
        score += 1;
        reasons.push(`Your go-to on ${tag}`);
      }
    }
    if (!reasons.length) continue;
    score += (c.closeness ?? 1) * 0.5;
    out.push({ contact: c, score, reasons: reasons.slice(0, 2), stale: monthsSince(c.last_contacted) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Contacts who overlapped with `c` at the same organisation at the same time. */
export function colleagues(net: Network, c: Contact) {
  const found = new Map<string, { other: Contact; org: string; years: string }>();
  for (const o of net.contacts) {
    if (o.id === c.id || found.has(o.id)) continue;
    for (const a of c.stints) {
      const b = o.stints.find((x) => x.kind === a.kind && sameOrg(x.org_name, a.org_name) && overlap(a, x));
      if (b) {
        const [s, e] = overlap(a, b)!;
        found.set(o.id, { other: o, org: a.org_name, years: `${s}–${e === NOW ? "now" : e}` });
        break;
      }
    }
  }
  return [...found.values()];
}

/** Where `c` overlapped with the investor themself (classmates, ex-colleagues). */
export function sharedWithMe(net: Network, c: Contact) {
  if (!net.self) return [];
  const out: string[] = [];
  for (const a of c.stints) {
    for (const b of net.self.stints) {
      const ov = a.kind === b.kind && sameOrg(a.org_name, b.org_name) ? overlap(a, b) : null;
      if (ov) out.push(`${a.kind === "education" ? "Studied" : "Worked"} at ${a.org_name} with you, ${ov[0]}–${ov[1] === NOW ? "now" : ov[1]}`);
    }
  }
  return out;
}

/** A material filing at a company where someone you've lost touch with works / worked. */
export function reconnects(net: Network, filings: Announcement[], limit = 3) {
  const out: { contact: Contact; months: number; filing: Announcement; org: string; current: boolean }[] = [];
  const used = new Set<string>();
  for (const f of filings) {
    if ((f.importance ?? 0) < 2) continue;
    for (const c of net.contacts) {
      if (used.has(c.id)) continue;
      const months = monthsSince(c.last_contacted);
      if (months == null || months < 6) continue;
      const s = c.stints.find((x) => x.kind === "work" && x.symbol === f.symbol);
      if (!s) continue;
      used.add(c.id);
      out.push({ contact: c, months, filing: f, org: s.org_name, current: s.end_year == null });
    }
  }
  return out.sort((a, b) => b.months - a.months).slice(0, limit);
}

/** Portfolio companies and how many contacts you have at each (0 = blind spot). */
export function coverage(net: Network, symbols: string[]) {
  return symbols.map((symbol) => ({
    symbol,
    count: net.contacts.filter((c) => c.stints.some((s) => s.kind === "work" && s.symbol === symbol)).length,
  }));
}