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
selected country's locale. Country, comparison country and salary are mirrored into the
URL as `?c=&c2=&s=`.

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
scripts/lib/xlsx.mjs        a small dependency-free xlsx reader, for the two
                            Australian files the ABS and RBA publish as spreadsheets
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
  surface that shows one names its year. `rateSrc` is the key of the source that
  supplied the rate — `"ecb-mir"` for the euro area, `"rba-f5-housing"` for Australia —
  or `"estimate"` for the other ten. Read it as a key and look the source up; the pages
  used to test it against the string `"ecb-mir"` and would have called Australia an
  estimate.
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
- **A second country can be compared against the first**, chosen in the `Compare with`
  select and carried in the URL as `?c2=`. `cmpIso()` returns it or `""`. It is drawn
  everywhere: dotted on all six charts, hollow on the ruler, a second figure under each
  answer, and a marked row in the country-comparison bars. Colour keeps meaning the
  *series*; the dash pattern means the *country* — round dots (`.line.cmp`), which have
  to stay distinguishable from `.est`'s longer dashes, because `est` means "estimated"
  and can apply to either country.

  **Nothing is ever converted between currencies.** There is no exchange rate in this
  repository and inventing one would be the least defensible number on the site. That
  single rule decides every part of the feature:
  - Index, ratio and share charts take a second country directly. Five of the six do.
  - The minimum wage chart is the one plotted in money, so with a comparison on it
    switches to plotting the **share of average pay** — the quantity its own heading
    names. `asShare` in `drawMinWage()`. In that mode `lines[0]` is a percentage and
    must not go through `money()`.
  - The answer cards do not translate the reader's salary. They take the same amount
    and grow it at the other country's rates, and the sentence says "at Germany's
    rates" so a euro-country figure printed in dollars cannot read as a conversion.
    Housing and the mortgage do not even do that — the figures above them are a
    lender's requirement and a payment in local money — so those two rows carry only
    ratios: the price rise, the salaries-per-house multiple, the payment change, the
    two rates.
  - The select is `id="compare-with"`, **not** `id="compare"`: that id already belongs
    to the container `drawCompare()` writes the country panels into, and two elements
    answering to one id meant `getElementById` returned the select and `drawCompare()`
    emptied it.
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
- The share card's legend **wraps**, and its swatches are drawn from the DOM legend's
  own classes. Both matter once a second country doubles the entries: six ran off the
  card's right edge mid-word, and a canvas cannot see the stylesheet, so `est` dashes
  and `cmp` dots have to be re-declared in `setLineDash`.
- End labels are **nudged apart** when two lines finish within about a line-height of
  each other. Australian pay at 132 printed straight through prices at 131.
- **Share buttons hand over a PNG of the chart on screen**, not a link to it.
  `chartCard()` clones the live `<svg>`, drops the hover furniture, rasterises it
  through an `<img>` and draws it into a 1200-wide canvas with a heading, the legend
  and the domain. Three things about that clone are load bearing: a serialized SVG is
  its own document, so the stylesheet does not follow it, the custom properties every
  stroke is written in do not resolve, and **no external resource loads at all** —
  Chrome renders an svg-in-`<img>` in a static, no-network mode. Tokens and rules
  therefore travel inline in `CARD_CSS`, and the chart's type falls back to a system
  monospace. The card chrome is drawn in canvas 2D, which *does* use the document's
  fonts, so the heading is set in the real display face.
- The card asks the clone for a fixed `CARD_LABEL_PX` type size rather than reusing
  the live `font-size`. The chart scales its type against the element it sits in, so a
  phone's 660-unit viewBox carries type meant to be read at 358 CSS px while a desktop's
  1280 units carry type meant for 1150; neither is right on a 1200px card.
- **Then the viewBox is refit to what the chart actually occupies.** The live margins
  were measured for the live type, so card-sized type runs off both ends of them —
  "€87k" past the right edge, "5.5×" past the left. Rather than guess at new margins,
  the clone is dropped off-screen, `getBBox()` measures the union of everything in it,
  and that becomes the viewBox. It grows the box on a desktop and shrinks it on a
  phone, where the margins were oversized for type the card no longer uses. The aspect
  ratio comes back with the markup, because trimming changes it and the card height
  follows from it.
