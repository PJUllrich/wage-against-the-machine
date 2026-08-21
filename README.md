# wage-against-the-machine

A small static site that answers one question: **I earned X in some year — what do I
need to earn now to be even?**

Pick a country, a year and an amount. Consumer prices go back to 1960, house prices to
1953 in the UK and 1970 across most of western Europe, pay to 1990, so "some year" can
be a long way back.

It gives four answers, because they diverge sharply:

| Line | What it measures |
| --- | --- |
| **Consumer prices** | What X must become to buy the same goods and services. |
| **Average pay** | What X would be if your pay had tracked your country's average nominal wage. |
| **Mortgage minimum** | What anyone must earn to get a mortgage on a typical house — 80% loan, 25 years, payment capped at 35% of gross pay, with the change since your year. UK and US only, see below. |
| **Monthly payment** | What the mortgage on that house actually costs a month, then and now — UK: £707 in 2016, £1,221 now. Where only an index exists, the change without the amount. |

The mortgage line is usually the ugly one. Finland is the clearest example: house prices
fell 5% over the decade, but the monthly payment on the same house rose 25%, because the
typical mortgage rate went from roughly 1.2% to 3.6%.

Three pages:

- `index.html` — the calculator, the index ruler, two charts (the three series indexed
  to the start of whichever range you pick, and house prices divided by average pay),
  three charts (the series indexed to the range start, house prices divided by pay, and
  how many salaries buy a house), a ranked comparison of all 23 countries on each line,
  and a card per dataset with a link to re-download it.
- `data.html` — every series year by year, as published and as an index, per country.
- `sources.html` — publisher, licence, method and caveats for every dataset.

## Build and deploy

Deploys to **Cloudflare Workers** as a static-asset Worker — no Worker script, no
bundling. `wrangler.toml` points at `dist/`, and `npm run build` is a plain copy of the
six files a browser needs. The build exists so that `CLAUDE.md`, `README.md`,
`scripts/` and `.git` are never served at the public URL.

```
npm install            # wrangler, once
npm run deploy         # build + wrangler deploy  ← the one you want
npm run dev            # build + wrangler dev, local edge preview
npm run build          # dist/ only, no deploy
npx wrangler deploy --dry-run    # validate wrangler.toml without deploying
```

First deploy asks you to log in (`npx wrangler login`) and lands on
`https://wage-against-the-machine.<your-subdomain>.workers.dev`. For a custom domain,
add a `routes` entry to `wrangler.toml`.

Nothing about the site is Cloudflare-specific — it is six static files. Any of these
work on the same `dist/`:

```
python3 -m http.server 8000 --directory dist   # local preview; file:// works too
npx netlify-cli deploy --dir=dist --prod
npx vercel deploy dist --prod
# GitHub Pages: Settings → Pages → main, / (root) — serves the repo root, no dist
```

The data is built separately, and only when you want to refresh it:

```
node scripts/build-data.mjs          # prices + US/UK housing, from the public mirrors
node scripts/import-local.mjs        # wages + euro-area mortgage rates, from sources/
node scripts/fetch-eurostat.mjs      # European housing and HICP — needs ec.europa.eu
```

All three merge into the same two files rather than overwriting them, so they can be
run in any order. Two guards worth knowing about, both of which log when they fire:
`fetch-eurostat.mjs` will not silently replace a longer series with a shorter one
(`--keep-longer` to prefer coverage outright), and it will not replace OECD average
annual wages with the labour cost index, which is a worse series (`--force-lci` to
override).

Node 18+, no dependencies, no API keys, no environment variables, no secrets.
Both scripts take `--dry-run`.

## How the data is laid out

| File | What it holds |
| --- | --- |
| `data/headline.js` | Fallback figures: one cumulative % change per country per line, 2016 → 2026, plus mortgage rates. The calculator reads the series first and only falls back to these when no series covers a line — and then only for 2016, the only year they describe. Fenced by `DATA:START` / `DATA:END` markers. |
| `data/series.js` | The annual series behind the chart and `data.html`. Each carries `src`, `start`, `raw` (as published) and `values` (index, 2016 = 100 — except rate series, where `values` are the rate itself). Generated — do not hand-edit. |
| `sources/` | Files downloaded by hand and committed, so the build reproduces without re-downloading. `sources/README.md` describes them; **`sources/DOWNLOADS.md` has every download link and the exact options to pick**, including the traps that produce a file that looks right and is not. |

The two disagree on purpose, and `data.html` shows both side by side for every country.
The headline figures run to 2026 and lean on estimates for the last year or two; the
series stop where their publishers stop. The calculator prefers the series, so its
answers end where the data does — that is what the table's *Through* column reports.

## Where the numbers come from

Everything is openly licensed, and every series names its publisher, its licence and
what this repo did to it on `sources.html`.

