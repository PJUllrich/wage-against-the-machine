#!/usr/bin/env node
/**
 * Build data/series.js — the annual time series behind the chart and the
 * data pages — from public, openly licensed mirrors of official statistics.
 *
 *   node scripts/build-data.mjs [--dry-run]
 *
 * No dependencies, no API key. Node 18+.
 *
 * Every series carries the source it came from, what was actually published,
 * and what this script derived from it. Two fields per series:
 *   raw    — the numbers as published, in the publisher's own unit
 *   values — the same numbers as an index rebased to 2016 = 100
 *
 * Sources are mirrors, not the publishers' own APIs: ec.europa.eu,
 * api.worldbank.org, stats.bis.org and fred.stlouisfed.org are all
 * unreachable from the environment this was written in, while
 * raw.githubusercontent.com is not. Each mirror is openly licensed and
 * names its upstream. Prefer the publisher directly if you can reach it.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readHeadline, readSeries, writeSeries } from "./lib/store.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "data", "series.js");
const BASE_YEAR = 2016;
const DRY = process.argv.includes("--dry-run");

const ISO3 = {
  US:"USA", GB:"GBR", DE:"DEU", FR:"FRA", IT:"ITA", ES:"ESP", NL:"NLD", BE:"BEL", AT:"AUT",
  IE:"IRL", PT:"PRT", GR:"GRC", FI:"FIN", EE:"EST", CY:"CYP", SE:"SWE", DK:"DNK", NO:"NOR",
  CH:"CHE", PL:"POL", CZ:"CZE", HU:"HUN", RO:"ROU", AU:"AUS",
};

const SOURCES = {
  "worldbank-cpi": {
    download: "https://api.worldbank.org/v2/en/indicator/FP.CPI.TOTL.ZG?downloadformat=csv",
    shortName: "World Bank consumer prices",
    title: "Inflation, consumer prices (annual %)",
    publisher: "World Bank, World Development Indicators",
    indicator: "FP.CPI.TOTL.ZG",
    upstream: "https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG",
    mirror: "downloaded by hand, committed in sources/ (was github.com/datasets/cpi)",
    file: "sources/worldbank-FP.CPI.TOTL.ZG-annual-percent.csv",
    licence: "CC BY-4.0",
    rawUnit: "annual change in consumer prices, %",
    method:
      "Annual percentage changes are chained into an index (each year = previous year × (1 + rate/100)), " +
      "then rebased so 2016 = 100. The index is therefore only as good as the chain: a single wrong or " +
      "missing year shifts every year after it.",
    caveats: [
      "The values are annual percentage changes, not an index. Verified against known figures " +
        "(Germany 2022: 6.87%, 2024: 2.26%) before use.",
      "National CPI, not the harmonised HICP that Eurostat publishes for EU members. The two differ by a point " +
        "or more over a decade for some countries.",
      "The United States has no 2025 figure in this release, so its price series ends a year earlier than " +
        "everyone else's. Every surface names the year it is quoting, so this shows up rather than hiding.",
      "This replaced the github.com/datasets/cpi mirror, which stopped at 2024 and carried −4.5% for Romania " +
        "in 2024 against the +5.7% the World Bank itself publishes. Taking the bulk file direct fixed both.",
    ],
  },
  "case-shiller": {
    download: "https://raw.githubusercontent.com/datasets/house-prices-us/main/data/national-month.csv",
    shortName: "Case-Shiller US home prices",
    title: "S&P CoreLogic Case-Shiller U.S. National Home Price Index",
    publisher: "S&P Dow Jones Indices / CoreLogic, via FRED",
    indicator: "CSUSHPINSA",
    upstream: "https://fred.stlouisfed.org/series/CSUSHPINSA",
    mirror: "https://github.com/datasets/house-prices-us",
    file: "https://raw.githubusercontent.com/datasets/house-prices-us/main/data/national-month.csv",
    licence: "ODC-PDDL-1.0",
    rawUnit: "index, January 2000 = 100, not seasonally adjusted",
    method: "Monthly index averaged to calendar years, then rebased so 2016 = 100.",
    caveats: [
      "Repeat-sales index: it tracks price changes for houses that sold twice, not the mix of what is on the " +
        "market, and it excludes new build.",
      "A year with fewer than twelve months of data is averaged over the months present and flagged partial.",
    ],
  },
  "uk-house-prices": {
    download: "https://raw.githubusercontent.com/datasets/house-prices-uk/main/data/data.csv",
    shortName: "Nationwide UK house prices",
    title: "House prices in the UK since 1952",
    publisher: "Nationwide Building Society house price index",
    indicator: "Price (All)",
    upstream: "https://www.nationwidehousepriceindex.co.uk/",
    mirror: "https://github.com/datasets/house-prices-uk",
    file: "https://raw.githubusercontent.com/datasets/house-prices-uk/main/data/data.csv",
    licence: "ODC-PDDL-1.0",
    rawUnit: "average price of all houses, nominal GBP",
    levelKind: "average",
    method: "Quarterly average prices averaged to calendar years, then rebased so 2016 = 100.",
    caveats: [
      "Nationwide's index is based on its own mortgage approvals, so it covers mortgaged purchases and not " +
        "cash sales.",
      "Nominal prices, not adjusted for the size or quality of what was bought.",
    ],
  },
};

/* ---------- helpers ---------- */

