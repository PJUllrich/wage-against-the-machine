/**
 * Read and write the two generated data files, so that every script that
 * touches them agrees on the format.
 *
 *   data/headline.js  the calculator's inputs, between DATA:START/END markers
 *   data/series.js    the annual series behind the chart and data.html
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const HEADLINE_PATH = path.join(ROOT, "data", "headline.js");
export const SERIES_PATH = path.join(ROOT, "data", "series.js");
export const BASE_YEAR = 2016;

/* ---------- headline ---------- */

export function readHeadline() {
  const text = fs.readFileSync(HEADLINE_PATH, "utf8");
  const block = text.match(/\/\* DATA:START \*\/([\s\S]*?)\/\* DATA:END \*\//);
  if (!block) throw new Error("DATA:START / DATA:END markers not found in data/headline.js");
  return { text, DATA: new Function(block[1] + "; return DATA;")() };
}

/** Fields added after the first version, defaulted so older files upgrade cleanly. */
const DEFAULTS = { pricesTo: 2026, wagesTo: 2026, homesTo: 2026, rateSrc: "estimate" };

/** Field order is fixed so diffs stay readable across regenerations. */
export function writeHeadline(text, DATA, note) {
  for (const d of Object.values(DATA))
    for (const [k, v] of Object.entries(DEFAULTS)) if (d[k] === undefined) d[k] = v;
  const q = s => JSON.stringify(s);
  const pad = (s, n) => String(s).padEnd(n);
  const body = Object.entries(DATA).map(([iso, d]) =>
    `  ${iso}: {name:${pad(q(d.name) + ",", 18)}cur:${q(d.cur)}, sym:${pad(q(d.sym) + ",", 7)}locale:${q(d.locale)},\n` +
    `       prices:${pad(d.prices + ",", 8)}pricesTo:${d.pricesTo}, ` +
    `wages:${pad(d.wages + ",", 8)}wagesTo:${d.wagesTo}, ` +
    `homes:${pad(d.homes + ",", 8)}homesTo:${d.homesTo},\n` +
    `       rate16:${pad(d.rate16 + ",", 6)}rate26:${pad(d.rate26 + ",", 6)}rateSrc:${pad(q(d.rateSrc) + ",", 12)}solid:${d.solid}}`
  ).join(",\n");

  const next =
    "/* DATA:START */\n" +
    (note ? `/* ${note} */\n` : "") +
    `const DATA = {\n${body}\n};\n` +
    "/* DATA:END */";

  fs.writeFileSync(HEADLINE_PATH,
    text.replace(/\/\* DATA:START \*\/[\s\S]*?\/\* DATA:END \*\//, () => next));
}

/* ---------- series ---------- */

export function readSeries() {
  if (!fs.existsSync(SERIES_PATH))
    return { meta: { generated: "", baseYear: BASE_YEAR }, sources: {}, countries: {} };
  const raw = fs.readFileSync(SERIES_PATH, "utf8");
  try {
    return JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  } catch {
    console.warn("! data/series.js could not be parsed; starting a fresh bundle");
    return { meta: { generated: "", baseYear: BASE_YEAR }, sources: {}, countries: {} };
  }
}

export function writeSeries(bundle, today) {
  bundle.meta.generated = today;
  fs.mkdirSync(path.dirname(SERIES_PATH), { recursive: true });
  fs.writeFileSync(SERIES_PATH,
    "/* Generated — do not edit by hand. Rebuild with the scripts in scripts/.\n" +
    "   Each series carries: src (key into SERIES.sources), start (first year),\n" +
    "   raw (as published, in the source's own unit) and values (index, 2016 = 100,\n" +
    "   except rate series where values are the rate itself).\n" +
    "   Loaded with a plain <script> tag so the pages work over file:// too. */\n" +
    "window.SERIES = " + JSON.stringify(bundle, null, 1) + ";\n");
}

/**
 * Rebase a { year: level } map to 2016 = 100, returning the compact form.
 *
 * `baseAny` falls back to the series' own first year when 2016 is missing.
 * Price-level series need it: nothing reads their index, they are used for the
 * money in `raw`, and requiring 2016 silently threw away every series that
 * starts later — Norway's begins in 2017.
 */
export function toSeries(src, byYear, { rawDigits = 2, extra = {}, baseAny = false } = {}) {
  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
  if (!years.length) return null;
  const base = byYear[BASE_YEAR] ?? (baseAny ? byYear[years[0]] : undefined);
  if (!base) return null;
  const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
  return {
    src,
    start: years[0],
    raw: years.map(y => round(byYear[y], rawDigits)),
    values: years.map(y => round((byYear[y] / base) * 100, 2)),
    ...extra,
  };
}
