# Downloaded sources

Files downloaded by hand and committed so the build is reproducible without
re-downloading. `scripts/import-local.mjs` reads them.

| File | Source | Retrieved | Licence |
| --- | --- | --- | --- |
| `oecd-average-annual-wages.csv` | OECD, Average annual wages (`OECD.ELS.SAE:DSD_EARNINGS@AV_AN_WAGE`), full dataset export from [data-explorer.oecd.org](https://data-explorer.oecd.org) | 2026-08-21 | OECD terms — free re-use with attribution |
| `ecb-mir-euro-area-house-purchase.csv` | ECB Data Portal, series `MIR.M.U2.B.A2C.AM.R.A.2250.EUR.N` — cost of borrowing for households for house purchase, euro area | 2026-08-21 | ECB terms — free re-use with attribution |
| `fred-mspus-us-median-house-price.csv` | FRED series `MSPUS` — median sales price of houses sold in the United States, quarterly, from the Census Bureau and HUD | 2026-08-21 | US federal government data — public domain |
| `oecd-house-prices-nominal-annual.csv` | OECD, Analytical house price indicators (`OECD.ECO.MPD:DSD_AN_HOUSE_PRICES@DF_HOUSE_PRICES`), full dataset export from [data-explorer.oecd.org](https://data-explorer.oecd.org) | 2026-08-21 | OECD terms — free re-use with attribution |
| `abs-6432.0-table1-value-of-dwellings.xlsx` | ABS catalogue 6432.0, *Total Value of Dwellings*, Table 1 (`643201.xlsx`) — series `A83728647F`, mean price of residential dwellings, Australia | 2026-08-22 | CC-BY-4.0 |
| `abs-6432.0-table2-median-price-transfers.xlsx` | ABS catalogue 6432.0, Table 2 (`643202.xlsx`) — median price of residential dwelling transfers, by region. Not imported; kept for reference | 2026-08-22 | CC-BY-4.0 |
| `rba-f05-indicator-lending-rates.xlsx` | RBA statistical table F5 (`f05hist.xlsx`) — series `FILRHLBVD`, discounted variable owner-occupier housing rate | 2026-08-22 | CC-BY-4.0 |
| `rba-f06-housing-lending-rates.xlsx` | RBA statistical table F6 (`f06hist.xlsx`) — series `FLRHOFTA`, read only as a cross-check on F5 | 2026-08-22 | CC-BY-4.0 |

Only the **current prices** rows of the OECD file are used (`PRICE_BASE = V`),
in each country's own currency. The constant-price and USD-PPP rows in the same
file are deliberately ignored: a real-terms wage series would double-count
inflation when compared against the consumer prices line.

The ECB series is the **euro area aggregate**, not a per-country rate. It is
applied to euro-area countries and labelled as an aggregate wherever it appears.
Australia has a national rate from the RBA; the other ten countries keep hand-made
estimates.

The four Australian files are **xlsx**, the only spreadsheets here. `scripts/lib/xlsx.mjs`
reads them directly — a zip parse, an inflate and a regex over the sheet XML — so what
is committed is the untouched download. Do not convert them to CSV.

## About the house prices file

The OECD export is 16.5 MB because it carries seven measures at two frequencies.
Committing that whole thing to keep 1,871 useful rows was not worth it, so the file
here is the exact subset matching:

    MEASURE == "HPI"   (nominal house price indices)
    FREQ    == "A"     (annual)

No values were altered, rounded or recomputed — the rows are byte-identical to the
full export, minus the columns' other measures. To reproduce, download the full
dataset and filter on those two fields.

The other measures were deliberately left out. `RHP` (real house prices) is already
deflated by consumer prices, so charting it against this site's prices line would
double-deflate; `HPI_YDH` and `HPI_RPI` are ratios, not price levels.

## About the US median price file

`MSPUS` is a median of what sold, not a quality-adjusted index, so it moves when the
mix of houses being sold changes and not only when prices do. It is deliberately *not*
used for the US house price line — Case-Shiller is better for that. It is used only
where an actual price in dollars is needed: the mortgage-qualifying salary and the
salaries-per-house chart, neither of which an index can answer.

## About the Deloitte price file

`deloitte-property-index-2021-eur-per-sqm.csv` is transcribed by hand from page 30
("Summary statistics of country average prices") of the Deloitte Property Index, 10th
edition, July 2021 — figures for 2020, in euros per square metre. The PDF itself is not
committed; it is a public report and the download link is in `DOWNLOADS.md`.

Column choice follows Deloitte's own convention, the one their affordability chart uses:
average transaction price of a new dwelling where it exists, otherwise the bid price of
a new dwelling, otherwise the transaction price of an older dwelling. The `basis` column
records which was used for each country, because they are not the same thing.

Only euro-area countries are used. The prices are quoted in euros for every country, so
using them for Czechia, Denmark, Hungary, Norway, Poland, Romania or the UK would need a
2020 exchange rate to bring them into the currency wages are measured in, and no
exchange rate source is committed here. The UK is excluded anyway: Nationwide publishes
actual transaction prices, which beat an anchored estimate.

## About the Eurostat house sales files

`eurostat-prc_hpi_hsva-house-sales-value.csv` and
`eurostat-prc_hpi_hsna-house-sales-number.csv` hold the value and the number of
dwellings transacted per year. Both carry several units; only `NAC` (value, national
currency) and `NR` (number) are used, and dividing one by the other gives an average
transaction price in the currency wages are measured in — no exchange rate needed,
which is what makes Denmark, Norway and Hungary work.

Ten countries report it. The category used is the total of all dwellings where that is
published and existing dwellings otherwise, recorded per series.

## About the rent file

`oecd-rent-prices-annual.csv` is the `MEASURE = RPI`, `FREQ = A` subset of the same
OECD Analytical House Price Indicators export the house prices came from — the rent
component of consumer prices, indexed. No separate download: it was already in the full
16.5 MB file.

It covers sitting tenants as well as new lettings, so it moves more slowly than
advertised rents, and it feeds the consumer prices line too, which is why rents and
prices are not independent series.

## About the Australian files

`abs-6432.0-table1-value-of-dwellings.xlsx` supplies the only Australian house price in
dollars, and it is **not the same kind of number** as Nationwide's or `MSPUS`. The ABS
divides the total value of the residential dwelling **stock** by the number of
dwellings, so it is the mean value of every home in the country rather than the mean
price of the ones that sold. It runs higher than a transaction median and moves more
smoothly. The calculator calls it an "average dwelling" and prints the distinction in
the housing card. It begins in the September quarter of 2011, so 2012 is the first whole
year; earlier years on the site are that price carried back with the OECD index and are
drawn dashed.

Table 2 holds transaction medians, which would be a better methodological match to the
UK and US figures, but only by region — fifteen of them, with no national aggregate. It
is committed for reference and not imported.

`rba-f05-indicator-lending-rates.xlsx` supplies the rate. `FILRHLBVD`, the discounted
variable owner-occupier rate, was chosen over `FILRHLBVS`, the standard variable rate:
the standard series reaches back to 1959 but is a list price almost nobody pays, and the
discounted one starts in 2004, which covers every year there is an Australian house
price for. It is still an **indicator** rate — what the banks advertise. Table F6
measures what borrowers are actually charged and puts new owner-occupier loans about
0.6 points lower, but starts in 2019 and cannot reach 2016; the importer reads it as a
cross-check and prints the gap on every run.

**Both columns are chosen by Series ID, never by heading.** An earlier version matched
the ABS heading on "Mean price of residential dwellings" and "Australia" and got South
Australia, whose heading contains both.
