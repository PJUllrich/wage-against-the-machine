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

## 5. Consumer prices — World Bank

<https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG> → **Download → CSV**, or straight to
the bulk zip:

```
https://api.worldbank.org/v2/en/indicator/FP.CPI.TOTL.ZG?downloadformat=csv
```

Unzip it and commit the `API_FP.CPI.TOTL.ZG_*.csv` as
`sources/worldbank-FP.CPI.TOTL.ZG-annual-percent.csv`. CC BY-4.0. The other two files in
the zip are metadata and are not used.

> **Every line ends with a trailing comma.** Split the header on `","` without
> stripping it and the last column becomes `2025",` instead of `2025`, so the newest
> year is dropped with no error — the one year anybody re-downloads the file for.
> `build-data.mjs` strips it; anything else reading this file must too.

> **The values are annual percentage changes, not an index**, whatever a mirror's
> datapackage may claim. Verified against known German figures (2022: 6.87%,
> 2024: 2.26%) before use.

This replaced `raw.githubusercontent.com/datasets/cpi/main/data/cpi.csv`, which
`build-data.mjs` used to fetch. That mirror stopped at 2024 and carried −4.5% for
Romania in 2024 against the +5.7% the World Bank itself publishes. Taking the file
direct fixed both. If the mirror is ever used again, check both before trusting it.

---

## 6. US and UK house price indices — GitHub mirrors

```
https://raw.githubusercontent.com/datasets/house-prices-us/main/data/national-month.csv
https://raw.githubusercontent.com/datasets/house-prices-uk/main/data/data.csv
```

Fetched automatically by `scripts/build-data.mjs`. Case-Shiller national index
and the Nationwide UK index, both ODC-PDDL-1.0.

---

## 8. Minimum wages — Eurostat

<https://ec.europa.eu/eurostat/databrowser/view/earn_mw_cur/default/table?lang=en>

Dataset `earn_mw_cur`, saved as `eurostat-earn_mw_cur-minimum-wages.csv`. In the
databrowser: **Download → Data → SDMX-CSV**, and take the whole table rather than a
filtered view — the importer selects what it needs.

Three things about this table that are easy to get wrong:

- **Take the `NAC` currency rows.** The same file also carries `EUR` and `PPS`. Only
  national currency can meet the OECD wage, which is also in national currency;
  charting the euro rows against it would compare a converted figure with an unconverted
  one and read as a currency move.
- **It is a monthly rate, published twice a year** (`2016-S1`, `2016-S2`). The importer
  averages the two semesters and multiplies by twelve. Countries paying fourteen months
  — Greece, Spain, Portugal — are already converted to a twelve-month basis by Eurostat,
  so no further adjustment applies.
- **Blank is not zero.** Countries with no statutory minimum still get a row per
  semester, with an empty value flagged `m`. `Number("")` is `0` in JavaScript, so an
  empty check has to come before the numeric one or Italy, Austria, Finland, Sweden,
  Denmark, Norway and Switzerland arrive as a wage floor of zero.

The United Kingdom ends in 2020 and no later year exists in this table. Germany starts
in 2015 and Cyprus in 2023, which is when each introduced a statutory minimum.

---

## Still wanted

