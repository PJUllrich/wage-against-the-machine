# Where to download each file again

Every file in this folder, with the exact link and the exact options to pick.
The gotchas are recorded because each one cost a round trip the first time.

Retrieved 2026-08-21 unless noted.

---

## 1. Average annual wages — OECD

**Direct link (full dataset, the one that worked):**

```
https://sdmx.oecd.org/public/rest/data/OECD.ELS.SAE,DSD_EARNINGS@AV_AN_WAGE,1.0/all?format=csvfilewithlabels
```

Portal route: [data-explorer.oecd.org](https://data-explorer.oecd.org) → search
*Average annual wages* → Download → **full/unfiltered dataset**, CSV.

Saves to `oecd-average-annual-wages.csv`. Used rows: `PRICE_BASE = V` (current
prices), in each country's own currency.

> **Pick current prices, not constant.** The default view is
> *US dollars, PPP converted, constant prices* — a real-terms series. Comparing
> that against the consumer prices line counts inflation twice. The full export
> contains every measure, so downloading everything and filtering afterwards
> avoids the problem entirely.

---

## 2. House prices — OECD

**Direct link (full dataset):**

```
https://sdmx.oecd.org/public/rest/data/OECD.ECO.MPD,DSD_AN_HOUSE_PRICES@DF_HOUSE_PRICES,1.0/all?format=csvfilewithlabels
```

Portal route: [data-explorer.oecd.org](https://data-explorer.oecd.org) → search
*Analytical house price indicators* → Download → **full/unfiltered dataset**, CSV.

16.5 MB. `scripts/import-local.mjs` reads the filtered subset committed here as
`oecd-house-prices-nominal-annual.csv` — rows where `MEASURE = HPI` and
`FREQ = A`, nothing altered.

> **Take `HPI`, nominal.** The dataset also publishes `RHP` (real house prices),
> `HPI_YDH` (price to income) and `HPI_RPI` (price to rent). All three are
> already divided by something and would deflate twice against this site's
> prices line.
>
> **Download the full dataset, not your current view.** A filtered export
> carries the period filter with it: the first attempt came back as
> `…1.0.Q.RHP..csv` covering only 2021-Q3 to 2026-Q2, with no 2016 to rebase on.
> The tell is in the filename — `all` means everything, `.Q.RHP.` means filtered.

---

## 3. Mortgage rates, euro area — ECB

**Portal:** [data.ecb.europa.eu/data/datasets/MIR](https://data.ecb.europa.eu/data/datasets/MIR)

Series: `MIR.M.U2.B.A2C.AM.R.A.2250.EUR.N` — cost of borrowing for households
for house purchase, euro area, monthly. Saves to
`ecb-mir-euro-area-house-purchase.csv`.

> **This is the euro-area aggregate**, not a national rate. Swapping `U2` for a
> country code (`DE`, `FR`, …) in the series key gives that country's own rate,
> which is what this site actually wants — 13 countries currently share one
> series and their real differences are missing.

---

## 4. US house prices in dollars — FRED

```
https://fred.stlouisfed.org/graph/fredgraph.csv?id=MSPUS
```

Median sales price of houses sold, quarterly, 1963 onwards, from the Census Bureau and
HUD. No key needed; the same `fredgraph.csv?id=` pattern works for any FRED series.
Saves to `fred-mspus-us-median-house-price.csv`.

> This is one of only two house price sources here that give **money** rather than an
> index. An index cannot be divided by a salary, which is why the salaries-per-house
> chart and the mortgage-qualifying salary exist for the US and UK and nowhere else.

---

## 5. Consumer prices — World Bank, via a GitHub mirror

```
https://raw.githubusercontent.com/datasets/cpi/main/data/cpi.csv
```

Fetched automatically by `scripts/build-data.mjs`, not committed here.
World Bank `FP.CPI.TOTL.ZG`, ODC-PDDL-1.0.

> **The column headed `CPI` holds annual percentage changes, not an index**,
> despite the datapackage claiming 2005 = 100. Verified against known German
> figures before use. Also note Romania's 2024 value (−4.5%) contradicts other
> reporting of roughly +5.6%.

---

## 6. US and UK house price indices — GitHub mirrors

```
https://raw.githubusercontent.com/datasets/house-prices-us/main/data/national-month.csv
https://raw.githubusercontent.com/datasets/house-prices-uk/main/data/data.csv
```

Fetched automatically by `scripts/build-data.mjs`. Case-Shiller national index
and the Nationwide UK index, both ODC-PDDL-1.0.

---

## Still wanted

| Gap | Where to get it |
| --- | --- |
| HICP instead of World Bank CPI, and a fix for the Romania defect | Eurostat `prc_hicp_aind` — `https://ec.europa.eu/eurostat/api/dissemination/files?file=data/prc_hicp_aind.tsv.gz` |
| Per-country euro-area mortgage rates | ECB MIR, same dataset, country code in place of `U2` |
| Non-euro mortgage rates | US: `https://fred.stlouisfed.org/graph/fredgraph.csv?id=MORTGAGE30US` · UK: Bank of England series IUMBV34 · others: national central banks |
| Cyprus pay and house prices | Neither OECD dataset covers it. Cystat is the national statistical office. |
| House prices in money for Europe | No open Europe-wide dataset exists — statistical agencies publish indices because raw averages are not quality-adjusted. HYPOSTAT (European Mortgage Federation) and the Deloitte Property Index are the two published sources, both annual PDFs. A single year's average price per country is enough to turn each index into a level. |
| Longer house price history | BIS long series on residential property prices, [data.bis.org/topics/RPP](https://data.bis.org/topics/RPP) |

> **Eurostat: download the data, not the structure.** Two attempts came back as
> `…_dsd_all_filtered_sdmx_3_0.xml.gz`, which is the data *structure definition* —
> codelists and concepts, zero observations. In the databrowser the Download menu
> has separate groups; take one under **Data** (SDMX-CSV, TSV, Spreadsheet), not
> **Structure**. If the file is tens of KB and contains the word `Codelist`, it is
> the wrong one.
