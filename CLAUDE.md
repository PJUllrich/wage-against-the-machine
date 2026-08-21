# wage-against-the-machine — purchasing power, 2016 → 2026

## What this is

A static site (no build step for the pages, vanilla JS) that answers:
"I earned X in year Y — what do I need to earn now to be even?"

The reader picks the year, so nothing may assume 2016. `series.js` stores every series
as an index on 2016 = 100 purely as a storage convention; dividing by the value at the
chosen year rebases it. If you add a feature, rebase — never hardcode the base year.

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
- **The calculator reads `series.js` first.** `headline.js` is a fallback, used only
  where no series covers a line (Cyprus pay and housing, non-euro mortgage rates) and
  only for 2016, since that is the only year those figures describe. `lineFor()` and
  `rateFor()` in index.html encode this; a line with neither source renders "—" and
  says why, which is the correct behaviour, not a bug to paper over.
- The grey button under the salary field fills in that country's average wage **for the
  chosen year**, straight from the OECD series in money, and hides itself when there is
  none — Cyprus has no wage series, and no country has one before 1990.
- The year list comes from the prices series of the selected country, minus its final
  year. Changing country re-derives it and clamps the chosen year.
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
- The **chart** is the main feature and is sized like one: it breaks out of the 940px
  column to 1280px, and `drawChart()` picks its own viewBox from the measured element
  width — wide and short on a desktop, taller relative to its width below 640px — then
  scales the label font so text stays the same size on screen at any viewBox. It
  re-renders on resize.
- The chart is indexed to **the left edge of the visible range**, not to the salary
  year: on "since 2000" every line leaves 2000 at 100. Where one line starts later than
  the window (German pay starts in 1991), the reference moves to the first year they all
  exist so the lines stay comparable, earlier history is still drawn to the left of it,
  and the readout says which year was used and why. Don't "fix" that by clipping the
  chart to the shortest series.
- **Charts work by touch.** A press pins the readout and it stays until you tap outside
  the chart. Pinned, the readout is a panel: shaded, ink-ruled on the left, the year set
  large in the display face and every value in its own series colour, alongside a cursor
  line and a dot on each line. It was a grey mono sentence before and people missed it —
  it is the payload of the interaction, so it should look like one. Padding is identical
  in both states so pinning does not shift the page.
  `pointermove` is ignored for `pointerType === "touch"` unless pinned, because there
  is no hover to follow. `touch-action: pan-y` keeps vertical scrolling working over
  the chart while horizontal drags scrub it.
- **Share buttons** hand over `https://wagevsworld.com/ + params + #chart-id` — the
  live domain always, so a link shared from a local copy still works — through
  `navigator.share` where it exists and the clipboard where it does not. `r` carries the range so a shared chart opens on the
  range it was shared from. Clipboard write is attempted and the link is shown and
  selected either way, because `navigator.clipboard` is unavailable over `file://`.
  The share button sits inside `.ranges` for layout, so the range handler must ignore
  buttons without a `data-range` — otherwise clicking Share sets the range to
  `undefined` and the URL gains `r=undefined`.
- The mortgage arithmetic sits in a `<details>` that is **shut by default**, and its
  contents are hidden with an explicit `display:none` rather than leaning on the
  browser's rule for closed `<details>` — every element in that block carries an
  author `display`, which beats the UA rule, so it stayed on screen while the arrow
  claimed it was shut.
- **Card three is not about your salary.** It answers "what would anyone need to earn
  to get a mortgage on an average house": the payment on an 80% loan over 25 years at
  today's rate, capped at 35% of gross pay. `LTV` and `MAX_PAYMENT` are named constants
  at the top of that section — if you change them, change the card's own copy, which
  states both.
- **Three charts, one renderer.** `plotLines()` also takes `absolute: true`, which skips
  indexing entirely and plots the quantity itself with a formatter (`5.8×`). The
  salaries-per-house chart uses it; the other two are indexed. Add a fourth chart by
  calling `plotLines()` too — do not fork it.
- The second chart is house prices divided by average pay, both being index series, so
  it shows the *change* in what a house costs in pay and not a multiple of salary. The
  copy under it says so; keep that distinction if you touch the wording, because "a
  house costs 8× salary" is the number people will assume it means.
- The fourth cross-country panel, **pay minus prices**, is plain subtraction in
  percentage points, not the compounded real change — prices +35 against pay +30 is
  −5, which is what was asked for and is why the copy says "points" rather than
  "in real terms". It sorts worst first, colours by sign, and scales to the 85th
  percentile so the negative end stays legible next to Romania at +131.
