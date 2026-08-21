# Downloaded sources

Files downloaded by hand and committed so the build is reproducible without
re-downloading. `scripts/import-local.mjs` reads them.

| File | Source | Retrieved | Licence |
| --- | --- | --- | --- |
| `oecd-average-annual-wages.csv` | OECD, Average annual wages (`OECD.ELS.SAE:DSD_EARNINGS@AV_AN_WAGE`), full dataset export from [data-explorer.oecd.org](https://data-explorer.oecd.org) | 2026-08-21 | OECD terms — free re-use with attribution |
| `ecb-mir-euro-area-house-purchase.csv` | ECB Data Portal, series `MIR.M.U2.B.A2C.AM.R.A.2250.EUR.N` — cost of borrowing for households for house purchase, euro area | 2026-08-21 | ECB terms — free re-use with attribution |
| `oecd-house-prices-nominal-annual.csv` | OECD, Analytical house price indicators (`OECD.ECO.MPD:DSD_AN_HOUSE_PRICES@DF_HOUSE_PRICES`), full dataset export from [data-explorer.oecd.org](https://data-explorer.oecd.org) | 2026-08-21 | OECD terms — free re-use with attribution |

Only the **current prices** rows of the OECD file are used (`PRICE_BASE = V`),
in each country's own currency. The constant-price and USD-PPP rows in the same
file are deliberately ignored: a real-terms wage series would double-count
inflation when compared against the consumer prices line.

The ECB series is the **euro area aggregate**, not a per-country rate. It is
applied to euro-area countries and labelled as an aggregate wherever it appears.
Non-euro countries keep hand-made estimates.

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
