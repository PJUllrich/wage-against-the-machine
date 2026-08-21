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
scripts/import-local.mjs    wages, minimum wages, rents, house prices in
                            money and euro-area rates, from sources/
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
  (`pricesTo`, `wagesTo`, `homesTo`) because they no longer all run to 2026, and every
  surface that shows one names its year. `rateSrc` is `"ecb-mir"` or `"estimate"`.
- Provenance is per line, not per country: the UI marks a figure `≈` when no annual
  series backs it (`measured(kind)` in `render()`), which is why the coarse `solid`
  flag is now only used by the fetch script's own logging.
- `data/series.js` sets `window.SERIES` and is loaded with a plain `<script>` tag
  rather than `fetch()`, so every page still works over `file://`. Seven series kinds
  live in it: `prices`, `wages`, `minwage`, `homes`, `homeprice`, `rents` and `rate`.
  Adding a kind means adding it in four places — the importer, `KINDS` in data.html,
  `KIND_LABEL` in `drawDatasets()`, and wherever it is drawn — or it will exist in the
  bundle and be invisible on the site, which is how `rents` went unlisted on the data
  page for as long as it did.
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
- **There are no share buttons.** There were, per chart, wrapping `navigator.share`
  and the clipboard; they were removed on request. What they relied on is still here
  and still matters: the page is entirely described by its URL (`?c=&y=&s=&r=`), so
  copying the address bar shares exactly what the reader is looking at, and the Worker
  still renders a matching `/og.png` and rewrites the `og:` tags for any link carrying
  `?c=`. Don't strip the URL state or the card machinery on the grounds that the
  buttons are gone. The range handler still ignores buttons without a `data-range`,
  which is what stopped the old Share button — it sat inside `.ranges` for layout —
  from setting the range to `undefined`.
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
- In the pay-minus-prices panel the countries where pay fell behind are marked as a
  block — warm tint, ochre figures, a rule under the last of them where the sign turns
  — and counted in the caption. They are the reason the panel exists, so they should
  not have to be found by scanning for minus signs. Values under one point print a
  decimal there, so a country inside that block never reads as a flat 0%.
- The fourth cross-country panel, **"Did pay keep up?"**, is plain subtraction in
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
- "All data" cannot mean one year across countries, so on that range **each panel picks
  its own start**, via `widestSharedStart()`: the earliest year where at least half the
  countries holding that series have a number. It lands on 1960 for consumer prices,
  1970 for house prices and 1990 for pay and for pay-minus-prices. Holding all four to
  a single 1970 emptied both pay panels outright, because OECD wages do not exist before
  1990 — the panels really do have different histories, and pretending otherwise costs
  the two most interesting ones. Each panel prints its own span in its heading and the
  caption says why they differ.
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
index every country has. Fifteen countries have one, in three tiers of trust:

