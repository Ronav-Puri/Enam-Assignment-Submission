import * as cheerio from "cheerio";
import { PDFDocument } from "pdf-lib";

export type Table = { periods: string[]; rows: Record<string, (number | null)[]> };
export type Doc = { label: string; url: string };
export type ScreenerData = {
  name: string;
  basis: "consolidated" | "standalone";
  url: string;
  quarters: Table;
  pl: Table | null;
  bs: Table | null;
  cf: Table | null;
  ratios: Table | null;
  transcripts: Doc[];
};

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

function toNum(s: string): number | null {
  const t = s.replace(/[,%₹\s]/g, "");
  if (!t || t === "-") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseTable($: cheerio.CheerioAPI, section: string): Table | null {
  const table = $(`${section} table.data-table`).first();
  if (!table.length) return null;
  const periods = table.find("thead th").toArray().map((th) => $(th).text().trim()).slice(1);
  const rows: Table["rows"] = {};
  table.find("tbody tr").toArray().forEach((tr) => {
    const cells = $(tr).find("td").toArray();
    if (!cells.length) return;
    const label = $(cells[0]).text().replace(/\+/g, "").replace(/\s+/g, " ").trim();
    if (label) rows[label] = cells.slice(1).map((td) => toNum($(td).text()));
  });
  return { periods, rows };
}

function parseTranscripts($: cheerio.CheerioAPI): Doc[] {
  const docs: Doc[] = [];
  $("#documents div.concalls li").toArray().forEach((li) => {
    const date = $(li).children().first().text().trim();
    const link = $(li).find("a").toArray().find((a) => $(a).text().trim().toLowerCase() === "transcript");
    const href = link ? $(link).attr("href") : undefined;
    if (href) docs.push({ label: `${date} earnings call`, url: new URL(href, "https://www.screener.in").toString() });
  });
  return docs.slice(0, 4);                                   // newest first
}

export async function fetchScreener(symbol: string): Promise<ScreenerData> {
  for (const path of [`/company/${symbol}/consolidated/`, `/company/${symbol}/`]) {
    const url = `https://www.screener.in${path}`;
    const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`screener.in returned ${res.status}`);
    const $ = cheerio.load(await res.text());
    const quarters = parseTable($, "#quarters");
    if (!quarters || quarters.periods.length === 0) continue;   // no consolidated data: try standalone
    return {
      name: $("h1").first().text().trim() || symbol,
      basis: path.includes("consolidated") ? "consolidated" : "standalone",
      url,
      quarters,
      pl: parseTable($, "#profit-loss"),
      bs: parseTable($, "#balance-sheet"),
      cf: parseTable($, "#cash-flow"),
      ratios: parseTable($, "#ratios"),
      transcripts: parseTranscripts($),
    };
  }
  throw new Error(`No data found for "${symbol}". Check it's an NSE symbol (e.g. INFY, TATAELXSI).`);
}

async function firstPages(bytes: Uint8Array, n: number): Promise<Uint8Array> {
  try {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    if (src.getPageCount() <= n) return bytes;
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, Array.from({ length: n }, (_, i) => i));
    pages.forEach((p) => out.addPage(p));
    return await out.save();
  } catch {
    return bytes;
  }
}

export async function downloadPdf(url: string, maxPages: number): Promise<Uint8Array> {
  const referer = url.includes("bseindia.com") ? "https://www.bseindia.com/" : "https://www.screener.in/";
  const res = await fetch(url, { headers: { ...HEADERS, Referer: referer }, cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} downloading ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (!isPdf) throw new Error(`not a PDF: ${url}`);
  return firstPages(bytes, maxPages);
}