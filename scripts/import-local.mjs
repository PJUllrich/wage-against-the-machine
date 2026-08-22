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
 * House price levels: FRED MSPUS, the US median sale price in dollars. Almost
 * every house price source publishes an index, which cannot be divided by a
 * salary; this one and Nationwide's UK series are the only prices in money
 * here, which is what makes the salaries-per-house chart possible at all.
 *
 * Mortgage rates: ECB MIR cost of borrowing for house purchase, euro area.
 * This is an aggregate, not a per-country rate, so it is applied only to
 * euro-area countries and labelled as an aggregate everywhere it surfaces.
 * Australia has its own, from RBA table F5. The other ten non-euro countries
 * keep their estimates.
 *
 * Australia: the ABS and RBA publish only xlsx, so those two files go through
 * scripts/lib/xlsx.mjs rather than the CSV reader. The ABS mean dwelling price
 * is a valuation of the housing stock rather than a transaction price, which
 * the source record and the calculator both have to say out loud.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readHeadline, writeHeadline, readSeries, writeSeries, toSeries, BASE_YEAR } from "./lib/store.mjs";
import { readSheet } from "./lib/xlsx.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run");
const TODAY = new Date().toISOString().slice(0, 10);
const RETRIEVED = "2026-08-21";   // when the files in sources/ were downloaded

const OECD_CSV = path.join(ROOT, "sources", "oecd-average-annual-wages.csv");
const ECB_CSV = path.join(ROOT, "sources", "ecb-mir-euro-area-house-purchase.csv");
const OECD_HPI_CSV = path.join(ROOT, "sources", "oecd-house-prices-nominal-annual.csv");
const MSPUS_CSV = path.join(ROOT, "sources", "fred-mspus-us-median-house-price.csv");
const DELOITTE_CSV = path.join(ROOT, "sources", "deloitte-property-index-2021-eur-per-sqm.csv");
const OECD_RENT_CSV = path.join(ROOT, "sources", "oecd-rent-prices-annual.csv");
const ESTAT_VALUE_CSV = path.join(ROOT, "sources", "eurostat-prc_hpi_hsva-house-sales-value.csv");
const ESTAT_COUNT_CSV = path.join(ROOT, "sources", "eurostat-prc_hpi_hsna-house-sales-number.csv");
const ESTAT_MINWAGE_CSV = path.join(ROOT, "sources", "eurostat-earn_mw_cur-minimum-wages.csv");
/* The two Australian files are xlsx because that is the only format the ABS and
   the RBA publish them in. scripts/lib/xlsx.mjs reads them without a dependency. */
const ABS_DWELLINGS_XLSX = path.join(ROOT, "sources", "abs-6432.0-table1-value-of-dwellings.xlsx");
const RBA_F5_XLSX = path.join(ROOT, "sources", "rba-f05-indicator-lending-rates.xlsx");
const RBA_F6_XLSX = path.join(ROOT, "sources", "rba-f06-housing-lending-rates.xlsx");

/* Series IDs, so a column is chosen by its identifier and not by matching its
   description. An earlier version of this looked for "Australia" in the column
   heading and silently got South Australia, whose heading contains it. */
const ABS_MEAN_PRICE_AU = "A83728647F";   /* Mean price of residential dwellings, Australia, $'000 */
const RBA_DISCOUNTED_VARIABLE = "FILRHLBVD";  /* Housing loans, banks, variable, discounted, owner-occupier */
const RBA_NEW_LOANS_OO = "FLRHOFTA";          /* New owner-occupier loans funded in the month, all institutions */

/* Eurostat geo codes differ from the ISO codes used in DATA. */
const ESTAT_GEO = { GR: "EL", GB: "UK" };

/* Deloitte quotes every country in euros, so only the euro area can be used
   without an exchange rate. The UK is excluded on quality: Nationwide publishes
   actual transaction prices, which beat a price anchored to one year. */
