import type { ScreenerData, Table } from "./screener";
import type { Metrics, NumRow } from "@/lib/types";

const r1 = (v: number) => Math.round(v * 10) / 10;

function find(t: Table | null, ...names: string[]) {
  if (!t) return null;
  for (const n of names) {
    const key = Object.keys(t.rows).find((k) => k.toLowerCase().startsWith(n.toLowerCase()));
    if (key) return t.rows[key];
  }
  return null;
}

function cagr(first: number | null | undefined, last: number | null | undefined, years: number) {
  if (!first || !last || first <= 0 || last <= 0 || years <= 0) return null;
  return r1((Math.pow(last / first, 1 / years) - 1) * 100);
}

export function computeMetrics(s: ScreenerData): Metrics {
  const isFinancial = !!find(s.quarters, "Financing Profit");

  // Quarterly: last 8 quarters
  const qp = s.quarters.periods;
  const qSales = find(s.quarters, "Sales", "Revenue");
  const qOp = find(s.quarters, "Operating Profit", "Financing Profit");
  const qOpm = find(s.quarters, "OPM", "Financing Margin");
  const qNp = find(s.quarters, "Net Profit");
  const quarterly: NumRow[] = qp.map((period, i) => ({
    period,
    sales: qSales?.[i] ?? null,
    op_profit: qOp?.[i] ?? null,
    opm: qOpm?.[i] ?? null,
    net_profit: qNp?.[i] ?? null,
  })).slice(-8);

  // Annual: last 6 financial years (TTM kept separately)
  const ap = s.pl?.periods ?? [];
  const aSales = find(s.pl, "Sales", "Revenue");
  const aOp = find(s.pl, "Operating Profit", "Financing Profit");
  const aOpm = find(s.pl, "OPM", "Financing Margin");
  const aNp = find(s.pl, "Net Profit");
  const row = (i: number): NumRow => ({
    period: ap[i],
    sales: aSales?.[i] ?? null,
    op_profit: aOp?.[i] ?? null,
    opm: aOpm?.[i] ?? null,
    net_profit: aNp?.[i] ?? null,
  });
  const ttmIndex = ap.findIndex((p) => p.toUpperCase() === "TTM");
  const annual = ap.map((_, i) => i).filter((i) => i !== ttmIndex).slice(-6).map(row);
  const ttm = ttmIndex >= 0 ? row(ttmIndex) : annual[annual.length - 1] ?? null;
  const years = annual.length - 1;

  // Balance sheet (latest year)
  const b = (s.bs?.periods.length ?? 0) - 1;
  const at = (arr: (number | null)[] | null) => (arr && b >= 0 ? arr[b] ?? null : null);
  const equityCap = at(find(s.bs, "Equity Capital"));
  const reserves = at(find(s.bs, "Reserves"));
  const equity = equityCap != null || reserves != null ? (equityCap ?? 0) + (reserves ?? 0) : null;
  const borrowings = at(find(s.bs, "Borrowings", "Borrowing"));
  const debtToEquity = !isFinancial && equity && borrowings != null ? Math.round((borrowings / equity) * 100) / 100 : null;

  // Cash quality: operating cash flow vs net profit, matched by year
  const cfo = find(s.cf, "Cash from Operating");
  const cashVsProfit = (s.cf?.periods ?? [])
    .map((period, i) => ({ period, cfo: cfo?.[i] ?? null, pat: aNp?.[ap.indexOf(period)] ?? null }))
    .slice(-5);
  const last3 = cashVsProfit.slice(-3).filter((x) => x.cfo != null && x.pat != null);
  const patSum = last3.reduce((a, x) => a + (x.pat ?? 0), 0);
  const cfoSum = last3.reduce((a, x) => a + (x.cfo ?? 0), 0);
  const cashConversion = !isFinancial && last3.length && patSum > 0 ? Math.round((cfoSum / patSum) * 100) : null;

  // Ratios
  const roceRow = find(s.ratios, "ROCE");
  const ccc = find(s.ratios, "Cash Conversion Cycle");
  const cccTrend = (s.ratios?.periods ?? []).map((period, i) => ({ period, days: ccc?.[i] ?? null })).slice(-5);

  return {
    is_financial: isFinancial,
    quarterly,
    annual,
    ttm,
    sales_cagr: cagr(annual[0]?.sales, annual[annual.length - 1]?.sales, years),
    profit_cagr: cagr(annual[0]?.net_profit, annual[annual.length - 1]?.net_profit, years),
    cagr_years: years,
    roce: roceRow ? roceRow[roceRow.length - 1] ?? null : null,
    borrowings,
    equity,
    debt_to_equity: debtToEquity,
    cash_conversion_3y: cashConversion,
    cash_vs_profit: cashVsProfit,
    ccc_trend: cccTrend,
  };
}