async function getText(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt >= 3) throw err;
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
}

function parseCSV(text) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = head.split(",");
  return lines.filter(Boolean).map(line => {
    const cells = line.split(",");
    return Object.fromEntries(cols.map((c, i) => [c, cells[i]]));
  });
}

const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;

/** Turn { year: value } into a compact series rebased to BASE_YEAR = 100. */
function toSeries(src, raw, opts = {}) {
  const years = Object.keys(raw).map(Number).sort((a, b) => a - b);
  if (!years.length) return null;
  const index = opts.chain ? chain(raw, years) : { ...raw };
  const base = index[BASE_YEAR];
  if (base === undefined) {
    console.warn(`  ! ${src}: no ${BASE_YEAR} observation, series dropped`);
    return null;
  }
  const idxYears = Object.keys(index).map(Number).sort((a, b) => a - b);
  return {
    src,
    start: idxYears[0],
    raw: idxYears.map(y => (raw[y] === undefined ? null : round(raw[y], opts.rawDigits ?? 2))),
    values: idxYears.map(y => round((index[y] / base) * 100, 2)),
    ...(opts.partial && opts.partial.length ? { partial: opts.partial } : {}),
    ...(opts.suspect ? { suspect: opts.suspect } : {}),
  };
}

/** Chain annual percentage changes into a level index. */
function chain(rates, years) {
  const out = {};
  let level = 100;
  for (const y of years) {
    level *= 1 + rates[y] / 100;
    out[y] = level;
  }
  return out;
}

/** Average monthly/quarterly observations into calendar years. */
function toAnnual(rows, dateKey, valueKey) {
  const buckets = {};
  for (const r of rows) {
    const v = Number(r[valueKey]);
    const y = Number(String(r[dateKey]).slice(0, 4));
    if (!Number.isFinite(v) || !Number.isFinite(y)) continue;
    (buckets[y] ||= []).push(v);
  }
  const annual = {}, counts = {};
  for (const [y, vs] of Object.entries(buckets)) {
    annual[y] = vs.reduce((a, b) => a + b, 0) / vs.length;
    counts[y] = vs.length;
  }
  return { annual, counts };
}

/* ---------- build ---------- */

const countries = {};
const put = (iso, kind, series) => {
  if (!series) return;
  (countries[iso] ||= {})[kind] = series;
};

/**
 * The World Bank's own bulk download, committed in sources/, rather than the
 * github.com/datasets/cpi mirror this used to fetch.
 *
 * The mirror stopped at 2024 and carried −4.5% for Romania in 2024 against the
 * +5.7% the World Bank itself publishes. Taking the file direct fixed both, and
 * the Romania caveat that rode along with every build went with it.
 *
 * It is the wide layout — four label columns and then one column per year —
 * where the mirror was one row per country-year.
 */
console.log("Consumer prices — World Bank bulk CSV in sources/");
{
  const text = fs.readFileSync(path.join(ROOT, SOURCES["worldbank-cpi"].file), "utf8").replace(/^\uFEFF/, "");
  /* Four preamble lines before the header, and every field is quoted. */
  const lines = text.trim().split(/\r?\n/);
  const head = lines.findIndex(l => l.startsWith('"Country Name"'));
  if (head < 0) throw new Error("header row not found in the World Bank CSV");
  /* Every line ends `",` — a trailing empty field. Left in, the last column
     parses as `2025",` rather than `2025`, and the newest year is silently
     dropped, which is exactly the year this file was fetched for. */
  const cells = l => l.replace(/,\s*$/, "").split('","').map(c => c.replace(/^"|"$/g, ""));
  const cols = cells(lines[head]);
  const yearAt = cols.map(c => (/^\d{4}$/.test(c) ? Number(c) : null));

  const byIso3 = {};
  for (const line of lines.slice(head + 1)) {
    if (!line.trim()) continue;
    const r = cells(line);
    const rates = {};
    yearAt.forEach((y, i) => {
      if (!y || !r[i]) return;
      const v = Number(r[i]);
      if (Number.isFinite(v)) rates[y] = v;
    });
    if (Object.keys(rates).length) byIso3[r[1]] = rates;
  }

  for (const [iso2, iso3] of Object.entries(ISO3)) {
    const rates = byIso3[iso3];
    if (!rates) { console.warn(`  ! ${iso2}: not in the file`); continue; }
    const years = Object.keys(rates).map(Number).sort((a, b) => a - b);
    const gaps = [];
    for (let y = years[0]; y <= years.at(-1); y++) if (rates[y] === undefined) gaps.push(y);
    if (gaps.length) console.warn(`  ! ${iso2}: gap years in the chain: ${gaps.join(", ")}`);
    put(iso2, "prices", toSeries("worldbank-cpi", rates, { chain: true, rawDigits: 3 }));
  }
  const n = Object.values(countries).filter(c => c.prices).length;
  const ends = {};
  for (const [iso2, iso3] of Object.entries(ISO3))
    if (byIso3[iso3]) { const e = Math.max(...Object.keys(byIso3[iso3]).map(Number)); (ends[e] ||= []).push(iso2); }
  console.log(`  ${n}/${Object.keys(ISO3).length} countries`);
  for (const [y, list] of Object.entries(ends).sort())
    console.log(`  ends ${y}: ${list.length}${list.length < 4 ? " (" + list.join(", ") + ")" : ""}`);
}

