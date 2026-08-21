#!/usr/bin/env node
/**
 * Regenerate the DATA object in index.html from Eurostat.
 *
 *   node scripts/fetch-eurostat.mjs              # fetch and rewrite index.html
 *   node scripts/fetch-eurostat.mjs --dry-run    # fetch and print, write nothing
 *   node scripts/fetch-eurostat.mjs --only=DE,FR # limit to some countries
 *
 * No dependencies, no API key. Node 18+ (uses global fetch).
 *
 * What it touches: only prices, wages, homes and solid. Country names,
 * currencies, locales and mortgage rates are read from the existing DATA
 * object and written back unchanged — Eurostat has none of them.
 *
 * Caveats worth knowing before you trust the output:
 *  - Wages come from lc_lci_r2_a, the labour cost index (wages and salaries).
 *    It is not the same thing as average annual earnings. OECD's "Average
 *    annual wages" is the better series; it has no open REST API, so if you
 *    want it, download it and hand-edit those figures.
 *  - The US is not in Eurostat. Its row is left alone; refresh it from BLS
 *    (CPI-U, average hourly earnings) and Case-Shiller by hand.
 *  - Greece has no transaction-based house price index in Eurostat. Its homes
 *    figure is left as the existing estimate and the country stays solid:false.
 *  - Series end at different years. The script reports the latest year it
 *    used for each series; if that is not the year in the page's table
 *    caption, fix the caption.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HTML_PATH = path.join(HERE, "..", "index.html");
const BASE_YEAR = 2016;
const API = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";

/* Eurostat geo codes differ from the ISO codes used in DATA. */
const GEO = { GR: "EL", GB: "UK" };

/* Series Eurostat cannot answer, and why. "sourced" means the figure in
   DATA comes from a published national source instead (so the country can
   still count as solid); "estimate" means it is a hand-compiled guess. */
const SKIP = {
  US: { prices: "sourced", wages: "sourced", homes: "sourced" },
  GR: { homes: "estimate" },
};
const skipped = (iso, kind) => (SKIP[iso] || {})[kind];

/* Each series lists parameter sets in order of preference: the first one
   that returns a usable 2016 value wins. The index base year is irrelevant
   because we only ever use the ratio latest / 2016. */
const SERIES = {
  prices: {
    dataset: "prc_hicp_aind",
    variants: [{ unit: "INX_A_AVG", coicop: "CP00" }],
  },
  homes: {
    dataset: "prc_hpi_a",
    variants: [
      { unit: "I15_A_AVG", purchase: "TOTAL" },
      { unit: "I10_A_AVG", purchase: "TOTAL" },
      { unit: "I20_A_AVG", purchase: "TOTAL" },
    ],
  },
  wages: {
    dataset: "lc_lci_r2_a",
    variants: [
      { unit: "I20", nace_r2: "B-S", lcstruct: "D11", s_adj: "NSA" },
      { unit: "I16", nace_r2: "B-S", lcstruct: "D11", s_adj: "NSA" },
      { unit: "I20", nace_r2: "B-S", lcstruct: "D1", s_adj: "NSA" },
    ],
  },
};

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const ONLY = (argv.find(a => a.startsWith("--only=")) || "").slice(7)
  .split(",").map(s => s.trim().toUpperCase()).filter(Boolean);

/* ---------- read the current DATA object out of index.html ---------- */

const html = fs.readFileSync(HTML_PATH, "utf8");
const block = html.match(/\/\* DATA:START \*\/([\s\S]*?)\/\* DATA:END \*\//);
if (!block) {
  console.error("Could not find the /* DATA:START */ … /* DATA:END */ markers in index.html.");
  process.exit(1);
}
const DATA = new Function(block[1] + "; return DATA;")();

/* ---------- Eurostat ---------- */

async function getJSON(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (res.status === 404) return null;          // no such series for this country
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 400 * attempt));
      return getJSON(url, attempt + 1);
    }
    throw err;
  }
}

/**
 * Flatten a JSON-stat 2.0 response into { year: value } for the time
 * dimension. Every dimension other than time must be pinned to a single
 * category by the query, which is what makes the flat index equal the
 * time index.
 */
function byYear(js) {
  if (!js || !js.dimension || !js.dimension.time) return null;
  const ids = js.id || [];
  const size = js.size || [];
  const timePos = ids.indexOf("time");
  if (timePos < 0) return null;
  const overSpecified = size.some((n, i) => i !== timePos && n !== 1);
  if (overSpecified) {
    throw new Error(`query left more than one category in a non-time dimension: ${ids} / ${size}`);
  }
  const index = js.dimension.time.category.index;
  const out = {};
  for (const [year, i] of Object.entries(index)) {
    const v = Array.isArray(js.value) ? js.value[i] : js.value[String(i)];
    if (v !== null && v !== undefined) out[year] = v;
  }
  return out;
}

