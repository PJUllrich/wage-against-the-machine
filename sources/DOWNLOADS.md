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

> **Superseded for everything but Cyprus.** OECD's `DSD_EARNINGS@MW_CURP` (§9c) now
> supplies the other 16 countries, because it is the same publisher as the average wage
> the minimum is charted against. This file is still imported, still needed for Cyprus,
> and still the cross-check the importer prints on every run — do not delete it.

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

The United Kingdom ends in 2020 and no later year exists in this table — OECD carries it
to 2025, which is one of the reasons OECD now wins. Germany starts in 2015 and Cyprus in
2023, which is when each introduced a statutory minimum.

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

## 9. Australia — all three gaps are now filled

Australia arrived with consumer prices, pay, house prices and rents, all from sources
already in this repository, and three gaps: no house price in dollars, no mortgage rate,
no minimum wage. All three are closed. It now draws every chart on the site.

Both Australian files are **xlsx**, which no other source here is. `scripts/lib/xlsx.mjs`
reads them, so the pristine downloads are what is committed — do not hand-convert them
to CSV.

> **Pick the column by its Series ID.** Both spreadsheets carry a "Series ID" row above
> the data. The first cut of the ABS extraction matched the column *heading* against
> "Mean price of residential dwellings" and "Australia" and got **South Australia**,
> whose heading contains both. The result looked entirely plausible and was a third too
> low.

### 9a. House prices in dollars — ABS ✅

<https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/total-value-dwellings/latest-release>

Catalogue **6432.0, Total Value of Dwellings**. From *Data downloads*, take **Table 1**
— the file is named `643201.xlsx` — and save it as
`abs-6432.0-table1-value-of-dwellings.xlsx`. The sheet is `Data1` and the series is
**`A83728647F`**, *Mean price of residential dwellings ; Australia ;*, quarterly, in
thousands of dollars, starting 2011-09.

> **This is not the same kind of number as Nationwide or MSPUS.** ABS divides the total
> value of the residential dwelling **stock** by the number of dwellings. It is the mean
> value of every house in the country, not the mean price of the ones that sold. It runs
> higher than a transaction median and moves more smoothly. The source record carries
> `levelNoun: "dwelling"` and a `levelNote` for exactly this, and the calculator prints
> both — "average dwelling", and the distinction in the housing card's definition.

Table 2 (`643202.xlsx`) holds transaction **medians**, which would be the better
methodological match, but only by region: fifteen of them, with no national aggregate.
It is committed as `abs-6432.0-table2-median-price-transfers.xlsx` for reference and is
not imported.

**Unlocked:** "to afford the same house", the monthly mortgage payment, how many salaries
buy a house, and what the mortgage takes from a salary — four figures and two charts,
all of which Australia now draws.

### 9b. Mortgage rate — RBA ✅

<https://www.rba.gov.au/statistics/tables/>

Under **F. Interest Rates**, download both:

- **F5, Indicator Lending Rates** (`f05hist.xlsx`) → `rba-f05-indicator-lending-rates.xlsx`.
  The series used is **`FILRHLBVD`**, *Housing loans; Banks; Variable; Discounted;
  Owner-occupier*, monthly from 2004. Sheet `Data`.
- **F6, Housing Lending Rates** (`f06hist.xlsx`) → `rba-f06-housing-lending-rates.xlsx`.
  Not imported; **`FLRHOFTA`** (new owner-occupier loans, all institutions) is read as a
  cross-check and printed on every import run.

The discounted rate was chosen over `FILRHLBVS`, the standard variable rate, which has
history back to 1959 but is a list price almost nobody pays. The discounted series
starts in 2004, which covers every year Australia has a house price for anyway.

> **It is still an indicator rate — what the banks advertise.** F6 measures what
> borrowers are actually charged and puts new owner-occupier loans about 0.6 points
> lower (5.8% against 6.4% for 2025), but starts in 2019 and cannot reach 2016. Read the
> Australian mortgage line as the shape of the change rather than the payment to the
> cent.

This replaced **4.5% for 2016 and 6.1% for today**, both of which were estimates with no
source behind them, with a measured 4.63% and 6.55%. Ten countries still have such
estimates: US, GB, SE, DK, NO, CH, PL, CZ, HU, RO.

### 9c. Minimum wage — OECD ✅

<https://data-explorer.oecd.org/vis?df%5Bds%5D=DisseminateFinalDMZ&df%5Bid%5D=DSD_EARNINGS@MW_CURP&df%5Bag%5D=OECD.ELS.SAE>

Dataflow **`DSD_EARNINGS@MW_CURP`**, *Minimum wages at current prices in national currency units* —
the same agency and structure as the average wage already here, so the bulk export
works the same way:

    https://sdmx.oecd.org/public/rest/data/OECD.ELS.SAE,DSD_EARNINGS@MW_CURP,1.0/all?format=csvfilewithlabels

Saves to `oecd-minimum-wages-current-prices-ncu.csv`. Filter to `MEASURE = SM_WG`,
`PAY_PERIOD = A`, `PRICE_BASE = V` — the same current-prices code the wage file uses.
It publishes hourly, daily, weekly, monthly and annual pay periods; take the annual one
and no multiplying by twelve is needed.

> **Do not take `DSD_EARNINGS@RMW`**, *Real minimum wages at constant prices*. It is
> deflated to 2024 prices and converted to USD and USD-PPP, so charting it against the
> consumer prices line would deflate twice — the same trap as the wage file's
> constant-price rows.

This **replaced Eurostat for 15 of the 16 countries** Eurostat covered, and is now the
preferred source. The reason is not that Eurostat is wrong — the two agree to the
rounding for eleven of them — but that the line this is drawn against is the OECD
average wage, and a Eurostat minimum over an OECD average puts two annualising
conventions in one ratio. Same publisher on both lines.

What changed by switching:

| | Eurostat | OECD |
| --- | --- | --- |
| Australia | absent | 1985–2025 |
| United Kingdom | 1999–**2020** (stops at Brexit) | 2000–2025 |
| Earliest year | 1999 for most | 1960 for NL, FR, GR, RO, US; 1963 ES; 1975 BE; 1977 PT |
| Annualising | monthly rate × 12, ours | published annual, theirs |
| Cyprus | 2023–2026 | not an OECD member |

Where the two disagree it is because a country sets an hourly or monthly floor and
turning it into a year needs an assumption about normal weekly hours or months paid:
the Netherlands by **8.4%** for 2025 (€28,880 against €26,634 — about the difference
between a 36- and a 39-hour week), Ireland by 2.5%, Greece by 1.5%, Belgium by 0.8%.
The chart names which publisher drew each country's line.

**Eurostat is still imported and still supplies Cyprus.** Don't remove it. The importer
runs Eurostat first and lets OECD overwrite, logging both figures side by side on every
run so a future divergence is visible rather than silent.

The Fair Work Commission's own series
(<https://www.fwc.gov.au/agreements-awards/minimum-wages-and-conditions/annual-wage-reviews>)
was the other candidate for Australia and is not needed now: it is a weekly and hourly
rate set from 1 July, so a calendar year would be a weighted blend of two rates.

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
