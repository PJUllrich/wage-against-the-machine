# wage-against-the-machine

A small static site that answers one question: **I earned X in 2016 — what do I need to
earn now to be even?**

It gives four answers, because they diverge sharply:

| Line | What it measures |
| --- | --- |
| **Consumer prices** | What X must become to buy the same goods and services. |
| **Average pay** | What X would be if your pay had tracked your country's average nominal wage. |
| **House prices** | What X must become to have the same house-buying power. |
| **Mortgage** | What X must become to make the same monthly payment on that same house, at today's interest rates. |

The mortgage line is usually the ugly one. Finland is the clearest example: house prices
fell 5% over the decade, but the monthly payment on the same house rose 25%, because the
typical mortgage rate went from roughly 1.2% to 3.6%.

Three pages:

- `index.html` — the calculator, the index ruler, and a chart of the annual series.
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
node scripts/build-data.mjs          # rebuild data/series.js from the public mirrors
node scripts/fetch-eurostat.mjs      # refresh data/headline.js + add Eurostat series
```

Node 18+, no dependencies, no API keys, no environment variables, no secrets.
Both scripts take `--dry-run`.

## How the data is laid out

| File | What it holds |
| --- | --- |
| `data/headline.js` | The calculator's inputs: one cumulative % change per country per line, 2016 → 2026, plus mortgage rates. Fenced by `DATA:START` / `DATA:END` markers, which `fetch-eurostat.mjs` rewrites. |
| `data/series.js` | The annual series behind the chart and `data.html`. Each carries `src`, `start`, `raw` (as published) and `values` (index, 2016 = 100). Generated — do not hand-edit. |

The two disagree on purpose, and `data.html` shows both side by side for every country.
The headline figures run to 2026 and lean on estimates for the last year or two; the
series stop where their publishers stop.

## Where the numbers come from

Everything is openly licensed, and every series names its publisher, its licence and
what this repo did to it on `sources.html`.

| Line | Source | Coverage |
| --- | --- | --- |
| Consumer prices, all 23 countries | World Bank `FP.CPI.TOTL.ZG`, annual % change, chained into an index — via the [datasets/cpi](https://github.com/datasets/cpi) mirror, ODC-PDDL-1.0 | 1960–2024, later start for EE, PL, CZ, HU, RO |
| US house prices | Case-Shiller national index via [datasets/house-prices-us](https://github.com/datasets/house-prices-us), ODC-PDDL-1.0 | 1975–2026 |
| UK house prices | Nationwide via [datasets/house-prices-uk](https://github.com/datasets/house-prices-uk), ODC-PDDL-1.0 | 1953–2025 |
| Average pay, everywhere | **Nothing yet.** No openly licensed cross-country annual wage series was reachable. | — |
| House prices, other 21 countries | **Nothing yet.** `fetch-eurostat.mjs` fills these in. | — |

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

- **Sourced:** US, Hungary, Romania, Estonia, Cyprus.
- **Estimated:** everything else.
- **Mortgage rates are estimates for every country**, including the sourced ones, so the
  mortgage row always shows `≈`. ECB MIR and the national central banks are what to
  replace them with.

Anchors for regression-checking a refresh: US CPI-U +39% (BLS); UK CPI +41.5%; EU HICP
+33.0% 2016→2025, highest Hungary +73.2%, lowest Cyprus +19.5%; Case-Shiller national
≈ +80% (the generated series says +83.5%, which is the closest independent check this
repo has); OECD real average annual wages 2016→2024.

## What the model ignores

- **Distribution.** Minimum wages rose much faster than average wages across Europe in
  this period, so low earners generally did better than these country averages imply.
- **Tax.** Wages are gross.
- **Rent.** Only purchase prices and the cost of financing them.
- **Mortgage detail.** Loan-to-value assumed unchanged, a flat 25-year term everywhere,
  no fixation periods, tax relief or fees.
- **Greece.** Eurostat has no transaction-based house price index for it.