- Delivery, in order: the phone's share sheet with the file attached, the clipboard as
  an image, then a download. The download anchor has to be **in the document** — a
  detached one takes the click and does nothing, which reported a saved image that
  never arrived. The link is shown alongside whatever happens.
- The cross-country panel is HTML bars, not an SVG, so it has no card. Its button says
  "Share link" and copies the URL, which is the honest version of that.
- `CARD_TITLE` names each chart for a card. The page's own headings lean on their
  surroundings — "How each line got there" means nothing on its own — and a share image
  has no surroundings.
- Everything above rests on the page being **entirely described by its URL**
  (`?c=&y=&s=&r=`), which is also what lets the Worker render a matching `/og.png` and
  rewrite the `og:` tags for any link carrying `?c=`. The range handler ignores buttons
  without a `data-range`, because the share button sits inside `.ranges` for layout and
  would otherwise set the range to `undefined`.
- The answer sentence's own class is `.answer-stem`, **not `.stem`**. The ruler builds
  every marker from a `<div class="stem">` that is always empty, so a
  `.stem:empty{display:none}` written for the sentence took every vertical line off the
  ruler and left four dots floating over the axis. Class names in this file are shared
  across the whole page; there is no scoping.
- **The answers are one sentence, finished three ways.** A stem — "Your €46,516 from
  2016 would have to be" — then three lines that complete it, then a trailing line for
  the mortgage. Four figures under four noun labels never said what they had in common,
  and readers took all four for the first one's question. Each line carries **its own
  end year in the clause**, because the three do not share one: prices stop where the
  World Bank stops, pay where OECD does. It used to be the last two words of a caption
  under a 32px figure, and the captions now carry only the change so the year is not
  said twice, and the two halves are **one paragraph** — the fragment that finishes the
  stem, a full stop, then what moved. Two elements at two sizes read as a figure with a
  caption rather than as a line of prose.
- **The third line does not move with the box.** It is the salary a lender requires,
  not a rescaling of the reader's pay, so it is the same figure for everyone. The
  sentence stays true either way — a salary "would have to be" that much to afford the
  house — and the fold says outright that it is the same figure whatever you earned.
  Its caption carries the house price move instead, which is the fact that actually
  drives the figure.
- The mortgage is a payment rather than a salary, so it trails the list instead of
  joining it, with its figures inline in the sentence. Where there is no house price in
  money there is no house on the line above to say "on it" about, and the sentence
  names what it is talking about itself.
- **Three of the four cards fold their small print.** `definition(html)` wraps the pay
  and mortgage-qualifying notes in the same `<details class="calc">` control the
  mortgage arithmetic uses, shut by default, so the four figures are what you see
  first. What does *not* fold is the explanation of a missing number — Cyprus's "the
  house price source publishes an index, not prices in EUR" stays open, because that is
  the reason there is no figure rather than the definition of one, and folding it would
  leave a bare em dash with no account of itself.
- Card four's fold holds both halves: what moved the payment, then the arithmetic
  that produced it. It sits in a `<details>` that is **shut by default**, and its
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
- The **cross-country section** ranks all 24 countries per line. Two rules keep it
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

## The average is not the average people know

Two questions come back about "If your pay tracked the national average", and both
have the same root: **OECD's average annual wage is per full-time equivalent
employee.** It divides the national wage bill by the number of employees, then scales
by full-time hours over average hours. In a country where half the workforce is
part-time — the Netherlands most of all — that scaling puts the figure well above any
payslip: OECD publishes €61,492 for the Netherlands in 2025, where a Dutch reader
would name something in the forties. The figure is right; it is measuring something
other than what the phrase suggests, which is why the card now says so next to the
number rather than leaving it to the footer.

The card also states the year, because the wage series ends in 2025 while the headline
figures run to 2026 and readers reasonably assume the number in front of them is the
latest one.