console.log("US house prices — Case-Shiller via datasets/house-prices-us");
{
  const rows = parseCSV(await getText(SOURCES["case-shiller"].file));
  const { annual, counts } = toAnnual(rows, "Date", "National-US");
  const partial = Object.keys(counts).filter(y => counts[y] < 12).map(Number);
  put("US", "homes", toSeries("case-shiller", annual, { rawDigits: 2, partial }));
  console.log(`  ${Object.keys(annual).length} years, partial: ${partial.join(", ") || "none"}`);
}

console.log("UK house prices — Nationwide via datasets/house-prices-uk");
{
  const rows = parseCSV(await getText(SOURCES["uk-house-prices"].file));
  const { annual, counts } = toAnnual(rows, "Date", "Price (All)");
  const full = Math.max(...Object.values(counts));
  const partial = Object.keys(counts).filter(y => counts[y] < full).map(Number);
  const uk = toSeries("uk-house-prices", annual, { rawDigits: 0, partial });
  /* Nationwide publishes actual prices, not an index — the only house price
     series here that does, which is what makes the "salaries per house"
     chart possible for the UK and nowhere else. */
  if (uk) uk.rawIsLevel = true;
  put("GB", "homes", uk);
  /* The same numbers again under their own kind: "homes" is the index every
     country has, "homeprice" is money, which only a couple of sources give. */
  put("GB", "homeprice", uk);
  console.log(`  ${Object.keys(annual).length} years, partial: ${partial.join(", ") || "none"}`);
}

/* Wages: no openly mirrored cross-country annual series was reachable.
   scripts/fetch-eurostat.mjs fills these in when Eurostat is reachable. */

/* ---------- report coverage against the headline numbers ---------- */

const { DATA } = readHeadline();

console.log("\nSeries vs. the headline figures in index.html:");
for (const [iso, kinds] of Object.entries(countries)) {
  for (const [kind, s] of Object.entries(kinds)) {
    const last = s.start + s.values.length - 1;
    const change = s.values.at(-1) - 100;
    const headline = DATA[iso] ? DATA[iso][kind] : null;
    console.log(
      `  ${iso} ${kind.padEnd(6)} ${String(s.start)}–${last}  ${BASE_YEAR}→${last}: ` +
      `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`.padEnd(22) +
      (headline === null ? "" : `headline says ${headline > 0 ? "+" : ""}${headline}% to 2026`)
    );
  }
}

/* ---------- write ----------
   Merge, never replace: wages come from scripts/import-local.mjs and Eurostat
   series from scripts/fetch-eurostat.mjs, and both live in the same bundle. */

const bundle = readSeries();
for (const [key, src] of Object.entries(SOURCES)) bundle.sources[key] = src;

let written = 0, replaced = [];
for (const [iso, kinds] of Object.entries(countries)) {
  for (const [kind, s] of Object.entries(kinds)) {
    const prev = (bundle.countries[iso] || {})[kind];
    if (prev && prev.src !== s.src) replaced.push(`${iso} ${kind} (${prev.src} → ${s.src})`);
    (bundle.countries[iso] ||= {})[kind] = s;
    written++;
  }
}
if (replaced.length) console.log(`\nReplaced ${replaced.length} series from another source: ${replaced.join(", ")}`);

const kept = Object.values(bundle.countries).reduce((n, c) => n + Object.keys(c).length, 0) - written;
if (DRY) {
  console.log(`\n--dry-run: would write ${written} series, leaving ${kept} from other scripts untouched.`);
} else {
  writeSeries(bundle, new Date().toISOString().slice(0, 10));
  console.log(`\nWrote ${written} series into data/series.js, leaving ${kept} from other scripts untouched.`);
}
