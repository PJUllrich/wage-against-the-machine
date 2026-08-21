/**
 * The site is static. This Worker exists for two things:
 *
 *  1. /og.png renders a share card for the country and year in the query
 *     string, using workers-og — Satori for layout, resvg for the raster.
 *  2. A page request carrying a query string gets its og: tags rewritten to
 *     point at the matching card, so a shared link previews what was actually
 *     shared. Static hosting cannot vary meta tags by query string; the
 *     HTMLRewriter can.
 *
 * Everything else falls through to the assets binding.
 */

import { ImageResponse } from "workers-og";
import FALLBACK_FONT from "./fonts/DejaVuSans.ttf";

/* Inter matches the site; DejaVu is bundled so a blocked or slow font fetch can
   never take the card down. Both are cached for the life of the isolate. */
const INTER =
  "https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.ttf";
let fontCache = null;

async function font() {
  if (fontCache) return fontCache;
  try {
    const res = await fetch(INTER, { cf: { cacheTtl: 86400, cacheEverything: true } });
    if (res.ok) return (fontCache = { name: "Inter", data: await res.arrayBuffer() });
  } catch { /* fall through */ }
  return (fontCache = { name: "DejaVu Sans", data: FALLBACK_FONT });
}

const NAMES = {
  US: "United States", GB: "United Kingdom", DE: "Germany", FR: "France", IT: "Italy",
  ES: "Spain", NL: "Netherlands", BE: "Belgium", AT: "Austria", IE: "Ireland",
  PT: "Portugal", GR: "Greece", FI: "Finland", EE: "Estonia", CY: "Cyprus",
  SE: "Sweden", DK: "Denmark", NO: "Norway", CH: "Switzerland", PL: "Poland",
  CZ: "Czechia", HU: "Hungary", RO: "Romania",
};

let seriesCache = null;

/** The same data the page uses, read once out of the assets bundle. */
async function series(env, origin) {
  if (seriesCache) return seriesCache;
  const res = await env.ASSETS.fetch(new URL("/data/series.js", origin));
  if (!res.ok) throw new Error(`series.js ${res.status}`);
  const text = await res.text();
  seriesCache = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  return seriesCache;
}