**Enter the base-year average and card two must return the published average for the
last year, to the euro.** That identity is the quickest check that nothing in the chain
is off: `avg(base) × factor` where `factor = avg(last)/avg(base)`. It failed by two
euros until `levelAt()` existed — `values` is an index rounded to two decimals, which
is plenty for drawing a line and not enough for an amount of money. Where a series
carries the level itself (`rawIsLevel`), every ratio now comes from the level. A
regression over every country and every base year finds zero mismatches.

## Comparing two lines means comparing the same years

`gap(line)` in `render()` measures pay against another line **over the years they both
cover**, and the verdict names that window. Each series ends where its publisher
stopped — pay in 2025, consumer prices in 2024 — so dividing one full-length factor by
the other compares a nine-year change against an eight-year one. That is not a rounding
difference: for the UK it printed "average pay outpaced consumer prices by 4.1%" in the
verdict while the cross-country panel, which had been forcing a shared window all along,
printed −0.1% for the same country on the same page. Opposite signs on the site's
central question, from nothing but a mismatched endpoint.

Where one side is a headline estimate with no series behind it there is nothing to
align, so the figure keeps its own ends and the copy drops the comparison rather than
making one across mismatched years.

**The same trap in miniature: a gap is only as honest as the numbers printed beside
it.** The pay line quoted its own full rise (32% to 2025) and then the shared-window
gap (−2.5%, over 2016–2024) in the same breath, directly under "Consumer prices rose
30%". Three true numbers, arranged so the subtraction a reader does by eye comes out
with the opposite sign. It now prints both rises over the year prices stop — "pay rose
27% against their 30%" — so the comparison on the page is the comparison being made.

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

## Australia, and what a non-European country is missing

Australia was added because three of the four committed source files already had it:
OECD wages (1990–2025, AUD), OECD house prices (1970–2025) and OECD rents (1973–2024),
with World Bank consumer prices fetched like everyone else's. Adding a country is
`ISO3` in both build scripts, a row in `data/headline.js`, and a rerun — the scripts
merge, so nothing else moves.

It arrived with three gaps — no house price in dollars, no mortgage rate, no minimum
wage — every one of them the reach of a European or American source rather than anything
about Australia. All three are now closed: ABS 6432.0, RBA F5 and OECD `MW_CURP`. It
draws every chart on the site.

One piece of that survives as a rule. **`NO_STATUTORY_MINIMUM` in index.html names the
seven collective-bargaining countries explicitly** rather than inferring "no minimum
wage" from "no series". Australia has one of the highest statutory minima in the world,
and the copy written for Italy and the Nordics would have been flatly wrong on it. A
country absent from the set gets "not covered", which is a statement about the source.
Keep that distinction if you add a country.

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
raw.githubusercontent.com plus the files committed in `sources/`, because the
publishers' own APIs (ec.europa.eu, api.worldbank.org, sdmx.oecd.org,
fred.stlouisfed.org) are all unreachable from the environment this was built in.

**Consumer prices used to come from the `datasets/cpi` mirror and no longer do.** That
mirror stopped at 2024 and carried −4.5% for Romania in 2024, against the +5.7% the
World Bank itself publishes; Romania's series wore a `suspect` flag for it. The bulk
download from the World Bank, committed as
`sources/worldbank-FP.CPI.TOTL.ZG-annual-percent.csv`, fixed both and added 2025. The
values are still annual percentage changes rather than an index, verified against known
German figures before use.

That file is the **wide** layout — four label columns, then one per year — and **every
line ends with a trailing comma**. Left in, the last column parses as `2025",` rather
than `2025` and the newest year vanishes without an error, which is the only year
anybody re-downloads the file for.

