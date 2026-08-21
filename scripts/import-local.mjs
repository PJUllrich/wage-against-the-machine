#!/usr/bin/env node
/**
 * Import the hand-downloaded files in sources/ into the generated data.
 *
 *   node scripts/import-local.mjs [--dry-run]
 *
 * Wages: OECD average annual wages, current prices, in each country's own
 * currency. Writes an annual series per country and updates the headline
 * wages figure to the measured 2016 → latest change.
 *
 * House prices: OECD analytical house price indicators, nominal, annual. Used for
 * every country except the US and UK, which keep their national indices —
 * Case-Shiller and Nationwide — because a country's own index beats a
 * cross-country compilation of it.
 *
 * Mortgage rates: ECB MIR cost of borrowing for house purchase, euro area.
 * This is an aggregate, not a per-country rate, so it is applied only to
 * euro-area countries and labelled as an aggregate everywhere it surfaces.
 * Non-euro countries keep their estimates.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readHeadline, writeHeadline, readSeries, writeSeries, toSeries, BASE_YEAR } from "./lib/store.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run");
const TODAY = new Date().toISOString().slice(0, 10);
const RETRIEVED = "2026-08-21";   // when the files in sources/ were downloaded

const OECD_CSV = path.join(ROOT, "sources", "oecd-average-annual-wages.csv");
const ECB_CSV = path.join(ROOT, "sources", "ecb-mir-euro-area-house-purchase.csv");
const OECD_HPI_CSV = path.join(ROOT, "sources", "oecd-house-prices-nominal-annual.csv");

/* Countries whose own national index we already have and prefer. */
const NATIONAL_HOUSING = { US: "Case-Shiller", GB: "Nationwide" };

const ISO3 = {
  US:"USA", GB:"GBR", DE:"DEU", FR:"FRA", IT:"ITA", ES:"ESP", NL:"NLD", BE:"BEL", AT:"AUT",
  IE:"IRL", PT:"PRT", GR:"GRC", FI:"FIN", EE:"EST", CY:"CYP", SE:"SWE", DK:"DNK", NO:"NOR",
  CH:"CHE", PL:"POL", CZ:"CZE", HU:"HUN", RO:"ROU",
};
const EURO = ["DE","FR","IT","ES","NL","BE","AT","IE","PT","GR","FI","EE","CY"];

