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
sources/          files downloaded by hand, committed for reproducibility
scripts/lib/store.mjs       reads/writes both data files — the only place that
                            knows their format; every script goes through it
scripts/build-data.mjs      prices + US/UK housing, from public mirrors
scripts/import-local.mjs    wages + euro-area rates, from sources/
scripts/fetch-eurostat.mjs  European housing and HICP, needs ec.europa.eu
```

All three data scripts **merge** into the same two files rather than replacing them,
so they can be run in any order. That is load bearing: an early version of
`build-data.mjs` rebuilt the whole bundle and would have wiped the wages and rates
the other scripts contribute. If you add a script, merge — never write a fresh
bundle.

- `data/headline.js` declares a global `const DATA`, fenced by `/* DATA:START */` and
  `/* DATA:END */` markers, and ends with `window.HEADLINE = DATA`. Those markers are
  load bearing: `scripts/fetch-eurostat.mjs` finds, evaluates and rewrites the block
  between them. Don't remove them or change the field order casually. The pages use
  the global `DATA` directly — do not redeclare it in a page script, it is the same
  global and you will get a redeclaration SyntaxError.
- Every headline value is a cumulative % change since 2016, except `rate16`/`rate26`,
  which are mortgage rates in % per annum. Each line carries its own end year
  (`pricesTo`, `wagesTo`, `homesTo`) because they no longer all run to 2026 — the
  table's *Through* column renders them. `rateSrc` is `"ecb-mir"` or `"estimate"`.
- Provenance is per line, not per country: the UI marks a figure `≈` when no annual
  series backs it (`measured(kind)` in `render()`), which is why the coarse `solid`
  flag is now only used by the fetch script's own logging.
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

Rates for the 13 euro-area countries come from ECB MIR (`scripts/import-local.mjs`);
the other 10 are still hand-maintained estimates. Even the ECB figure is a **euro-area
aggregate**, so every euro country shares one rate and cross-country differences in the
mortgage line are absent rather than measured. That is why the mortgage row still
renders `≈` everywhere, and why the copy says "euro area" on the card. National central
banks are what would fix this properly. `scripts/fetch-eurostat.mjs` never touches
`rate16` or `rate26`.

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

Coverage today: consumer prices for all 23 countries (1960 onwards), pay for 22 of 23
(OECD, 1990 onwards), house prices for 22 of 23 (OECD nominal, 1970 onwards for most of
western Europe; Case-Shiller from 1975 for the US and Nationwide from 1953 for the UK),
euro-area mortgage rates from 2003. **Cyprus is the only country with no series at all
beyond prices** — it is not an OECD member and appears in neither dataset.

The US and UK keep their national housing indices rather than OECD's. `NATIONAL_HOUSING`
in `import-local.mjs` is what enforces that; the divergence is real and disclosed
(OECD's US series says +90.6% for 2016–2025 where Case-Shiller says +83.5%).

Wages are OECD average annual wages at **current prices in national currency**. The
same OECD file also carries constant-price and USD-PPP rows; using those against the
consumer prices line would count inflation twice. `scripts/import-local.mjs` filters on
`PRICE_BASE = V` for exactly this reason — don't loosen it.

House prices are the OECD **nominal** index (`MEASURE = HPI`), for the same reason. The
same dataset publishes `RHP` (real house prices), `HPI_YDH` (price to income) and
`HPI_RPI` (price to rent); each is already divided by something, and any of them
charted against the prices line would deflate twice. The committed source file is
filtered to `MEASURE = HPI` and `FREQ = A` because the full export is 16.5 MB.

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
- Cyprus has no wage or house price series and no prospect of one from OECD. Its pay
  and housing figures are the last fabricated numbers on the site apart from non-euro
  mortgage rates.
- Non-euro mortgage rates (GB, US, SE, DK, NO, CH, PL, CZ, HU, RO) are still invented
  numbers. They are the least defensible input on the site.
- Prices are national CPI from the World Bank, not HICP. A real Eurostat `prc_hicp_aind`
  export would improve them and fix the Romania defect.
- `data.html` renders every year of a series into one table — 65+ rows for prices. It
  scrolls inside its own box, but a decade filter would be kinder.
- Verified in headless Chromium at 1100px and 390px, across index/data/sources: no
  label overflow, no collisions, no console errors. Not yet checked on real devices.

## Deployment

Cloudflare Workers, as a static-asset Worker: `wrangler.toml` has an `[assets]` block
and no `main`, because there is no Worker script to run. `npm run deploy` builds and
deploys; `npx wrangler deploy --dry-run` validates the config without touching the
account.

`scripts/build-site.mjs` copies the six deployable files into `dist/`. It deliberately
does not bundle or minify — the pages are meant to stay readable as shipped. Its whole
job is to keep `CLAUDE.md`, `README.md`, `scripts/` and `.git` off the public URL, so
if you add a file the browser needs, add it to the `SHIP` list or it will not deploy.

`not_found_handling = "404-page"` is deliberate: this is a set of pages, not a
single-page app, and an unknown path should 404 rather than silently render the
calculator.

Nothing is Cloudflare-specific — `dist/` is six static files and any host takes it.
No server, no environment variables, no secrets. Commands are in the README.

## Tone

The subject is people losing ground. Copy should be plain and unsentimental —
state the number, don't editorialise about it. The existing `verdict` string is
the register to match.