Coverage today: consumer prices for all 24 countries (1960 onwards, to 2025 for 23 of
them and 2024 for the US), pay for 23 of 24
(OECD, 1990 onwards), house prices for 23 of 24 (OECD nominal, 1970 onwards for most of
western Europe; Case-Shiller from 1975 for the US and Nationwide from 1953 for the UK),
euro-area mortgage rates from 2003 and an Australian one from 2004, minimum wages for the
17 countries that have a statutory one. **Cyprus is the only country with no series at
all beyond prices and a minimum wage** — it is not an OECD member and appears in neither
wage nor house price dataset.

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

### Two minimum wage publishers, and why OECD wins

`import-local.mjs` reads Eurostat first and lets OECD overwrite it. That order is
deliberate and the reason is not data quality — for eleven of the sixteen countries both
cover, the two agree to the rounding. It is that the minimum wage exists on this site to
be **charted against the OECD average wage**. A Eurostat minimum over an OECD average is
two annualising conventions in one ratio, and for the Netherlands that is worth 8.4%.

Where they differ (NL 8.4%, IE 2.5%, GR 1.5%, BE 0.8% for 2025) it is because the
country sets an hourly or monthly floor and turning it into a year needs an assumption
about normal weekly hours or months paid. Neither is wrong; they are different
assumptions. The importer prints both figures side by side on every run so a future
divergence surfaces, and `drawMinWage()` names the publisher under the chart because the
reader should not have to visit the sources page to learn which convention drew the line.

**Eurostat is not dead code.** It supplies Cyprus, which is not an OECD member, and it is
the cross-check. Two sentences in `drawMinWage()` are Eurostat-specific and test
`/eurostat/.test(mw.src)` rather than assuming: the "twelve months of it" clause, which
is an annualising step only Eurostat needs, and the note about the UK series stopping at
Brexit, which OECD does not.

### Australia's two spreadsheets

The ABS and RBA publish only xlsx, so `scripts/lib/xlsx.mjs` reads them: a zip parse, an
inflate and a regex over the sheet XML. It is deliberately small — no formulas, no
styles beyond telling a date cell from a number — and it exists so the pristine
downloads can stay in `sources/` rather than being hand-converted into CSVs that would
drift from them.

**Choose the column by its Series ID, never by matching the heading.** The first cut of
the ABS extraction looked for a heading containing "Mean price of residential dwellings"
and "Australia" and got **South Australia**, whose heading contains both. It looked
entirely plausible — a mean dwelling price, quarterly, rising the way you would expect —
and was wrong by a third. `ABS_MEAN_PRICE_AU` and `RBA_DISCOUNTED_VARIABLE` name the
identifiers, and `agencySeries()` matches on the "Series ID" row.

Two things about the Australian numbers differ from every other country's:

- **The house price is a stock valuation, not a transaction price.** ABS 6432.0 divides
  the total value of the residential dwelling stock by the number of dwellings, so it is
  what the average home is *worth*, not what the average buyer *paid*. Nationwide's UK
  figure and MSPUS are transaction prices. That is why sources carry `levelNoun` and
  `levelNote` — the calculator says "average dwelling" rather than "average house" and
  prints the distinction in the housing card's definition. It also begins only in the
  September quarter of 2011, so 2012 is the first whole year and everything earlier is
  carried back by the OECD index and drawn dashed.
- **The mortgage rate is an indicator rate.** RBA F5 `FILRHLBVD` is the discounted
  variable rate the banks advertise. F6 measures what borrowers are actually charged and
  runs about 0.6 points lower, but starts in 2019 and cannot reach 2016. The importer
  prints the F6 cross-check on every run so the gap stays visible.

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
  export would put the European countries on a harmonised basis, at the cost of the US
  and Australia, which it does not cover.
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

## One lookup table per data kind, or none