const SOURCES = {
  "oecd-wages": {
    download: "https://sdmx.oecd.org/public/rest/data/OECD.ELS.SAE,DSD_EARNINGS@AV_AN_WAGE,1.0/all?format=csvfilewithlabels",
    shortName: "OECD average annual wages",
    title: "Average annual wages, current prices",
    publisher: "OECD, Employment and Labour Market Statistics",
    indicator: "DSD_EARNINGS@AV_AN_WAGE",
    upstream: "https://data-explorer.oecd.org",
    mirror: "downloaded by hand, committed in sources/",
    file: "sources/oecd-average-annual-wages.csv",
    licence: "OECD terms — free re-use with attribution",
    rawUnit: "average annual wage per full-time equivalent employee, national currency, current prices",
    method: "Current-price rows only, in each country's own currency, rebased so 2016 = 100.",
    caveats: [
      "Full-time equivalent: it divides the total wage bill by full-time equivalent employees, so it is " +
        "not the wage of a typical worker and says nothing about how pay is distributed.",
      "The same OECD file also carries constant-price and USD-PPP rows. Those are deliberately unused — a " +
        "real-terms series compared against the consumer prices line would count inflation twice.",
      "Cyprus is not an OECD member and has no series here; its headline pay figure remains an estimate.",
    ],
  },
  "oecd-house-prices": {
    download: "https://sdmx.oecd.org/public/rest/data/OECD.ECO.MPD,DSD_AN_HOUSE_PRICES@DF_HOUSE_PRICES,1.0/all?format=csvfilewithlabels",
    shortName: "OECD house prices",
    title: "Analytical house price indicators — nominal",
    publisher: "OECD, Economics Department",
    indicator: "DSD_AN_HOUSE_PRICES@DF_HOUSE_PRICES, measure HPI",
    upstream: "https://data-explorer.oecd.org",
    mirror: "downloaded by hand, committed in sources/",
    file: "sources/oecd-house-prices-nominal-annual.csv",
    licence: "OECD terms — free re-use with attribution",
    rawUnit: "nominal house price index, OECD's own base year, seasonally adjusted",
    method: "Annual nominal index as published, rebased so 2016 = 100.",
    caveats: [
      "Nominal, deliberately. The same OECD dataset publishes real house prices, a price-to-income ratio " +
        "and a price-to-rent ratio; all three are already divided by something, and charting them against " +
        "this site's consumer prices line would deflate twice.",
      "The US and UK keep their national indices here — Case-Shiller and Nationwide — rather than OECD's " +
        "versions. It is worth knowing how much that choice matters: for 2016 to 2025 OECD's US series says " +
        "+90.6% where Case-Shiller says +83.5%. Index choice moves the housing answer by several points.",
      "Cyprus is absent, so its housing figure remains an estimate.",
      "Coverage starts in 1970 for most of western Europe but only 2005–2009 for Estonia, Poland, Czechia, " +
        "Hungary and Romania.",
    ],
  },
  "ecb-mir": {
    download: "https://data.ecb.europa.eu/data/datasets/MIR",
    shortName: "ECB euro-area mortgage rates",
    title: "Cost of borrowing for households for house purchase, euro area",
    publisher: "European Central Bank, MFI interest rate statistics",
    indicator: "MIR.M.U2.B.A2C.AM.R.A.2250.EUR.N",
    upstream: "https://data.ecb.europa.eu/data/datasets/MIR",
    mirror: "downloaded by hand, committed in sources/",
    file: "sources/ecb-mir-euro-area-house-purchase.csv",
    licence: "ECB terms — free re-use with attribution",
    rawUnit: "annualised agreed rate on new loans, % per annum",
    method: "Monthly rates averaged to calendar years.",
    caveats: [
      "This is the euro area as a whole. It is not any single country's mortgage rate, and national rates " +
        "differ from it by a percentage point or more. Every euro-area country on this site shares this one " +
        "series; treat cross-country differences in the mortgage line as absent, not as measured.",
      "New loans only, so it tracks what a buyer would sign today rather than what existing borrowers pay.",
    ],
  },
};

/* ---------- parse ---------- */

function csvRows(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = splitCSV(head);
  return lines.filter(Boolean).map(l => Object.fromEntries(splitCSV(l).map((c, i) => [cols[i], c])));
}

/** Minimal CSV split that respects double quotes. */
function splitCSV(line) {
  const out = []; let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (quoted && line[i+1] === '"') { cur += '"'; i++; } else quoted = !quoted; }
    else if (ch === "," && !quoted) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/* ---------- wages ---------- */

const { text: headText, DATA } = readHeadline();
const bundle = readSeries();
const wageRows = csvRows(OECD_CSV);

console.log("OECD average annual wages — current prices, national currency");
let wageCount = 0;
for (const [iso2, iso3] of Object.entries(ISO3)) {
  const byYear = {};
  for (const r of wageRows) {
    if (r.REF_AREA !== iso3 || r.PRICE_BASE !== "V") continue;
    if (r.UNIT_MEASURE !== DATA[iso2].cur) continue;     // the country's own currency
    const y = Number(r.TIME_PERIOD), v = Number(r.OBS_VALUE);
    if (Number.isFinite(y) && Number.isFinite(v)) byYear[y] = v;
  }
  const s = toSeries("oecd-wages", byYear, { rawDigits: 0 });
  if (!s) { console.warn(`  ! ${iso2}: no current-price series, keeping the estimate`); continue; }
  const last = s.start + s.values.length - 1;
  const change = Math.round((s.values[s.values.length - 1] - 100) * 10) / 10;
  console.log(`  ${iso2}  ${s.start}–${last}  2016→${last}: ${change >= 0 ? "+" : ""}${change}%` +
              `   (headline was ${DATA[iso2].wages}%)`);
  (bundle.countries[iso2] ||= {}).wages = s;
  DATA[iso2].wages = change;
  DATA[iso2].wagesTo = last;
  wageCount++;
}