- The **cross-country section** ranks all 23 countries per line. Two rules keep it
  honest: every country is measured over the *same* window (the range start to the last
  year they all have, not each country's own latest), and the bar scale stops at three
  times the median so one runaway — Romanian pay is +2206% since 2000 — cannot squash
  every other bar to a sliver. Bars past the cap fade out and the panel says how many;
  the printed figure is always the real one.
- "All data" cannot mean anything across countries, so the comparison uses 1970 for that
  range. Where nothing reaches the start year (no wage series goes back to 1970) the
  panel says so rather than rendering an empty axis.
- The **dataset cards** above the footer are generated from the sources of the series
  the selected country actually uses, so they can never drift from the data. Each needs
  `shortName` and `download` in its source record; a line with no series gets the
  greyed "No dataset" card instead.
- A line with no series is drawn as a dashed straight line to the headline figure,
  labelled as an estimate — never as a measurement. Log scale kicks in automatically
  when the plotted range spans more than about 12×.
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

## Money levels vs indices — the constraint that shapes half the UI

Almost every house price source publishes an **index**: it says prices rose 42%, not
what a house costs. Wages, by contrast, arrive as actual money (OECD average annual
wages, national currency). Anything that divides one by the other — "how many salaries
buy a house", "what salary gets a mortgage" — needs both sides in money, and that is
true for two countries: the UK and the US.

Money prices live under their own series kind, `homeprice`, separate from the `homes`
index every country has. Two countries have one: the UK (Nationwide, an average) and
the US (FRED `MSPUS`, a median — hence `levelKind` on the source, and why the copy says
"typical house" rather than promising an average). `priceSeries()` and `wageSeries()` in
index.html are the only way to reach money. Everything else must go through the index
path. Do not fake a level by anchoring an index to a guessed price: the third chart and
the third card say plainly that they cannot be drawn instead, and that is the correct
behaviour until someone supplies average or median sale prices per country.

## The two housing cards

Card three is the salary a lender would require — the payment on an 80% loan over 25
years capped at 35% of gross pay — and it is a figure about *today*, so it must not
depend on the year the reader picked. `rateFor()` therefore always returns `now` where
any rate is known and only `base` varies with the chosen year; an earlier version
withheld both and the card went blank for every year except 2016.

Card four is the payment itself, then and now — "£707 a month in 2016, £1,221 now" —
because that is the number people recognise from their own lives. It replaced a
salary-scaled figure that nobody could interpret. Where a country has only an index the
card falls back to showing the *change* rather than the amount, and says why.

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

## Getting the raw data again

`sources/DOWNLOADS.md` records every download link and the exact options to pick. It
exists because four of the six sources have a trap that yields a plausible-looking file
with the wrong contents: Eurostat's Download menu offers the structure definition
alongside the data, OECD's default wage measure is real rather than nominal, OECD's
filtered house price export silently carries the period filter, and the World Bank CPI
mirror labels percentage changes as an index. Read it before re-downloading anything.

## Deployment

Cloudflare Workers: `dist/` behind a small Worker (`src/worker.js`) that renders share
cards at `/og.png` and rewrites `og:` tags for shared links. `npm run deploy` builds and
deploys, `npx wrangler deploy --dry-run` validates without touching the account, and
`npx wrangler dev --local` runs the whole thing offline, which is how the cards were
checked.

Three things about that Worker are easy to get wrong:

- **Assets are served before the Worker runs.** Without the `run_worker_first` list in
  `wrangler.toml` a page request never reaches the Worker, and the `og:` rewrite
  silently does nothing while the cards themselves keep working — so it looks fine.
- **Satori counts whitespace between tags as a child node**, then rejects any `div` with
  more than one child and no explicit `display`. The card markup is written with no
  whitespace between elements on purpose. Prettify it and `/og.png` returns an empty
  body with a 200 and nothing in the response to say why.
- **The card carries bars, not just numbers**, scaled against the largest value on
  it, plus the three data colours as a rule across the top. `n` on each line is the
  raw number the bar length comes from; `value` is only the printed string.
- **A font must be present.** Inter is fetched at runtime to match the site, with DejaVu
  bundled as a fallback, because Satori cannot render without font bytes.

`scripts/build-site.mjs` copies the six deployable files into `dist/`. It deliberately
does not bundle or minify — the pages are meant to stay readable as shipped. Its whole
job is to keep `CLAUDE.md`, `README.md`, `scripts/` and `.git` off the public URL, so
if you add a file the browser needs, add it to the `SHIP` list or it will not deploy.

`not_found_handling = "404-page"` is deliberate: this is a set of pages, not a
single-page app, and an unknown path should 404 rather than silently render the
calculator.

Nothing is Cloudflare-specific — `dist/` is six static files and any host takes it.
No server, no environment variables, no secrets. Commands are in the README.

## Explaining the choices

The footer carries a "Why these numbers and not others" section covering national CPI
over HICP, nominal over real, average annual wages over the labour cost index, national
housing indices for the US and UK, gross pay, and the single euro-area mortgage rate.
Each entry names what the choice costs, with a figure where there is one. If you change
a data source, change that section in the same commit — an unexplained choice is the
thing this project is trying not to ship.

## Tone

The subject is people losing ground. Copy should be plain and unsentimental —
state the number, don't editorialise about it. The existing `verdict` string is
the register to match.