async function series(iso, kind) {
  if (skipped(iso, kind)) return null;
  const { dataset, variants } = SERIES[kind];
  const geo = GEO[iso] || iso;
  for (const variant of variants) {
    const q = new URLSearchParams({ format: "JSON", lang: "EN", freq: "A", geo, ...variant });
    const js = await getJSON(`${API}/${dataset}?${q}`);
    const years = js && byYear(js);
    if (!years || years[BASE_YEAR] === undefined) continue;
    const latest = Object.keys(years).map(Number).filter(y => y >= BASE_YEAR).sort((a, b) => b - a)[0];
    if (latest === BASE_YEAR) continue;
    return {
      change: (years[latest] / years[BASE_YEAR] - 1) * 100,
      latest,
      variant: Object.values(variant).join("/"),
    };
  }
  return null;
}

function fmt(r) {
  return (r ? `${(r.change >= 0 ? "+" : "") + r.change.toFixed(1)}% →${r.latest}` : "—").padEnd(16);
}

/* ---------- fetch ---------- */

const codes = Object.keys(DATA).filter(c => !ONLY.length || ONLY.includes(c));
if (!codes.length) {
  console.error(`--only matched no country. Known: ${Object.keys(DATA).join(", ")}`);
  process.exit(1);
}
const log = [];
let failures = 0;

for (const iso of codes) {
  const row = DATA[iso];
  const got = {};
  for (const kind of ["prices", "wages", "homes"]) {
    try {
      const r = await series(iso, kind);
      if (r) {
        got[kind] = r;
        row[kind] = Math.round(r.change * 10) / 10;
      } else if (!skipped(iso, kind)) {
        failures++;
        console.warn(`  ! ${iso} ${kind}: no usable series, keeping ${row[kind]}`);
      }
    } catch (err) {
      failures++;
      console.warn(`  ! ${iso} ${kind}: ${err.message}, keeping ${row[kind]}`);
    }
  }
  /* Solid means every line is published, whether it came from Eurostat now
     or from a national source recorded by hand. Skipped estimates are not. */
  row.solid = ["prices", "wages", "homes"].every(k => got[k] || skipped(iso, k) === "sourced");
  log.push({ iso, ...got });
  console.log(
    `${iso.padEnd(3)} prices ${fmt(got.prices)}  wages ${fmt(got.wages)}  homes ${fmt(got.homes)}` +
    (row.solid ? "" : "  (estimates retained)")
  );
}

/* ---------- write it back ---------- */

const q = s => JSON.stringify(s);
const pad = (s, n) => String(s).padEnd(n);
const body = Object.entries(DATA).map(([iso, d]) =>
  `  ${iso}: {name:${pad(q(d.name) + ",", 18)}cur:${q(d.cur)}, sym:${pad(q(d.sym) + ",", 7)}` +
  `locale:${q(d.locale)}, prices:${pad(d.prices + ",", 7)}wages:${pad(d.wages + ",", 7)}` +
  `homes:${pad(d.homes + ",", 7)}rate16:${d.rate16}, rate26:${d.rate26}, solid:${d.solid}}`
).join(",\n");

const latestYears = [...new Set(log.flatMap(r =>
  ["prices", "wages", "homes"].map(k => r[k] && r[k].latest).filter(Boolean)))].sort();

const next =
  `/* DATA:START */\n` +
  `/* Prices, wages and homes fetched from Eurostat on ${new Date().toISOString().slice(0, 10)}\n` +
  `   by scripts/fetch-eurostat.mjs. Latest observation year seen: ${latestYears.join(", ") || "none"}.\n` +
  `   Mortgage rates are hand-maintained estimates and are not touched by the script. */\n` +
  `const DATA = {\n${body}\n};\n` +
  `/* DATA:END */`;

if (DRY) {
  console.log("\n--dry-run, index.html not written:\n");
  console.log(next);
} else {
  fs.writeFileSync(HTML_PATH, html.replace(/\/\* DATA:START \*\/[\s\S]*?\/\* DATA:END \*\//, () => next));
  console.log(`\nRefreshed ${codes.length} of ${Object.keys(DATA).length} countries; ` +
    `wrote ${path.relative(process.cwd(), HTML_PATH)}.`);
}

if (latestYears.length > 1) {
  console.warn(`\nNote: series end in different years (${latestYears.join(", ")}). ` +
    `The table caption in index.html says "2016 to 2026" — check it still holds.`);
}
if (failures) console.warn(`${failures} series could not be refreshed; their previous values were kept.`);
