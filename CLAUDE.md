# wage-against-the-machine — purchasing power, 2016 → 2026

## What this is

A single-file static web app (`index.html`, no build step, vanilla JS) that answers:
"I earned X in 2016 — what do I need to earn now to be even?"

It gives four different answers, because they diverge sharply:

1. **Consumer prices** — what X needs to be to buy the same goods and services.
2. **Average pay** — what X would be if the user's pay had tracked their country's
   national average nominal wage growth.
3. **Housing** — what X needs to be to have the same house-buying power.
4. **Mortgage** — what X needs to be to make the same monthly payment on that same
   house, once the change in interest rates is priced in.

Country selector drives everything. Currency and number formatting follow the
selected country's locale. Country and salary are mirrored into the URL as `?c=&s=`.

## Architecture

Three static pages, no build step, no dependencies except Google Fonts. It stopped
being one file when the data pages arrived; it has not stopped being simple.

```
index.html      calculator, index ruler, chart
data.html       every series year by year, per country
sources.html    publisher, licence, method, caveats per dataset
styles.css      shared — all three pages
data/headline.js  the calculator's inputs (hand-maintained + script-rewritten)
data/series.js    the annual series (generated, never hand-edited)
scripts/build-data.mjs      builds series.js from public mirrors
scripts/fetch-eurostat.mjs  rewrites headline.js, merges Eurostat series
```

- `data/headline.js` declares a global `const DATA`, fenced by `/* DATA:START */` and
  `/* DATA:END */` markers, and ends with `window.HEADLINE = DATA`. Those markers are
  load bearing: `scripts/fetch-eurostat.mjs` finds, evaluates and rewrites the block
  between them. Don't remove them or change the field order casually. The pages use
  the global `DATA` directly — do not redeclare it in a page script, it is the same
  global and you will get a redeclaration SyntaxError.
- Every headline value is a cumulative % change, 2016 → 2026, except `rate16`/`rate26`,
  which are mortgage rates in % per annum.
- `data/series.js` sets `window.SERIES` and is loaded with a plain `<script>` tag
  rather than `fetch()`, so every page still works over `file://`.
- `render()` recalculates on any input change. No framework, no state library.
- The **chart** under the ruler draws the annual series rebased to 2016 = 100. A line
  with no series is drawn as a dashed straight line from 2016 to the headline figure,
  labelled as an estimate — never as a measurement. Log scale kicks in automatically
  when the plotted range spans more than about 12×, which "All data" usually does.
- The signature UI element is the **index ruler**: a horizontal scale where
  2016 = 100 and four markers sit at the resulting index levels. It's the fastest way
  to see that housing ran away from pay, and that financing ran away from housing.
  Don't replace it with a generic bar chart.

Design tokens are CSS custom properties in `:root`. Palette is deep petrol ink
(`--ink`) on sage-tinted paper (`--paper`), with three fixed data colours: green for
wages, ochre for prices, plum for homes. Those three colours are semantic — keep them
consistent anywhere new charts are added. The mortgage line is deliberately *not* a
fourth colour: it is plum, drawn hollow and dashed, because it is the housing line
seen through financing rather than an independent series.

## The mortgage model

`mortFactor = (1 + homes/100) × annuity(rate26) / annuity(rate16)`, where `annuity` is
the standard monthly payment per unit borrowed over `TERM_MONTHS` (300, a 25-year
repayment mortgage). It assumes the same house and an unchanged loan-to-value ratio, so
the deposit scales with the price and drops out of the ratio. Not modelled: fixation
periods, tax relief, fees, term differences between countries.

Mortgage rates are hand-maintained estimates in **every** country, including the ones
flagged `solid: true`. That's why the mortgage row always renders with `≈` regardless
of the country's flag, and why `scripts/fetch-eurostat.mjs` never touches `rate16` or
`rate26`. ECB MIR and national central banks are the sources to firm these up against.

## Data provenance — READ THIS BEFORE PUBLISHING

The `solid: true|false` flag on each country records whether prices/wages/homes came
from a published source or were compiled from annual rates.

**Sourced (`solid: true`):** US, Hungary, Romania, Estonia, Cyprus.
**Estimated (`solid: false`):** everything else. These render with `≈` in the table.
They are indicative, compiled by chaining published annual inflation rates and
approximating wage and house price series. They are good enough to show the shape of
the problem and not good enough to publish as fact.

Known-solid anchors, for regression-checking any refresh:

- US CPI-U, 2016 → 2026: **+39%** (BLS).
- UK CPI, same period: **+41.5%**.
- EU HICP, 2016 → 2025: **+33.0%** (Eurostat). Highest: Hungary +73.2%,
  Romania +61.8%, Estonia +61.3%. Lowest: Cyprus +19.5%.
