# wage-against-the-machine

A single-file static web app that answers one question: **I earned X in 2016 — what do I
need to earn now to be even?**

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

## Running it

Open `index.html`. There is no build step, no dependencies, and no server. Deploy by
dropping the file on Netlify, Cloudflare Pages, GitHub Pages or Vercel.

State lives in the URL, so a specific country and salary can be shared:
`index.html?c=NL&s=50000`.

## Refreshing the data

The `DATA` object between the `/* DATA:START */` and `/* DATA:END */` markers in
`index.html` is the single source of truth. Every value is a cumulative % change,
2016 → 2026. Edit it by hand, or regenerate the price, pay and housing figures from
Eurostat:

```
node scripts/fetch-eurostat.mjs --dry-run     # fetch and print, write nothing
node scripts/fetch-eurostat.mjs               # fetch and rewrite index.html
node scripts/fetch-eurostat.mjs --only=DE,FR  # a few countries
```

Node 18+, no dependencies, no API key. The script only touches `prices`, `wages`,
`homes` and `solid`; names, currencies, locales and mortgage rates are preserved.

**The script has not yet been run against the live API.** It was developed and tested
against a stubbed Eurostat response — the container it was written in has
`ec.europa.eu` blocked by an egress proxy. The JSON-stat parsing, the unit fallbacks,
the skip rules and the file rewrite are all exercised by that stub and round-trip
correctly; the exact dataset parameters are the part to verify on the first real run.
Use `--dry-run` first.

## How trustworthy are the numbers?

Not very, yet. The `solid` flag on each country records whether the figures came from a
published source or were compiled by chaining annual rates. Estimated countries render
with `≈` in the table.

- **Sourced:** US, Hungary, Romania, Estonia, Cyprus.
- **Estimated:** everything else.
- **Mortgage rates are estimates for every country**, including the sourced ones, and
  the mortgage row always shows `≈`.

Known-solid anchors, for regression-checking a refresh:

- US CPI-U, 2016 → 2026: **+39%** (BLS).
- UK CPI, same period: **+41.5%**.
- EU HICP, 2016 → 2025: **+33.0%** (Eurostat). Highest: Hungary +73.2%, Romania +61.8%,
  Estonia +61.3%. Lowest: Cyprus +19.5%.
- US Case-Shiller national index: ~184 in late 2016 → 335.1 in May 2026, so **≈ +80%**.
- OECD real average annual wages, 2016 → 2024 (constant PPP USD): US +10.6%, Canada
  +7.3%, Germany +3.0%, UK +2.9%, France +0.5%, Japan −0.6%, Italy −4.8%.

These are good enough to show the shape of the problem. They are not good enough to
publish as fact.

## What the model ignores

- **Distribution.** Minimum wages rose much faster than average wages across Europe in
  this period, so low earners generally did better than these country averages imply.
  Noted in the UI; a median/minimum toggle would be better.
- **Tax.** Wages are gross. Tax wedges changed over the decade and are not modelled.
- **Mortgage detail.** Loan-to-value is assumed unchanged, the term is a flat 25 years
  everywhere, and fixation periods, tax relief and fees are ignored.
- **Greece.** Eurostat has no transaction-based house price index for Greece, so its
  housing figure stays an estimate and the fetch script skips that one series.
