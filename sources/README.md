# Downloaded sources

Files downloaded by hand and committed so the build is reproducible without
re-downloading. `scripts/import-local.mjs` reads them.

| File | Source | Retrieved | Licence |
| --- | --- | --- | --- |
| `oecd-average-annual-wages.csv` | OECD, Average annual wages (`OECD.ELS.SAE:DSD_EARNINGS@AV_AN_WAGE`), full dataset export from [data-explorer.oecd.org](https://data-explorer.oecd.org) | 2026-08-21 | OECD terms — free re-use with attribution |
| `ecb-mir-euro-area-house-purchase.csv` | ECB Data Portal, series `MIR.M.U2.B.A2C.AM.R.A.2250.EUR.N` — cost of borrowing for households for house purchase, euro area | 2026-08-21 | ECB terms — free re-use with attribution |

Only the **current prices** rows of the OECD file are used (`PRICE_BASE = V`),
in each country's own currency. The constant-price and USD-PPP rows in the same
file are deliberately ignored: a real-terms wage series would double-count
inflation when compared against the consumer prices line.

The ECB series is the **euro area aggregate**, not a per-country rate. It is
applied to euro-area countries and labelled as an aggregate wherever it appears.
Non-euro countries keep hand-made estimates.