| Line | Source | Coverage |
| --- | --- | --- |
| Consumer prices, all 23 countries | World Bank `FP.CPI.TOTL.ZG`, annual % change, chained into an index — via the [datasets/cpi](https://github.com/datasets/cpi) mirror, ODC-PDDL-1.0 | 1960–2024, later start for EE, PL, CZ, HU, RO |
| Average pay, 22 of 23 countries | OECD average annual wages, current prices in national currency (`sources/oecd-average-annual-wages.csv`) | 1990–2025, from 1995 for PT, GR, EE, PL, CZ, HU, RO |
| House prices, 20 countries | OECD analytical house price indicators, nominal, annual (`sources/oecd-house-prices-nominal-annual.csv`) | 1970–2025 for most of western Europe, 2005–2009 start for EE, PL, CZ, HU, RO |
| US house prices | Case-Shiller national index via [datasets/house-prices-us](https://github.com/datasets/house-prices-us), ODC-PDDL-1.0 | 1975–2026 |
| UK house prices | Nationwide via [datasets/house-prices-uk](https://github.com/datasets/house-prices-uk), ODC-PDDL-1.0 | 1953–2025 |
| Mortgage rates, 13 euro-area countries | ECB MIR, cost of borrowing for house purchase (`sources/ecb-mir-euro-area-house-purchase.csv`) | 2003–2026 |
| Average pay and house prices, Cyprus | **Nothing.** Not an OECD member, absent from both datasets. | — |
| Mortgage rates, 10 non-euro countries | **Nothing.** Still hand-made estimates. | — |

Where a line has no series, the chart draws a dashed straight line from 2016 to the
headline figure and labels it as an estimate rather than a measurement, and `data.html`
says so in words.

These are mirrors rather than the publishers' own APIs, because `ec.europa.eu`,
`api.worldbank.org`, `stats.bis.org` and `fred.stlouisfed.org` are all unreachable from
the environment this was built in, while `raw.githubusercontent.com` is not. Prefer the
publisher directly if you can reach them.

**Two known data problems, both flagged in the UI rather than quietly fixed:**

- The `datasets/cpi` mirror labels its column `CPI` and its datapackage claims an index
  with 2005 = 100. The values are annual percentage changes. Verified against known
  figures (Germany 2022: 6.87%, 2024: 2.26%) before use.
- Romania's 2024 value in that mirror is −4.5%, against roughly +5.6% reported
  elsewhere. Romania's price index is marked **suspect** on the data page.

## How trustworthy are the headline figures?

Less so than the series. The `solid` flag records whether prices/wages/homes came from a
published source or were compiled by chaining annual rates; estimated countries render
with `≈`.

Provenance is tracked per line, not per country: a figure is measured when an annual
series backs it, and the table marks the rest with `≈`. Pay and house prices are now
measured for 22 of 23 countries; consumer prices are measured everywhere but remain
national CPI chained from World Bank annual rates rather than HICP. Each line carries
its own end year, shown in the table's *Through* column, because they no longer all
run to 2026.

The US keeps Case-Shiller and the UK keeps Nationwide rather than OECD's versions of
the same thing. Worth knowing how much that choice moves the answer: for 2016–2025
OECD's US series says **+90.6%** where Case-Shiller says **+83.5%**.

**Mortgage rates** are measured for the 13 euro-area countries (ECB) and estimated for
the other 10. Even the measured ones are a **euro-area average**, not a national rate,
so every euro country shares one series and the mortgage row keeps its `≈`.

Anchors for regression-checking a refresh: US CPI-U +39% (BLS); UK CPI +41.5%; EU HICP
+33.0% 2016→2025, highest Hungary +73.2%, lowest Cyprus +19.5%; Case-Shiller national
≈ +80% (the generated series says +83.5%, which is the closest independent check this
repo has); OECD real average annual wages 2016→2024.

## Why only the UK and US get the salaries-per-house numbers

Most house price sources publish an index. An index says prices rose 42%; it cannot be
divided by a salary. Two sources here publish money: Nationwide for the UK (an average
price) and FRED `MSPUS` for the US (a median). So "how many salaries buy a house" and
the mortgage-qualifying salary are real for those two and say plainly that they cannot
be computed elsewhere.

What would fix Europe: average or median sale prices per country in national currency.
No open Europe-wide dataset exists — HYPOSTAT and the Deloitte Property Index are the
published sources, both annual PDFs. A single year's average price per country is
enough, since each country's index turns one anchor into a full series.

## What the model ignores

- **Distribution.** Minimum wages rose much faster than average wages across Europe in
  this period, so low earners generally did better than these country averages imply.
- **Tax.** Wages are gross.
- **Rent.** Only purchase prices and the cost of financing them.
- **Mortgage detail.** Loan-to-value assumed unchanged, a flat 25-year term everywhere,
  no fixation periods, tax relief or fees.
- **Greece.** Eurostat has no transaction-based house price index for it, though OECD
  does, so Greek housing is now covered.
- **Cyprus.** Absent from both OECD datasets, so its pay and housing figures are the
  last remaining fabricated numbers besides the non-euro mortgage rates.