const DELOITTE_ANCHOR_YEAR = 2020;
const STANDARD_SQM = 70;

/* Countries whose own national index we already have and prefer. */
const NATIONAL_HOUSING = { US: "Case-Shiller", GB: "Nationwide" };

const ISO3 = {
  US:"USA", GB:"GBR", DE:"DEU", FR:"FRA", IT:"ITA", ES:"ESP", NL:"NLD", BE:"BEL", AT:"AUT",
  IE:"IRL", PT:"PRT", GR:"GRC", FI:"FIN", EE:"EST", CY:"CYP", SE:"SWE", DK:"DNK", NO:"NOR",
  CH:"CHE", PL:"POL", CZ:"CZE", HU:"HUN", RO:"ROU", AU:"AUS",
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
  "fred-mspus": {
    title: "Median sales price of houses sold, United States",
    shortName: "US median house price",
    download: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=MSPUS",
    publisher: "US Census Bureau and HUD, via FRED",
    indicator: "MSPUS",
    upstream: "https://fred.stlouisfed.org/series/MSPUS",
    mirror: "downloaded by hand, committed in sources/",
    file: "sources/fred-mspus-us-median-house-price.csv",
    licence: "US federal government data — public domain",
    rawUnit: "median sale price, nominal USD",
    levelKind: "median",
    method: "Quarterly medians averaged to calendar years.",
    caveats: [
      "A median of what sold, not a quality-adjusted index: it moves when the mix of houses being sold " +
        "changes, not only when prices do. Case-Shiller is the better series for the change in prices and is " +
        "what this site uses for the US house price line; this one is used only where an actual price in " +
        "dollars is needed.",
      "New and existing houses together, nationwide, so it says nothing about any particular market.",
    ],
  },
  "eurostat-house-sales": {
    title: "House sales — value and number of transacted dwellings",
    shortName: "Eurostat house sales",
    download: "https://ec.europa.eu/eurostat/databrowser/view/prc_hpi_hsva/default/table?lang=en",
    publisher: "Eurostat",
    indicator: "prc_hpi_hsva (value, NAC) ÷ prc_hpi_hsna (number, NR)",
    upstream: "https://ec.europa.eu/eurostat/databrowser/view/prc_hpi_hsva/default/table?lang=en",
    mirror: "downloaded by hand, committed in sources/",
    file: "sources/eurostat-prc_hpi_hsva-house-sales-value.csv",
    licence: "Eurostat re-use policy (attribution required)",
    rawUnit: "average price of a transacted dwelling, national currency",
    levelKind: "average",
    method:
      "The total value of dwellings sold in a year divided by the number sold, both as published, in " +
      "national currency. Every year is observed.",
    caveats: [
      "A plain mean of everything that changed hands — flats and houses, new and existing, city and " +
        "country. It moves when the mix of what sells changes, not only when prices do, which is exactly " +
        "what the house price index is built to correct for. Use the index for the change over time and " +
        "this for the level.",
      "Not every country reports it. Where a country publishes only an index, this site has no price in " +
        "money for it.",
      "The category used differs by country: the total of all dwellings where that is published, existing " +
        "dwellings otherwise. Each series records which.",
    ],
  },
  "oecd-rents": {
    title: "Analytical house price indicators — rent prices",
    shortName: "OECD rent prices",
    download: "https://sdmx.oecd.org/public/rest/data/OECD.ECO.MPD,DSD_AN_HOUSE_PRICES@DF_HOUSE_PRICES,1.0/all?format=csvfilewithlabels",
    publisher: "OECD, Economics Department",
    indicator: "DSD_AN_HOUSE_PRICES@DF_HOUSE_PRICES, measure RPI",
    upstream: "https://data-explorer.oecd.org",
    mirror: "transcribed by hand, committed in sources/",
    file: "sources/oecd-rent-prices-annual.csv",
    licence: "OECD terms — free re-use with attribution",
    rawUnit: "rent price index, OECD's own base year",
    method: "Annual rent price index as published, rebased so 2016 = 100.",
    caveats: [
      "The rent component of the consumer price index, so it tracks what tenants pay across the whole " +
        "stock — sitting tenants included — rather than what a flat is advertised at today. New-let rents " +
        "move faster than this.",
      "Rents feed the consumer prices line as well, so rents and prices are not independent of each other.",
    ],
  },
  "deloitte-sqm": {
    title: "Property Index — average price per square metre",
    shortName: "Deloitte European house prices",
    download: "https://www.deloitte.com/ce/en/issues/real-estate/property-index.html",
    publisher: "Deloitte, Property Index 10th edition (July 2021)",
    indicator: "Summary statistics of country average prices, page 30",
    upstream: "https://www.deloitte.com/ce/en/issues/real-estate/property-index.html",
    mirror: "transcribed by hand, committed in sources/",
    file: "sources/deloitte-property-index-2021-eur-per-sqm.csv",
    licence: "Deloitte publication — figures reproduced with attribution",
    rawUnit: `price of a standardised ${STANDARD_SQM} m² dwelling, nominal EUR`,
    levelKind: `standardised ${STANDARD_SQM} m²`,
    levelNoun: "dwelling",
    method:
      `A single price per square metre for ${DELOITTE_ANCHOR_YEAR} times ${STANDARD_SQM} m², then moved ` +
      `to every other year with that country's OECD house price index. One measured year, the rest inferred.`,
    caveats: [
      "This is an anchored estimate, not a measured price series. Only " + DELOITTE_ANCHOR_YEAR + " comes from " +
        "a published price; every other year is that price moved by an index. The UK and US figures elsewhere " +
        "on this site are measured transaction prices and are a great deal more solid.",
      `A standardised ${STANDARD_SQM} m² dwelling is not the average home anyone actually buys. It is a fixed ` +
        "yardstick, which is what makes countries comparable, and it will understate a family house.",
      "The price basis differs by country — an average transaction price for a new dwelling in most, a bid " +
        "price in Belgium and Germany, an older dwelling in the Netherlands, detached houses in Norway. " +
        "Deloitte's own convention, kept so the figures match the source.",
      "New-build prices are being moved by an index covering all dwellings, new and existing. The two do not " +
        "track each other exactly.",
      "Deloitte's own affordability multiples are not reproduced here, because they divide by a salary figure " +
        "that does not match OECD average annual wages: for Austria they imply about €29,400 against OECD's " +
        "€45,154, which is the difference between 10.6 salaries and 6.9.",
    ],
  },
  "abs-dwelling-prices": {
    retrieved: "2026-08-22",
    download: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/total-value-dwellings/latest-release",
    shortName: "ABS mean dwelling price",
    title: "Total Value of Dwellings — mean price of residential dwellings, Australia",
    publisher: "Australian Bureau of Statistics, catalogue 6432.0",
    indicator: `Table 1, series ${ABS_MEAN_PRICE_AU}`,
    upstream: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/total-value-dwellings/latest-release",
    mirror: "downloaded by hand, committed in sources/",
    file: "sources/abs-6432.0-table1-value-of-dwellings.xlsx",
    licence: "Creative Commons Attribution 4.0 International",
    rawUnit: "mean value of a residential dwelling, nominal AUD",
    levelKind: "average",
    levelNoun: "dwelling",
    levelNote:
      "The ABS price is the value of every home in Australia divided by the number of them, not the price " +
      "of the ones that sold. It runs higher than a transaction median and moves more smoothly.",
    method:
      "Quarterly means averaged to calendar years, in thousands of dollars as published, multiplied by a " +
      "thousand. Years with fewer than four quarters are dropped, so the series is whole years only.",
    caveats: [
      "A stock valuation, not a transaction price. The ABS divides the total value of the residential " +
        "dwelling stock by the number of dwellings, so this is what the average home is worth rather than " +
        "what the average buyer paid. Nationwide's UK figure and the US MSPUS figure are both transaction " +
        "prices; Australia's is not, and the three are not directly comparable with each other.",
      "It begins in the September quarter of 2011, so 2012 is the first whole year. Earlier years on this " +
        "site are that price carried back with the OECD house price index and are drawn dashed.",
      "All residential dwellings, houses and apartments together, across the whole country. The ABS also " +
        "publishes transaction medians by state in Table 2 of the same release, but with no national " +
        "aggregate, so they cannot replace this.",
    ],
  },
  "rba-f5-housing": {
    retrieved: "2026-08-22",
    download: "https://www.rba.gov.au/statistics/tables/xls/f05hist.xlsx",
    shortName: "RBA Australian mortgage rates",
    title: "Indicator Lending Rates — housing loans, banks, variable, discounted, owner-occupier",
    publisher: "Reserve Bank of Australia, statistical table F5",
    indicator: `Series ${RBA_DISCOUNTED_VARIABLE}`,
    upstream: "https://www.rba.gov.au/statistics/tables/",
    mirror: "downloaded by hand, committed in sources/",
    file: "sources/rba-f05-indicator-lending-rates.xlsx",
    licence: "Creative Commons Attribution 4.0 International",
    rawUnit: "discounted variable housing rate, % per annum",
    method: "Monthly rates averaged to calendar years.",
    caveats: [
      "The discounted rate rather than the standard variable one. The standard variable series goes back " +
        "to 1959 but is a list price almost nobody pays; the discounted series starts in 2004, which still " +
        "covers every year this site has an Australian house price for.",
      "An indicator rate, meaning what the banks advertise. RBA table F6 measures what borrowers are " +
        "actually charged and puts new owner-occupier loans about 0.6 points lower — 5.8% against 6.4% for " +
        "2025 — but only from 2019, too late to compare with 2016. Read the Australian mortgage line as " +
        "the shape of the change rather than the payment to the cent.",
      "Owner-occupier, variable rate. A borrower on a fixed rate through the 2021 trough is paying " +
        "something quite different.",
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
    scope: "euro area",
    method: "Monthly rates averaged to calendar years.",
    caveats: [
      "This is the euro area as a whole. It is not any single country's mortgage rate, and national rates " +
        "differ from it by a percentage point or more. Every euro-area country on this site shares this one " +
        "series; treat cross-country differences in the mortgage line as absent, not as measured.",
      "New loans only, so it tracks what a buyer would sign today rather than what existing borrowers pay.",
    ],
  },
  "eurostat-minimum-wages": {
    download: "https://ec.europa.eu/eurostat/databrowser/view/earn_mw_cur/default/table?lang=en",
    shortName: "Eurostat minimum wages",
    title: "Monthly minimum wages — bi-annual data",
    publisher: "Eurostat",
    indicator: "earn_mw_cur, currency NAC",
    upstream: "https://ec.europa.eu/eurostat/databrowser/view/earn_mw_cur/default/table?lang=en",
    mirror: "downloaded by hand, committed in sources/",
    file: "sources/eurostat-earn_mw_cur-minimum-wages.csv",
    licence: "Eurostat — free re-use with attribution",
    rawUnit: "statutory gross minimum wage per year, national currency",
    method:
      "National-currency rows only. Eurostat publishes a monthly rate twice a year, in January and " +
      "July; the two are averaged into one figure for the year and multiplied by twelve, which is what " +
      "makes it comparable with the OECD annual wage.",
    caveats: [
      "Only a statutory national minimum counts. Italy, Austria, Finland, Sweden, Denmark, Norway and " +
        "Switzerland set pay by collective agreement instead and appear in no year of this dataset — that " +
        "is an absence of a law, not an absence of a wage floor.",
      "Where the minimum is paid over more than twelve months — Greece, Spain and Portugal pay fourteen — " +
        "Eurostat has already converted it to a twelve-month equivalent, so multiplying by twelve does not " +
        "double-count those payments.",
      "The United Kingdom stops in 2020: Eurostat kept collecting it until Brexit and no later year is in " +
        "this table. Germany starts in 2015, when its statutory minimum came in.",
      "Gross, before tax and social contributions, and a monthly rate rather than an hourly one — hours " +
        "differ across countries, so the annual figure assumes full-time work all year.",
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
  const s = toSeries("oecd-wages", byYear, { rawDigits: 0, extra: { rawIsLevel: true } });
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

/* ---------- US house prices in dollars ---------- */

console.log("\nFRED median sales price of houses sold — United States");
{
  const rows = csvRows(MSPUS_CSV);
  const buckets = {};
  for (const r of rows) {
    const y = Number(String(r.observation_date).slice(0, 4)), v = Number(r.MSPUS);
    if (Number.isFinite(y) && Number.isFinite(v)) (buckets[y] ||= []).push(v);
  }
  const annual = {}, partial = [];
  for (const [y, vs] of Object.entries(buckets)) {
    annual[y] = Math.round(vs.reduce((a, b) => a + b, 0) / vs.length);
    if (vs.length < 4) partial.push(Number(y));
  }
  const s = toSeries("fred-mspus", annual, { rawDigits: 0, baseAny: true, extra: { rawIsLevel: true, partial } });
  if (s) {
    (bundle.countries.US ||= {}).homeprice = s;
    const last = s.start + s.values.length - 1;
    console.log(`  US  ${s.start}–${last}  median ${annual[last].toLocaleString()} USD in ${last}` +
                (partial.includes(last) ? ` (${buckets[last].length} quarters so far)` : ""));
  }
}

/* ---------- rents ---------- */

console.log("\nOECD rent prices — annual index");
{
  const rows = csvRows(OECD_RENT_CSV);
  let made = 0;
  for (const [iso, iso3] of Object.entries(ISO3)) {
    const byYear = {};
    for (const r of rows) {
      if (r.REF_AREA !== iso3 || r.MEASURE !== "RPI" || r.FREQ !== "A") continue;
      const y = Number(r.TIME_PERIOD), v = Number(r.OBS_VALUE);
      if (Number.isFinite(y) && Number.isFinite(v)) byYear[y] = v;
    }
    const s = toSeries("oecd-rents", byYear, { rawDigits: 3 });
    if (!s) continue;
    (bundle.countries[iso] ||= {}).rents = s;
    made++;
  }
  console.log(`  ${made} rent series`);
}

/* ---------- European house prices, measured ----------
   Value of dwellings sold divided by the number sold. Both come straight from
   Eurostat in national currency, so unlike the Deloitte anchor below there is
   no exchange rate and no single-year assumption involved. */

console.log("\nEurostat house sales — value ÷ number, national currency");
{
  const pick = (rows, wantUnit, key) => {
    const out = {};
    for (const r of rows) {
      if (r.unit !== wantUnit) continue;
      const y = Number(r.TIME_PERIOD), v = Number(r.OBS_VALUE);
      if (!Number.isFinite(y) || !Number.isFinite(v)) continue;
      ((out[r.geo] ||= {})[r.purchase] ||= {})[y] = v;
    }
    return out;
  };
  const value = pick(csvRows(ESTAT_VALUE_CSV), "NAC");
  const count = pick(csvRows(ESTAT_COUNT_CSV), "NR");

  let made = 0;
  for (const iso of Object.keys(DATA)) {
    const geo = ESTAT_GEO[iso] || iso;
    let best = null;
    for (const cat of ["TOTAL", "DW_EXST", "DW_NEW"]) {
      const v = (value[geo] || {})[cat], n = (count[geo] || {})[cat];
      if (!v || !n) continue;
      const years = Object.keys(v).map(Number).filter(y => n[y]).sort((a, b) => a - b);
      if (years.length > 1 && (!best || years.length > best.years.length)) best = { cat, years, v, n };
    }
    if (!best) continue;
    const byYear = {};
    for (const y of best.years) byYear[y] = best.v[y] / best.n[y];
    const series = toSeries("eurostat-house-sales", byYear, {
      rawDigits: 0, baseAny: true,
      extra: { rawIsLevel: true, basis: best.cat === "TOTAL" ? "all dwellings" : best.cat === "DW_EXST" ? "existing dwellings" : "new dwellings" },
    });
    if (!series) { console.warn(`  ! ${iso}: series could not be built`); continue; }
    (bundle.countries[iso] ||= {}).homeprice = series;
    made++;
    const last = best.years[best.years.length-1];
    console.log(`  ${iso}  ${best.years[0]}–${last}  ${Math.round(byYear[last]).toLocaleString()} ${DATA[iso].cur}` +
                `  (${series.basis})`);
  }
  console.log(`  ${made} measured price series`);
}

/* ---------- European house prices, anchored ---------- */

console.log("\nDeloitte price per square metre — euro area only, anchored to " + DELOITTE_ANCHOR_YEAR);
{
  let made = 0;
  for (const r of csvRows(DELOITTE_CSV)) {
    const iso = r.iso;
    if (!EURO.includes(iso)) { console.log(`  ${iso}  skipped — priced in EUR but paid in ${DATA[iso] ? DATA[iso].cur : "?"}`); continue; }
    if ((bundle.countries[iso] || {}).homeprice) { console.log(`  ${iso}  skipped — already has a measured price series`); continue; }
    const idx = (bundle.countries[iso] || {}).homes;
    const perSqm = Number(r.eur_per_sqm);
    if (!idx || !Number.isFinite(perSqm)) { console.warn(`  ! ${iso}: no house price index to carry the anchor`); continue; }
    const at = y => { const i = y - idx.start; return i >= 0 && i < idx.values.length ? idx.values[i] : null; };
    const base = at(DELOITTE_ANCHOR_YEAR);
    if (!base) { console.warn(`  ! ${iso}: index does not cover ${DELOITTE_ANCHOR_YEAR}`); continue; }
    const anchor = perSqm * STANDARD_SQM;
    const byYear = {};
    for (let y = idx.start; y <= idx.start + idx.values.length - 1; y++) {
      const v = at(y);
      if (v) byYear[y] = anchor * (v / base);
    }
    const series = toSeries("deloitte-sqm", byYear, { rawDigits: 0, baseAny: true, extra: { rawIsLevel: true, derived: true } });
    if (!series) { console.warn(`  ! ${iso}: series could not be built`); continue; }
    (bundle.countries[iso] ||= {}).homeprice = series;
    made++;
    const last = series.start + series.values.length - 1;
    console.log(`  ${iso}  ${perSqm} EUR/m² × ${STANDARD_SQM} = ${anchor.toLocaleString()} in ${DELOITTE_ANCHOR_YEAR}` +
                ` → ${Math.round(byYear[last]).toLocaleString()} in ${last}  (${r.basis})`);
  }
  console.log(`  ${made} anchored price series`);
}

/* ---------- Australian house prices, measured ---------- */

/**
 * Both Australian spreadsheets are laid out the same way: a block of metadata
 * rows with a "Series ID" row in it, then one row per period keyed by a date in
 * the first column. Pull one column out by its identifier.
 */
function agencySeries(file, sheet, seriesId) {
  const rows = readSheet(fs.readFileSync(file), sheet);
  const idRow = rows.findIndex(r => r[0] === "Series ID");
  if (idRow < 0) throw new Error(`${path.basename(file)}: no "Series ID" row`);
  const col = rows[idRow].indexOf(seriesId);
  if (col < 0) throw new Error(`${path.basename(file)}: no series ${seriesId}`);
  const byYear = {};
  for (const r of rows.slice(idRow + 1)) {
    const d = r[0];
    if (!(d instanceof Date)) continue;
    const v = Number(r[col]);
    if (r[col] === null || r[col] === "" || !Number.isFinite(v)) continue;
    (byYear[d.getUTCFullYear()] ||= []).push(v);
  }
  const label = rows[0][col] || rows[1][col];
  return { byYear, label: typeof label === "string" ? label.trim() : seriesId };
}

/** Calendar-year means, keeping only years with the full complement of periods. */
function wholeYears(byYear, perYear) {
  const out = {}, partial = [];
  for (const [y, vs] of Object.entries(byYear)) {
    if (vs.length < perYear) { partial.push(Number(y)); continue; }
    out[y] = vs.reduce((a, b) => a + b, 0) / vs.length;
  }
  return { out, partial: partial.sort((a, b) => a - b) };
}

console.log("\nABS mean price of residential dwellings — Australia, in dollars");
{
  const { byYear, label } = agencySeries(ABS_DWELLINGS_XLSX, "Data1", ABS_MEAN_PRICE_AU);
  const { out, partial } = wholeYears(byYear, 4);
  /* Published in thousands. */
  const byDollar = Object.fromEntries(Object.entries(out).map(([y, v]) => [y, v * 1000]));
  const series = toSeries("abs-dwelling-prices", byDollar, {
    rawDigits: 0, baseAny: true,
    extra: { rawIsLevel: true, basis: "all residential dwellings" },
  });
  if (!series) throw new Error("AU: mean dwelling price series could not be built");
  (bundle.countries.AU ||= {}).homeprice = series;
  const ys = Object.keys(byDollar).map(Number).sort((a, b) => a - b);
  const last = ys[ys.length - 1];
  console.log(`  ${label}`);
  console.log(`  AU  ${ys[0]}\u2013${last}  ${Math.round(byDollar[last]).toLocaleString()} AUD` +
              (partial.length ? `  (dropped part-years ${partial.join(", ")})` : ""));
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
console.log(`  applied to ${EURO.length} euro-area countries`);

console.log("\nRBA discounted variable housing rate — Australia");
{
  const { byYear, label } = agencySeries(RBA_F5_XLSX, "Data", RBA_DISCOUNTED_VARIABLE);
  const { out, partial } = wholeYears(byYear, 12);
  /* The current year is still running, so it is kept and flagged rather than
     dropped: a rate series with no latest year has nothing to answer "now" with. */
  for (const y of partial) out[y] = byYear[y].reduce((a, b) => a + b, 0) / byYear[y].length;
  const years = Object.keys(out).map(Number).sort((a, b) => a - b);
  const rounded = Object.fromEntries(years.map(y => [y, Math.round(out[y] * 100) / 100]));
  const latest = years[years.length - 1];

  (bundle.countries.AU ||= {}).rate = {
    src: "rba-f5-housing",
    start: years[0],
    raw: years.map(y => rounded[y]),
    values: years.map(y => rounded[y]),
    isRate: true,
    ...(partial.length ? { partial } : {}),
  };
  DATA.AU.rate16 = rounded[BASE_YEAR];
  DATA.AU.rate26 = rounded[latest];
  DATA.AU.rateSrc = "rba-f5-housing";

  const check = wholeYears(agencySeries(RBA_F6_XLSX, "Data", RBA_NEW_LOANS_OO).byYear, 12).out;
  const shared = Object.keys(check).map(Number).filter(y => rounded[y]).sort((a, b) => a - b);
  const cross = shared[shared.length - 1];
  console.log(`  ${label}`);
  console.log(`  AU  ${years[0]}\u2013${latest}, ${BASE_YEAR}: ${rounded[BASE_YEAR]}% \u2192 ` +
              `${latest}: ${rounded[latest]}%` +
              (partial.includes(latest) ? ` (${byYear[latest].length} months so far)` : ""));
  console.log(`  cross-check, F6 new owner-occupier loans in ${cross}: ` +
              `${check[cross].toFixed(2)}% against this table's ${rounded[cross]}%`);
}

const estimated = Object.keys(DATA).filter(iso => DATA[iso].rateSrc === "estimate");
console.log(`\n  ${estimated.length} countries keep estimated rates: ${estimated.join(", ")}`);

/* ---------- minimum wages ---------- */

/**
 * Eurostat earn_mw_cur, in national currency. The published figure is a monthly
 * rate quoted twice a year; a year is the mean of its two semesters, annualised
 * by twelve so it can sit beside the OECD annual wage on the same axis.
 */
let minCount = 0;
console.log("\nEurostat minimum wages — national currency, annualised");
{
  const bySemester = {};
  for (const r of csvRows(ESTAT_MINWAGE_CSV)) {
    if (r.currency !== "NAC") continue;
    /* A country with no statutory minimum still gets a row for every semester,
       with the value left blank and flagged "m". Number("") is 0, not NaN, so
       an empty check has to come first or those countries arrive as a floor of
       zero and take the whole series down with them. */
    if (!r.OBS_VALUE) continue;
    const v = Number(r.OBS_VALUE);
    const y = Number(String(r.TIME_PERIOD).slice(0, 4));
    if (!Number.isFinite(v) || !Number.isFinite(y)) continue;
    ((bySemester[r.geo] ||= {})[y] ||= []).push(v);
  }

  const none = [];
  for (const iso of Object.keys(DATA)) {
    const geo = ESTAT_GEO[iso] || iso;
    const years = bySemester[geo];
    if (!years) { none.push(iso); continue; }
    const byYear = {};
    for (const [y, vs] of Object.entries(years))
      byYear[y] = (vs.reduce((a, b) => a + b, 0) / vs.length) * 12;
    const series = toSeries("eurostat-minimum-wages", byYear, {
      rawDigits: 0, baseAny: true, extra: { rawIsLevel: true },
    });
    if (!series) { console.warn(`  ! ${iso}: series could not be built`); continue; }
    (bundle.countries[iso] ||= {}).minwage = series;
    minCount++;
    const ys = Object.keys(byYear).map(Number).sort((a, b) => a - b);
    const last = ys[ys.length - 1];
    console.log(`  ${iso}  ${ys[0]}\u2013${last}  ${Math.round(byYear[last]).toLocaleString()} ${DATA[iso].cur}/year`);
  }
  /* "Not in the table" is not the same as "no minimum wage": Australia has one
     and Eurostat simply does not cover it. */
  const COLLECTIVE = new Set(["IT","AT","FI","SE","DK","NO","CH"]);
  console.log(`  ${minCount} minimum wage series; no statutory minimum in ` +
    `${none.filter(i => COLLECTIVE.has(i)).join(", ")}; outside Eurostat's coverage: ` +
    `${none.filter(i => !COLLECTIVE.has(i)).join(", ") || "none"}`);
}

/* ---------- write ---------- */

/* RETRIEVED is when most of sources/ was downloaded; a source added later carries its
   own date and keeps it. */
for (const [key, src] of Object.entries(SOURCES)) bundle.sources[key] = { retrieved: RETRIEVED, ...src };

if (DRY) {
  const rateCount = Object.values(bundle.countries).filter(c => c.rate).length;
  console.log(`\n--dry-run: would write ${wageCount} wage series, ${homeCount} house price series, ` +
    `${minCount} minimum wage series and ${rateCount} rate series`);
} else {
  writeSeries(bundle, TODAY);
  writeHeadline(headText, DATA,
    `Wages, mortgage rates and Australian house prices imported from sources/ on ${TODAY} by scripts/import-local.mjs.`);
  console.log(`\nWrote data/series.js and data/headline.js.`);
}