- **Measured, long.** The UK (Nationwide, an average, from 1953) and the US (FRED
  `MSPUS`, a median — hence `levelKind` on the source, and why the copy says "typical
  house" rather than promising an average).
- **Measured, short.** Eurostat house sales, value ÷ number of transactions, which
  mostly begins somewhere between 2009 and 2017.
- **Anchored.** One published Deloitte price per m² moved by the house price index.
  These carry `derived: true` and `anchorNote()` says so on every surface that shows
  them. They are indicative, not measured, and must never be presented otherwise.

The remaining eight countries have no money price at all, and the third chart and the
third card say plainly that they cannot be drawn. That is the correct behaviour: do not
fake a level by anchoring an index to a *guessed* price.

**`priceByYear(iso)` is the single source of house prices in money.** It returns
`{ map, firstMeasured }` — the published price for every year the source covers, and
for the years before that the earliest published price carried back by the country's
own house price index. Without it the Dutch charts stopped in 2015 while the Dutch
index runs from 1970, throwing away the interesting half. `priceAt(iso, year)` wraps it
and flags `inferred` for a carried-back year.

Carried-back years must stay visually distinct. `plotLines()` takes `dashBefore`, which
splits the path so the inferred head draws dashed and the measured tail solid, and both
charts that use it explain the dashed stretch in their note. If you add another surface
for money prices, read `priceByYear()` and keep the distinction; a solid line over a
carried-back stretch claims measurement that does not exist.

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

**One basis, used everywhere.** `mortBasis` in `render()` is the only place the mortgage
change is computed, and both the card and the ruler marker read it. It
prefers the price in money and falls back to the house price index. That is not
cosmetic: the ruler used to compute its own figure from the index while the card used
transaction prices, so the Netherlands showed 240 on the ruler against +128% on the
card — same rates, two different house price sources, twelve points apart. If you add
another surface for this number, read `mortBasis`; do not recompute it.

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
**Estimated (`solid: false`):** everything else. These render with `≈` wherever they appear.
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
housing indices for the US and UK, gross pay, the minimum wage in national currency, and
the single euro-area mortgage rate.
Each entry names what the choice costs, with a figure where there is one. If you change
a data source, change that section in the same commit — an unexplained choice is the
thing this project is trying not to ship.

## The six analyses beyond the calculator

Each one exists because the data supports it, and each says so when it cannot be drawn:

- **Real pay peak** (the line under the verdict). Wages ÷ prices, every year, and the
  highest it ever got. Britain peaked in 2007 and is still 5.4% below it; Greece peaked
  in 2009 and is 32.5% below. Nine countries are at their peak now and get a different
  sentence.
- **A house, measured in pay** and **how many salaries buy a house** — the ratio, and
  the multiple where prices exist in money. The multiple runs as far back as the house
  price index reaches, not just as far as the money series: the Netherlands goes 2.8
  salaries in 1990 to 7.9 in 2025, with everything before 2015 dashed because it is
  carried back rather than published.
- **Buying against renting.** House prices against the rent index, both rebased to the
  window. Needs `rents`, which 22 countries have.
- **What the mortgage takes from a salary.** Payment ÷ average wage, per year, which
  needs a price in money *and* a rate for every year — so it is euro-area countries
  with a price series, and it says so for the rest. The Netherlands runs 34% in 2003 to
  37% in 2025, against a lender ceiling near 35%; the early years are dashed for the
  same reason as the multiple, and start where the rate series does, not where the
  price does.
- **The minimum wage against average pay.** Eurostat `earn_mw_cur` in national
  currency, annualised, beside the OECD average. The share is the point: the US federal
  minimum is frozen at $15,084 and has fallen from 29% of average pay in 1999 to 17%,
  while Hungary's floor climbed from 25% to 44%. Sixteen countries have a statutory
  minimum; the other seven set pay by collective agreement and get a sentence saying so
  rather than a zero.
- **Every decade.** A grid of calendar decades per line, heaviest whole decade marked,
  with the worst rolling ten-year window named underneath. Only a whole decade can take
  the mark — a part-decade covers fewer years, so its growth is not comparable, and
  Case-Shiller's five years of the 1970s was otherwise outranking a full 1980s. This is
  the feature that uses the pre-1990 history for something other than chart shape.

## Design detector

The project is checked with [impeccable](https://github.com/pbakaus/impeccable):

    npx impeccable detect index.html data.html sources.html styles.css

It found 95 things on the first run and now reports none. Two of those fixes are worth
not undoing by accident:

- **Functional text has an 11px floor and the muted grey is `#5D6861`.** The old
  `#66716A` was 4.4:1 on paper and 4.0:1 on the card surface — under AA. Ochre gained a
  second token, `--prices-ink` (`#965700`, 4.9:1), for text; `--prices` stays as-is for
  bars, lines and rules, where 3:1 is the bar. Anything ochre and small must use the ink
  variant, which is why chart end labels, ruler labels and the pinned readout carry an
  `ink` alongside `col`.
- **Long labels are 12px sentence case, not tracked caps.** Setting
  "Minimum salary for a mortgage on a typical house" in uppercase tripped the all-caps
  rule; dropping the caps alone then tripped tiny-text and wide-tracking, because the
  detector reclassifies a sentence-case string as body text. Twelve px with normal
  tracking clears all three, and reads better than any of them.

Four rules are ignored deliberately in `.impeccable/config.json`, each with a reason
recorded under `detector.ignoreRuleReasons`, plus Inter as a value ignore. Read those
before assuming a clean run means nobody looked.

## Tone

The subject is people losing ground. Copy should be plain and unsentimental —
state the number, don't editorialise about it. The existing `verdict` string is
the register to match.