- US Case-Shiller national index: ~184 in late 2016 → 335.1 in May 2026, so
  **≈ +80%**.
- OECD real average annual wages, 2016 → 2024 (constant PPP USD): US +10.6%,
  Canada +7.3%, Germany +3.0%, UK +2.9%, France +0.5%, Japan −0.6%, Italy −4.8%.

## The two data layers, and why they disagree

`headline.js` runs to 2026 and leans on estimates. `series.js` stops where each
publisher stops — 2024 for World Bank prices, 2026 for Case-Shiller, 2025 for
Nationwide. So the chart's prices line ends below the card above it, by roughly two
years of inflation. This is expected, is explained under the chart, and is reconciled
per country on `data.html`. Do not "fix" it by forcing one to match the other.

`scripts/build-data.mjs` builds `series.js` from openly licensed mirrors on
raw.githubusercontent.com, because the publishers' own APIs (ec.europa.eu,
api.worldbank.org, stats.bis.org, fred.stlouisfed.org) are all unreachable from the
environment this was built in. Two data problems are surfaced rather than silently
corrected: the `datasets/cpi` mirror mislabels annual % changes as a CPI index (verified
against known German figures before use), and Romania's 2024 value there is −4.5%
against roughly +5.6% reported elsewhere, so Romania's series carries a `suspect` flag
that `data.html` renders.

Coverage today: consumer prices for all 23 countries (1960 onwards, later for the
post-socialist states), US house prices from 1975, UK house prices from 1953. **No wage
series at all** — nothing openly licensed and reachable covers cross-country annual
wages, which is the biggest single gap in the repo.

## Replacing the estimates

`scripts/fetch-eurostat.mjs` implements the build-time design: fetch, compute
2016 → latest cumulative changes, write the `DATA` object back into `index.html`. The
app stays a static file with zero runtime dependencies. Datasets used:

- `prc_hicp_aind` — HICP annual average index. Consumer prices.
- `prc_hpi_a` — house price index, annual, `purchase=TOTAL`. The script tries the
  2015 = 100 unit first and falls back to the 2010 and 2020 bases, because only the
  ratio latest / 2016 is ever used, so the index base is irrelevant.
- `lc_lci_r2_a` — labour cost index, for wages. This is a stand-in: OECD's "Average
  annual wages" is the better cross-country series but has no open REST API. If you
  want it, download and hand-edit those figures.

It also writes annual Eurostat series into `data/series.js`. Eurostat's series are
harmonised and current but usually start later than the World Bank chain they replace,
so replacing shortens the history: the script logs every such replacement, and
`--keep-longer` prefers coverage over currency instead.

**Status: not yet verified against the live API.** It was written in a container with
`ec.europa.eu` blocked by an egress proxy, and tested end to end against a stubbed
JSON-stat response — parsing, unit fallbacks, skip rules, `solid` recomputation and
the file rewrite all round-trip correctly. The dataset parameter names are the part
that still needs a real run to confirm. Always `--dry-run` first.

Skips, and why:

- **US** is not in Eurostat at all. Its row is hand-sourced (BLS, Case-Shiller) and the
  script leaves it alone — including its `solid: true`, which is what the `"sourced"`
  vs `"estimate"` distinction in the script's `SKIP` table exists to protect.
- **Greece** has no transaction-based house price data in Eurostat; Bank of Greece
  valuation data is used for European aggregates. Its housing figure stays an estimate
  and the country stays `solid: false`.

## Other open items

- Averages hide distribution. Minimum wages rose much faster than average wages across
  Europe in this period, so low earners generally did better than these country
  averages imply. There is a note under the verdict; a median/minimum toggle would be
  better.
- Wages are gross. Tax wedges changed over the decade and are not modelled.
- Rent is not modelled at all — only purchase prices and the cost of financing them.
- No wage series anywhere. The single biggest gap; OECD average annual wages is the
  series worth the effort of getting in by hand.
- House price series exist only for the US and the UK until someone runs the Eurostat
  script.
- `data.html` renders every year of a series into one table — 65+ rows for prices. It
  scrolls inside its own box, but a decade filter would be kinder.
- Verified in headless Chromium at 1100px and 390px, across index/data/sources: no
  label overflow, no collisions, no console errors. Not yet checked on real devices.

## Deployment

No build step. The directory is the artifact — Netlify, Cloudflare Pages, GitHub Pages
and Vercel all take it as-is with no config. No server, no environment variables, no
secrets. The only thing that is ever "built" is the data, by the two scripts, and only
when you want to refresh it. Commands are in the README.

## Tone

The subject is people losing ground. Copy should be plain and unsentimental —
state the number, don't editorialise about it. The existing `verdict` string is
the register to match.