/* ---------- house prices ---------- */

console.log("\nOECD analytical house price indicators — nominal, annual");
const hpiRows = csvRows(OECD_HPI_CSV);
let homeCount = 0;
for (const [iso2, iso3] of Object.entries(ISO3)) {
  if (NATIONAL_HOUSING[iso2]) {
    console.log(`  ${iso2}  skipped — keeping the national ${NATIONAL_HOUSING[iso2]} index`);
    continue;
  }
  const byYear = {};
  for (const r of hpiRows) {
    if (r.REF_AREA !== iso3 || r.MEASURE !== "HPI" || r.FREQ !== "A") continue;
    const y = Number(r.TIME_PERIOD), v = Number(r.OBS_VALUE);
    if (Number.isFinite(y) && Number.isFinite(v)) byYear[y] = v;
  }
  const s = toSeries("oecd-house-prices", byYear, { rawDigits: 3 });
  if (!s) { console.warn(`  ! ${iso2}: no nominal annual series, keeping the estimate`); continue; }
  const last = s.start + s.values.length - 1;
  const change = Math.round((s.values[s.values.length - 1] - 100) * 10) / 10;
  console.log(`  ${iso2}  ${s.start}–${last}  2016→${last}: ${change >= 0 ? "+" : ""}${change}%` +
              `   (headline was ${DATA[iso2].homes}%)`);
  (bundle.countries[iso2] ||= {}).homes = s;
  DATA[iso2].homes = change;
  DATA[iso2].homesTo = last;
  homeCount++;
}

/* ---------- mortgage rates ---------- */

console.log("\nECB cost of borrowing for house purchase — euro area aggregate");
const rateRows = csvRows(ECB_CSV);
const valueKey = Object.keys(rateRows[0]).find(k => /MIR\./.test(k));
const buckets = {};
for (const r of rateRows) {
  const y = Number(String(r.DATE).slice(0, 4)), v = Number(r[valueKey]);
  if (Number.isFinite(y) && Number.isFinite(v)) (buckets[y] ||= []).push(v);
}
const annualRate = {}, months = {};
for (const [y, vs] of Object.entries(buckets)) {
  annualRate[y] = Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 100) / 100;
  months[y] = vs.length;
}
const rateYears = Object.keys(annualRate).map(Number).sort((a, b) => a - b);
const latestRateYear = rateYears[rateYears.length - 1];
const partialRate = rateYears.filter(y => months[y] < 12);
console.log(`  ${rateYears[0]}–${latestRateYear}, ${BASE_YEAR}: ${annualRate[BASE_YEAR]}% → ` +
            `${latestRateYear}: ${annualRate[latestRateYear]}%` +
            (partialRate.includes(latestRateYear) ? ` (${months[latestRateYear]} months so far)` : ""));

const rateSeries = {
  src: "ecb-mir",
  start: rateYears[0],
  raw: rateYears.map(y => annualRate[y]),
  values: rateYears.map(y => annualRate[y]),
  isRate: true,
  ...(partialRate.length ? { partial: partialRate } : {}),
};

for (const iso of EURO) {
  DATA[iso].rate16 = annualRate[BASE_YEAR];
  DATA[iso].rate26 = annualRate[latestRateYear];
  DATA[iso].rateSrc = "ecb-mir";
  (bundle.countries[iso] ||= {}).rate = rateSeries;
}
console.log(`  applied to ${EURO.length} euro-area countries; ` +
            `${Object.keys(DATA).length - EURO.length} non-euro countries keep estimates`);

/* ---------- write ---------- */

for (const [key, src] of Object.entries(SOURCES)) bundle.sources[key] = { ...src, retrieved: RETRIEVED };

if (DRY) {
  console.log(`\n--dry-run: would write ${wageCount} wage series, ${homeCount} house price series ` +
    `and ${EURO.length} rate series`);
} else {
  writeSeries(bundle, TODAY);
  writeHeadline(headText, DATA,
    `Wages and euro-area mortgage rates imported from sources/ on ${TODAY} by scripts/import-local.mjs.`);
  console.log(`\nWrote data/series.js and data/headline.js.`);
}
