export interface Company {
  symbol: string;
  name: string;
  sector: string | null;
}

export type Metric = "revenue" | "ebitda" | "pbt" | "pat";

export interface Period {
  label: string;
  revenue: number | null;
  ebitda: number | null;
  pbt: number | null;
  pat: number | null;
  exceptional_items: number | null;
  ebitda_margin: number | null;
}

export interface ResultsExtract {
  type: "results";
  basis: string;
  unit: string;
  page: number | null;
  current: Period;
  previous_quarter: Period;
  year_ago_quarter: Period;
  growth: Record<Metric, { qoq: number | null; yoy: number | null }>;
}

export interface MgmtChange {
  person_name: string;
  role: string;
  change: string;
  effective_date: string | null;
  background: string | null;
  previous_employers: string[];
  education: string[];
  importance?: number;
}

export interface MgmtExtract {
  type: "management_change";
  changes: MgmtChange[];
}

export interface Announcement {
  id: string;
  symbol: string;
  published_at: string;
  subject: string | null;
  attachment_url: string | null;
  category: string | null;
  importance: number | null;
  summary: string | null;
  extracted: ResultsExtract | MgmtExtract | { skipped: string } | null;
}

export interface Signal {
  symbol: string;
  date: string;
  close: number;
  volume: number | null;
  pct_change: number | null;
  volume_ratio: number | null;
}

export interface Prefs {
  price_move_pct: number;
  volume_multiple: number;
  alert_categories: string[];
}

export const DEFAULT_PREFS: Prefs = {
  price_move_pct: 4,
  volume_multiple: 2,
  alert_categories: ["results", "M&A", "management_change", "litigation", "fund_raise"],
};

// ---------- Research ----------
export interface NumRow {
  period: string;
  sales: number | null;
  op_profit: number | null;
  opm: number | null;
  net_profit: number | null;
}

export interface Metrics {
  is_financial: boolean;
  quarterly: NumRow[];
  annual: NumRow[];
  ttm: NumRow | null;
  sales_cagr: number | null;
  profit_cagr: number | null;
  cagr_years: number;
  roce: number | null;
  borrowings: number | null;
  equity: number | null;
  debt_to_equity: number | null;
  cash_conversion_3y: number | null;
  cash_vs_profit: { period: string; cfo: number | null; pat: number | null }[];
  ccc_trend: { period: string; days: number | null }[];
}

export interface Cited {
  quote: string;
  source: number;
  page?: number | null;
}

export interface Analysis {
  one_liner: string;
  business: { summary: string; segments: { name: string; share_pct?: number | null; note: string }[] };
  promises: ({ said_in: string; promise: string; outcome: string; verdict: "delivered" | "partly" | "missed" | "too_early" } & Cited)[];
  guidance: ({ topic: string; statement: string } & Cited)[];
  narrative_vs_numbers: { claim: string; reality: string; aligned: boolean }[];
  bull: string[];
  bear: string[];
}

export interface ResearchReport {
  symbol: string;
  name: string;
  basis: string;
  screener_url: string;
  generated_at: string;
  model: string;
  metrics: Metrics;
  analysis: Analysis;
  sources: { label: string; url: string }[];
}