const pct = n => (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(0) + "%";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Change for one line between the chosen year and the series' last reading. */
function change(country, kind, year) {
  const s = country && country[kind];
  if (!s) return null;
  const i = year - s.start;
  const base = i >= 0 && i < s.values.length ? s.values[i] : null;
  if (!base) return null;
  return { pct: (s.values[s.values.length - 1] / base - 1) * 100, to: s.start + s.values.length - 1 };
}

/** Salaries per house, where both sides exist in money. */
function salaries(country) {
  const hp = country && country.homeprice, wg = country && country.wages;
  if (!hp || !wg || !hp.rawIsLevel) return null;
  const last = Math.min(hp.start + hp.raw.length - 1, wg.start + wg.raw.length - 1);
  const p = hp.raw[last - hp.start], w = wg.raw[last - wg.start];
  return p && w ? p / w : null;
}

function card({ country, year, headline, sub, lines }) {
  /* Satori counts whitespace between tags as a child node and then rejects any
     div holding more than one child without an explicit display. This markup
     carries no whitespace between elements — do not prettify it. */
  const span = Math.max(1, ...lines.map(l => Math.abs(l.n || 0)));
  const bar = l => Math.round(52 + (Math.abs(l.n || 0) / span) * 470);

  const row = l =>
    `<div style="display:flex;align-items:center;margin-top:30px">` +
      `<div style="display:flex;font-size:26px;color:#3B4A44;width:250px">${esc(l.label)}</div>` +
      `<div style="display:flex;width:${bar(l)}px;height:30px;background:${l.colour}"></div>` +
      `<div style="display:flex;font-size:34px;font-weight:700;color:${l.colour};margin-left:20px">` +
        `${esc(l.value)}</div>` +
    `</div>`;

  return (
    `<div style="display:flex;flex-direction:column;width:1200px;height:630px;background:#EDEEE8;` +
      `font-family:Inter;color:#16232B">` +
      /* the three data colours as a rule across the top */
      `<div style="display:flex;height:10px;width:1200px">` +
        `<div style="display:flex;width:400px;height:10px;background:#B8791B"></div>` +
        `<div style="display:flex;width:400px;height:10px;background:#2F6F5E"></div>` +
        `<div style="display:flex;width:400px;height:10px;background:#7A3E8C"></div>` +
      `</div>` +
      `<div style="display:flex;flex-direction:column;padding:60px 72px 0">` +
        `<div style="display:flex;font-size:22px;letter-spacing:3px;color:#66716A">` +
          `${esc(country.toUpperCase())} · SINCE ${esc(year)}</div>` +
        `<div style="display:flex;font-size:${headline.length > 34 ? 56 : 68}px;font-weight:800;` +
          `margin-top:16px;line-height:1.05;letter-spacing:-2px">${esc(headline)}</div>` +
        `<div style="display:flex;font-size:26px;color:#3B4A44;margin-top:12px">${esc(sub)}</div>` +
        `<div style="display:flex;flex-direction:column;margin-top:38px">${lines.map(row).join("")}</div>` +
      `</div>` +
      `<div style="display:flex;justify-content:space-between;margin-top:auto;padding:0 72px 46px;` +
        `font-size:21px;color:#66716A">` +
        `<div style="display:flex">WageVsWorld.com</div>` +
        `<div style="display:flex">${esc(String(year))} → today</div>` +
      `</div>` +
    `</div>`
  );
}

async function ogImage(env, url) {
  const iso = (url.searchParams.get("c") || "").toUpperCase();
  const year = Number(url.searchParams.get("y")) || 2016;
  const f0 = await font();

  /* The bare card, for links that name no country — the front page, and
     anything shared before a country was picked. */
  if (!NAMES[iso]) {
    return new ImageResponse(
      card({
        country: "Wage vs World",
        year: "1960",
        headline: "What your old salary is worth now",
        sub: "Prices, pay and property across 23 countries",
        lines: [
          { label: "Consumer prices", value: "1960→", n: 62, colour: "#B8791B" },
          { label: "Average pay", value: "1990→", n: 44, colour: "#2F6F5E" },
          { label: "House prices", value: "1953→", n: 72, colour: "#7A3E8C" },
        ],
      }),
      { width: 1200, height: 630, fonts: [{ name: f0.name, data: f0.data, weight: 400, style: "normal" }] }
    );
  }
  const all = await series(env, url.origin);
  const country = all.countries[iso];

  const prices = change(country, "prices", year);
  const wages = change(country, "wages", year);
  const homes = change(country, "homes", year);
  const perHouse = salaries(country);

  const lines = [
    prices && { label: "Consumer prices", value: pct(prices.pct), n: prices.pct, colour: "#B8791B" },
    wages && { label: "Average pay", value: pct(wages.pct), n: wages.pct, colour: "#2F6F5E" },
    homes && { label: "House prices", value: pct(homes.pct), n: homes.pct, colour: "#7A3E8C" },
  ].filter(Boolean);

  let headline = "What your old salary is worth now";
  if (perHouse) headline = `A house costs ${perHouse.toFixed(1)} years of pay`;
  else if (wages && homes) {
    const gap = (1 + wages.pct / 100) / (1 + homes.pct / 100) - 1;
    headline = gap < 0
      ? `Pay lost ${Math.abs(gap * 100).toFixed(0)}% against housing`
      : `Pay gained ${(gap * 100).toFixed(0)}% against housing`;
  }
  const sub = wages && prices
    ? `Pay ${pct(wages.pct)} against prices ${pct(prices.pct)}`
    : "Prices, pay and property, measured since your year";

  return new ImageResponse(
    card({ country: NAMES[iso], year, headline, sub, lines }),
    { width: 1200, height: 630, fonts: [{ name: f0.name, data: f0.data, weight: 400, style: "normal" }] }
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/og.png") {
      try {
        return await ogImage(env, url);
      } catch (err) {
        /* A broken share card must never take a page down with it. */
        return new Response(`og render failed: ${err.message}`, { status: 500 });
      }
    }

    const res = await env.ASSETS.fetch(request);
    const isPage = (res.headers.get("content-type") || "").includes("text/html");
    const iso = url.searchParams.get("c");
    if (!isPage || !iso) return res;

    const og = `${url.origin}/og.png?c=${encodeURIComponent(iso)}` +
               `&y=${encodeURIComponent(url.searchParams.get("y") || "2016")}`;
    return new HTMLRewriter()
      .on('meta[property="og:image"]', { element: e => e.setAttribute("content", og) })
      .on('meta[property="og:url"]', { element: e => e.setAttribute("content", url.toString()) })
      .transform(res);
  },
};