| Gap | Where to get it |
| --- | --- |
| HICP instead of World Bank CPI | Eurostat `prc_hicp_aind` — `https://ec.europa.eu/eurostat/api/dissemination/files?file=data/prc_hicp_aind.tsv.gz`. Harmonises the European countries at the cost of the US and Australia, which it does not cover. |
| A 2025 consumer price figure for the United States | Not in the World Bank's July 2026 release. Re-download `FP.CPI.TOTL.ZG` when the next one lands. |
| Per-country euro-area mortgage rates | ECB MIR, same dataset, country code in place of `U2` |
| Non-euro mortgage rates | US: `https://fred.stlouisfed.org/graph/fredgraph.csv?id=MORTGAGE30US` · UK: Bank of England series IUMBV34 · others: national central banks |
| Cyprus pay and house prices | Neither OECD dataset covers it. Cystat is the national statistical office. |
| Everything still missing for Australia | See section 9 below — house prices in dollars, the mortgage rate, and the minimum wage. |
| UK minimum wage after 2020 | Eurostat stopped at Brexit. The Low Pay Commission and gov.uk publish the National Living Wage by year. |
| House prices in money for Europe | See below — there is no clean dataset, and the reason is structural. |
| Longer house price history | BIS long series on residential property prices, [data.bis.org/topics/RPP](https://data.bis.org/topics/RPP) |

> **Eurostat: download the data, not the structure.** Two attempts came back as
> `…_dsd_all_filtered_sdmx_3_0.xml.gz`, which is the data *structure definition* —
> codelists and concepts, zero observations. In the databrowser the Download menu
> has separate groups; take one under **Data** (SDMX-CSV, TSV, Spreadsheet), not
> **Structure**. If the file is tens of KB and contains the word `Codelist`, it is
> the wrong one.


---

## 7. European house prices per square metre — Deloitte

<https://www.deloitte.com/ce/en/issues/real-estate/property-index.html>

Annual PDF. Page 30 of the 2021 edition carries a country table of average prices per
square metre, which is transcribed into
`deloitte-property-index-2021-eur-per-sqm.csv`. Everything is in euros, so non-euro
countries need an exchange rate before the figures can meet wages in national currency.

> Do not use Deloitte's own affordability multiples. They divide by a salary figure
> that does not match OECD average annual wages, and not by a constant amount: for
> Belgium, Germany, Italy and Portugal the two agree within half a salary, but Deloitte
> implies an Austrian average salary of about €29,400 where OECD reports €45,154, which
> moves Austria from 6.9 salaries to 10.6. The price table is the useful part.

---

## 9. Australia — the three gaps

Australia arrived with consumer prices, pay, house prices and rents, all from sources
already in this repository. Three things are missing, and none of them is Australia's
fault: every source that would supply them is European or American by construction.

**The links below were written from knowledge and could not be checked** — this
project's sandbox cannot reach abs.gov.au, rba.gov.au, fwc.gov.au or any statistics
host. Navigate from the site's own search if a deep link has moved.

### 9a. House prices in dollars — ABS

<https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/total-value-dwellings/latest-release>

Catalogue **6432.0, Total Value of Dwellings**. The table to want is *Mean price of
residential dwellings*, in dollars, quarterly, Australia. Download the time-series
spreadsheet from the *Data downloads* section rather than copying the summary table, so
the whole history comes with it.

> **This is not the same kind of number as Nationwide or MSPUS.** ABS divides the total
> value of the residential dwelling **stock** by the number of dwellings. It is the mean
> value of every house in the country, not the mean price of the ones that sold. It runs
> higher than a transaction median and moves differently. If we use it, the copy has to
> say so, and `levelKind` on the source should read something other than "average" —
> the same treatment the US median already gets.

The alternative is the ABS **Residential Property Price Index** (formerly 6416.0), which
is an index and would need anchoring to one published dollar figure, exactly as the
euro-area prices are anchored to Deloitte. Prefer the direct dollar series if it is
long enough.

**Unlocks:** "to afford the same house", the monthly mortgage payment, how many salaries
buy a house, and what the mortgage takes from a salary — four figures and two charts.

### 9b. Mortgage rate — RBA

<https://www.rba.gov.au/statistics/tables/>

Two candidates under **F. Interest Rates**:

- **F5, Indicator Lending Rates** — the standard variable housing rate, with a long
  history. Comparable across 2016 and today, which is what the calculator needs.
- **F6, Housing Lending Rates** — average rates actually paid on new and outstanding
  owner-occupier loans. Better measure, shorter history; it begins around 2019, so it
  cannot reach 2016 on its own.

Take F5 for the history and F6 to sanity-check the recent end. The site currently uses
**4.5% for 2016 and 6.1% now, and both are estimates I supplied with no source behind
them** — the only numbers on the site in that position. Replacing them is the single
most valuable thing on this list.

### 9c. Minimum wage — Fair Work Commission, or OECD

<https://www.fwc.gov.au/agreements-awards/minimum-wages-and-conditions/annual-wage-reviews>

Each Annual Wage Review decision sets the National Minimum Wage from 1 July. The
commission publishes the historical series alongside the decisions; it is a weekly and
hourly rate, so it needs annualising, and a July change means a calendar year is a
weighted blend of two rates rather than one.

Cleaner alternative: **OECD's minimum wage series** in the same Earnings database the
average wage already comes from (data-explorer.oecd.org → Earnings → Minimum wages, in
national currency at current prices). One more file in a format `import-local.mjs`
already parses, annual, and it covers Australia. The cost is a second minimum-wage
publisher alongside Eurostat's, so the chart would have to say which one a country's
line came from.

---

## House prices in money for Europe — why this is hard

Eurostat, OECD and BIS all publish house price **indices** and no levels. That is not an
oversight: an average transaction price moves when the mix of what sold changes, so it
is not comparable across countries or across time, which is exactly what an index is
built to fix. Several European countries do not publish an official average transaction
price at all.

So there is no equivalent of `MSPUS` for Europe. In rough order of effort, the options:

1. **HYPOSTAT statistical annex** — the European Mortgage Federation publishes the
   tables behind the HYPOSTAT report as a spreadsheet, separately from the 168-page PDF.
   Same numbers, machine-readable, and it carries per-country mortgage rates too, which
   would also replace the single euro-area rate used here.
   <https://hypo.org/emf/publications/hypostat/>
2. **UNECE Statistical Database**, Housing section — PXWeb, exports CSV, free, no key.
   Coverage is patchy and varies by country, so check the indicator before trusting it.
   <https://w3.unece.org/PXWeb/en>
3. **National statistics offices**, for the countries that matter most to you. These are
   machine-readable and authoritative but it is one download each: CBS StatLine has a
   Dutch average purchase price, INE a Spanish price per square metre, INSEE and the
   Notaires the French one. Germany and Italy publish indices rather than average
   prices, so they would stay index-only either way.
4. **Numbeo** publishes a price-per-square-metre table for every country in one page.
   It is crowdsourced rather than official. If it is ever used here it must be labelled
   as such on the sources page, and it needs an assumed dwelling size to become a price.

**One year is enough.** The site already has an OECD index for 22 countries, so a single
average price per country in any one year turns each index into a full series back to
1970. A twelve-row table beats a 168-page report.