Two defects shipped from the same shape: a lookup table that enumerated three kinds
while the bundle carried seven. `data.html` printed "−NaN%" and "through undefined" on
minimum wages, prices in money and rents, because `DATA[iso][kind]` has a headline
fallback for prices, pay and homes only and `Number(undefined)` walks straight into
`pct()`. `sources.html` printed "United Kingdom — undefined" from a `KIND_NAME` map with
three of seven entries. Both are guarded now, but the lesson is the one already in the
architecture note: adding a series kind means touching four places, and a missing entry
does not throw — it renders.

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
- **The minimum wage against average pay.** OECD `MW_CURP` in national currency beside
  the OECD average wage — same publisher on both lines, on purpose. The share is the
  point: the US **federal** minimum is frozen at $15,080 and has fallen to 17% of
  average pay, while Australia's floor climbed to 46%. Seventeen countries have a
  statutory minimum; the other seven set pay by collective agreement and get a sentence
  saying so rather than a zero. Cyprus is the one country still drawn from Eurostat.
- **Every decade.** A grid of calendar decades per line, heaviest whole decade marked,
  with the worst rolling ten-year window named underneath. Only a whole decade can take
  the mark — a part-decade covers fewer years, so its growth is not comparable, and
  Case-Shiller's five years of the 1970s was otherwise outranking a full 1980s. This is
  the feature that uses the pre-1990 history for something other than chart shape.

## Accessibility, and the three things that keep breaking

An audit and a design critique ran over this in one pass; what they found was almost
all in the interactive layer, which had been built for a pointer and never revisited.

- **The charts are keyboard-operable.** `plotLines()` splits `paintYear(year)` from
  `showYear(clientX)` so arrows, Home/End and Escape drive the same readout the
  pointer does; Shift steps five years. Without it the only thing a keyboard user got
  from a chart was the summary in its `aria-label`. `byKey` decides whether the hint
  reads "escape to clear" or "click away", and a hover that has not been pinned gets
  no hint at all — it used to say "click away to clear" before any click happened.
- **One live region, over the shortfall and the verdict.** Those two lines are the
  spoken version of everything above them. Two regions would announce twice; the
  answer cards are deliberately not live, because four currency figures read aloud on
  every keystroke is worse than silence.
- **Every colour on a tinted ground needs checking again.** `--prices-ink` was
  `#965700`, picked to clear AA *on paper* at 4.9:1. On the 11% ochre wash behind a
  lagging row it was 4.40, and on the 22% wash behind the selected country 3.92. It is
  now `#7A4400`: 6.8 on paper, 6.1 and 5.4 on the washes. Similarly `opacity: .75` on
  the ruler sublabels took three passing colours to 3.1–3.7. There is no opacity on
  functional text anywhere now; weight carries the hierarchy instead.

Also here and worth not undoing: a skip link on all three pages, a `<main>` landmark,
distinct `aria-label`s on the seven share buttons (they were seven identical "Share
image" announcements), and a 44px minimum target under `@media (pointer: coarse)` only,
so the desktop keeps its density.

The fold summaries are the exception to how that target is built. `min-height: 44px`
on one line of 11px type put 28px of dead space inside every card, which on a phone
is most of the card. They keep a 16px box and grow the hit area with a
`summary::after` inset past the text instead — 44px tall, verified by hit-testing at
±18px. It reaches further down while the fold is shut than while it is open, so the
first line of an open definition stays tappable text rather than a second close
button.

## The ruler's label geometry

Stems are 52px apart and the label sits 12px above its own dot. That gap is not
decorative: a label is a figure over a tracked sublabel, about 31px, and the dot above
it is another 5px deep, so anything under about 50px puts one marker's label under the
next one's dot as soon as two markers are close enough horizontally to share space.
Italy stacks pay at 117 on homes at 116 and showed exactly that at 34px.

The axis position is **one number**, `AXIS` in index.html, pushed to the stylesheet as
`--axis` on the `.ruler` element. It used to be written in both places — 190 in the JS
and a literal `top:190px` on `.axis`, `.tick` and `.base` — so raising the stagger moved
the stems and left the axis behind, and every stem hung 48px below the line it was
supposed to stand on. Nothing in the CSS may hardcode it; the height and the base
marker are `calc()`ed off it too.

Crowded labels also **alternate** which side of the stem they hang on. The old rule
flipped any marker with a close neighbour to its right, so a run of three close markers
all hung left and piled up. A marker near the right edge always hangs left whatever its
neighbour did, or it runs off the axis.

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
