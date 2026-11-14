import { supabase } from "./supabase";
import {
  DEFAULT_PREFS,
  type Announcement,
  type Company,
  type Contact,
  type Network,
  type Prefs,
  type Signal,
} from "./types";

export async function loadPortfolio(): Promise<Company[]> {
  const { data, error } = await supabase
    .from("holdings")
    .select("symbol, list, companies(symbol, name, sector)")
    .eq("list", "portfolio");
  if (error) throw error;
  return (data ?? []).map((h) => h.companies as unknown as Company);
}

export async function loadFilings(symbols: string[], sinceISO: string): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("id, symbol, published_at, subject, attachment_url, category, importance, summary, extracted")
    .in("symbol", symbols)
    .gte("published_at", sinceISO)
    .order("published_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as Announcement[];
}

/** Latest trading day's move for each company. */
export async function loadSignals(symbols: string[]): Promise<Signal[]> {
  const since = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("price_signals")
    .select("*")
    .in("symbol", symbols)
    .gte("date", since)
    .order("date", { ascending: false });
  if (error) throw error;
  const latest = new Map<string, Signal>();
  for (const s of (data ?? []) as Signal[]) if (!latest.has(s.symbol)) latest.set(s.symbol, s);
  return [...latest.values()];
}

export async function loadPrefs(): Promise<Prefs> {
  const { data, error } = await supabase
    .from("preferences")
    .select("price_move_pct, volume_multiple, alert_categories")
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_PREFS;
  return {
    price_move_pct: Number(data.price_move_pct),
    volume_multiple: Number(data.volume_multiple),
    alert_categories: data.alert_categories as string[],
  };
}

export async function savePrefs(p: Prefs) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");
  const { error } = await supabase
    .from("preferences")
    .upsert({ owner_id: auth.user.id, ...p, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function loadWatchlists(): Promise<{ portfolio: Company[]; research: Company[] }> {
  const { data, error } = await supabase.from("holdings").select("list, companies(symbol, name, sector)");
  if (error) throw error;
  const rows = (data ?? []).map((h) => ({ list: h.list as string, c: h.companies as unknown as Company }));
  return {
    portfolio: rows.filter((r) => r.list === "portfolio").map((r) => r.c),
    research: rows.filter((r) => r.list === "research").map((r) => r.c),
  };
}

export async function loadNetwork(): Promise<Network> {
  const { data, error } = await supabase
    .from("persons")
    .select("id, full_name, headline, city, kind, relationship, closeness, last_contacted, expertise, stints(org_name, symbol, kind, title, start_year, end_year)");
  if (error) throw error;
  const people = (data ?? []) as unknown as Contact[];
  return {
    self: people.find((p) => p.kind === "self") ?? null,
    contacts: people.filter((p) => p.kind === "contact"),
  };
}