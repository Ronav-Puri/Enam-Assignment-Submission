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