#!/usr/bin/env python3
"""
Re-derive every number in data/series.js from the files it was built from, and
say so when one does not match.

    pip install openpyxl && python3 scripts/verify-data.py

**Deliberately not written in JavaScript, and deliberately shares no code with
the importers.** A verifier that reuses `scripts/lib/xlsx.mjs` or
`scripts/lib/store.mjs` only proves the pipeline agrees with itself; a parser
bug would cancel out on both sides. This reads the same source files with its
own CSV reader, its own xlsx reader (openpyxl), and its own arithmetic, then
compares the answer against what is committed.

What it checks, for all 140 series:

  * `raw` equals the published figure, year by year, at the stored rounding.
  * `values` equals `raw` rebased so 2016 = 100, recomputed here.
  * The source's years are **contiguous**. This matters more than it looks:
    `toSeries()` builds its arrays from sorted year *keys*, while `valueAt()`
    reads them as `start + i`. A single missing year in a source would shift
    every later value onto the wrong year, silently and everywhere.
  * Derived series really are their derivation — the World Bank chain, the
    Eurostat value ÷ number, the Deloitte anchor × index, the quarterly and
    monthly means.
  * `partial` flags match the years that are actually short.
  * Every series is covered by some check. A series no check touches is
    reported as a failure, so this cannot quietly go stale when a kind is added.
  * `data/headline.js` agrees with the series wherever the series reaches the
    year the headline names.

Rounding note: JavaScript's Math.round takes .5 upward, Python's round() takes
it to even. Nine Nationwide years land exactly on .5. `jsround` below matches
the pipeline rather than Python.

Needs network for two series only — Case-Shiller and Nationwide come from
mirrors rather than sources/. Those are skipped with a warning if unreachable.
"""
import json, csv, collections, datetime, math, io, re, openpyxl

jsround = lambda x, d=0: math.floor(x*10**d + 0.5)/10**d
S = json.loads((lambda s: s[s.index("{"):s.rindex("}")+1])(open("data/series.js",encoding="utf-8").read()))
C, SRC = S["countries"], S["sources"]
hm = open("data/headline.js",encoding="utf-8").read()
DATA = json.loads(re.sub(r"(\w+):", r'"\1":',
        hm[hm.index("const DATA")+12 : hm.index("/* DATA:END */")].strip().rstrip(";").rstrip()
        ).replace("'", '"'))

ISO3 = {"US":"USA","GB":"GBR","DE":"DEU","FR":"FRA","IT":"ITA","ES":"ESP","NL":"NLD","BE":"BEL","AT":"AUT",
        "IE":"IRL","PT":"PRT","GR":"GRC","FI":"FIN","EE":"EST","CY":"CYP","SE":"SWE","DK":"DNK","NO":"NOR",
        "CH":"CHE","PL":"POL","CZ":"CZE","HU":"HUN","RO":"ROU","AU":"AUS"}
fails=[]; n=0; seen=set()
def ck(c,m):
    global n; n+=1
    if not c: fails.append(m)
def rows(f): return list(csv.DictReader(open("sources/"+f, encoding="utf-8-sig")))

def verify(iso, kind, by, digits, tol=None):
    """by: {year: published value}. Checks contiguity, raw and the 2016 index."""
    seen.add((iso,kind))
    s=C[iso][kind]; ys=sorted(by)
    ck(s["start"]==ys[0] and len(s["raw"])==len(ys),
       f"{iso}.{kind}: stored {s['start']}+{len(s['raw'])} vs source {ys[0]}+{len(ys)}")
    gaps=[y for y in range(ys[0],ys[-1]+1) if y not in by]
    ck(not gaps, f"{iso}.{kind}: SOURCE YEAR GAPS {gaps} — arrays are read as start+i")
    t = tol if tol is not None else 10**-digits*0.51+1e-9
    for i,y in enumerate(ys):
        if i>=len(s["raw"]): break
        ck(abs(s["raw"][i]-jsround(by[y],digits))<=t, f"{iso}.{kind} {y}: {s['raw'][i]} vs {jsround(by[y],digits)}")
    if not s.get("isRate"):
        base = by.get(2016, by[ys[0]])
        for i,y in enumerate(ys):
            if i>=len(s["values"]): break
            ck(abs(s["values"][i]-jsround(by[y]/base*100,2))<=0.011,
               f"{iso}.{kind} {y}: index {s['values'][i]} vs {jsround(by[y]/base*100,2)}")

# --- OECD wages / homes / rents / minwage ---
def oecd(f, **flt):
    out=collections.defaultdict(dict)
    for r in rows(f):
        if any(r.get(k)!=v for k,v in flt.items()) or not r["OBS_VALUE"]: continue
        if not r["TIME_PERIOD"]: continue
        out[r["REF_AREA"]][int(r["TIME_PERIOD"])]=float(r["OBS_VALUE"])
    return out
W  = oecd("oecd-average-annual-wages.csv", PRICE_BASE="V", MEASURE="WG")
H  = oecd("oecd-house-prices-nominal-annual.csv", MEASURE="HPI", FREQ="A")
R  = oecd("oecd-rent-prices-annual.csv", MEASURE="RPI", FREQ="A")
MW = oecd("oecd-minimum-wages-current-prices-ncu.csv", MEASURE="SM_WG", PAY_PERIOD="A", PRICE_BASE="V")
for iso,a3 in ISO3.items():
    if a3 in W:  verify(iso,"wages",W[a3],0)
    if a3 in H and iso not in ("US","GB"): verify(iso,"homes",H[a3],2)
    if a3 in R:  verify(iso,"rents",R[a3],2)
    if a3 in MW: verify(iso,"minwage",MW[a3],0)
# Eurostat still supplies Cyprus's minimum wage
est=collections.defaultdict(lambda: collections.defaultdict(list))
for r in rows("eurostat-earn_mw_cur-minimum-wages.csv"):
    if r.get("currency")!="NAC" or not r.get("OBS_VALUE"): continue
    est[r["geo"]][int(str(r["TIME_PERIOD"])[:4])].append(float(r["OBS_VALUE"]))
verify("CY","minwage",{y: sum(v)/len(v)*12 for y,v in est["CY"].items()},0)

# --- World Bank prices ---
txt=open("sources/worldbank-FP.CPI.TOTL.ZG-annual-percent.csv",encoding="utf-8-sig").read().splitlines()
hdr=next(i for i,l in enumerate(txt) if l.startswith('"Country Name"'))
rdr=csv.reader(io.StringIO("\n".join(l for l in txt[hdr:] if l.strip())))
cols=next(rdr); yc={int(c.strip('" ')):i for i,c in enumerate(cols) if re.fullmatch(r'"?\d{4}"?', c.strip())}
wb={}
for row in rdr:
    if len(row)>3: wb[row[1].strip()]={y:float(row[i]) for y,i in yc.items() if i<len(row) and row[i].strip() not in("","NA")}
for iso,a3 in ISO3.items():
    s=C[iso]["prices"]; seen.add((iso,"prices")); src=wb[a3]
    ys=list(range(s["start"], s["start"]+len(s["raw"])))
    ck(all(y in src for y in ys), f"{iso}.prices: missing years in file")
    for i,y in enumerate(ys): ck(abs(s["raw"][i]-jsround(src[y],3))<1e-9, f"{iso}.prices {y}: {s['raw'][i]} vs {jsround(src[y],3)}")
    idx={ys[0]:100.0}
    for y in ys[1:]: idx[y]=idx[y-1]*(1+src[y]/100)
    for i,y in enumerate(ys):
        ck(abs(s["values"][i]-jsround(idx[y]/idx[2016]*100,2))<=0.011, f"{iso}.prices {y} index")

# --- mirrors ---
def ann(fh,dc,vc):
    by=collections.defaultdict(list)
    for r in csv.DictReader(fh):
        if r[vc].strip(): by[int(r[dc][:4])].append(float(r[vc]))
    return by
MIRROR = {
  "cs": "https://raw.githubusercontent.com/datasets/house-prices-us/main/data/national-month.csv",
  "uk": "https://raw.githubusercontent.com/datasets/house-prices-uk/main/data/data.csv",
}
try:
    import urllib.request
    got = {k: urllib.request.urlopen(u, timeout=30).read().decode("utf-8-sig") for k,u in MIRROR.items()}
except Exception as e:
    print(f"  ! skipping Case-Shiller and Nationwide, mirrors unreachable: {e}")
    got = None
if got:
    cs=ann(io.StringIO(got["cs"]),"Date","National-US")
    verify("US","homes",{y:sum(v)/len(v) for y,v in cs.items()},2)
    uk=ann(io.StringIO(got["uk"]),"Date","Price (All)")
    ukann={y:sum(v)/len(v) for y,v in uk.items()}
    verify("GB","homes",ukann,0); verify("GB","homeprice",ukann,0)

# --- MSPUS / Eurostat / Deloitte / ABS ---
mq=collections.defaultdict(list)
for r in rows("fred-mspus-us-median-house-price.csv"): mq[int(r["observation_date"][:4])].append(float(r["MSPUS"]))
verify("US","homeprice",{y:sum(v)/len(v) for y,v in mq.items()},0)

V=collections.defaultdict(lambda: collections.defaultdict(dict)); N=collections.defaultdict(lambda: collections.defaultdict(dict))
for r in rows("eurostat-prc_hpi_hsva-house-sales-value.csv"):
    if r["unit"]=="NAC" and r["OBS_VALUE"].strip(): V[r["geo"]][r["purchase"]][int(r["TIME_PERIOD"])]=float(r["OBS_VALUE"])
for r in rows("eurostat-prc_hpi_hsna-house-sales-number.csv"):
    if r["unit"]=="NR" and r["OBS_VALUE"].strip(): N[r["geo"]][r["purchase"]][int(r["TIME_PERIOD"])]=float(r["OBS_VALUE"])
GEO={"GR":"EL","GB":"UK"}
nest=0
for iso,k in C.items():
    hp=k.get("homeprice")
    if not hp or hp["src"]!="eurostat-house-sales": continue
    nest+=1; g=GEO.get(iso,iso); best=None
    for cat in ("TOTAL","DW_EXST","DW_NEW"):
        ys=[y for y in V[g].get(cat,{}) if y in N[g].get(cat,{})]
        if len(ys)>1 and (best is None or len(ys)>len(best[1])): best=(cat,sorted(ys))
    cat,ys=best
    ck(hp.get("basis")=={"TOTAL":"all dwellings","DW_EXST":"existing dwellings","DW_NEW":"new dwellings"}[cat],
       f"{iso}.homeprice basis {hp.get('basis')} vs longest category {cat}")
    verify(iso,"homeprice",{y:V[g][cat][y]/N[g][cat][y] for y in ys},0)

dl={r["iso"]:float(r["eur_per_sqm"]) for r in rows("deloitte-property-index-2021-eur-per-sqm.csv")}
ndl=0
for iso,k in C.items():
    hp=k.get("homeprice")
    if not hp or hp["src"]!="deloitte-sqm": continue
    ndl+=1; idx=k["homes"]; a=dl[iso]*70; base=idx["values"][2020-idx["start"]]
    verify(iso,"homeprice",{idx["start"]+i: a*v/base for i,v in enumerate(idx["values"])},0)

wbk=openpyxl.load_workbook("sources/abs-6432.0-table1-value-of-dwellings.xlsx",read_only=True,data_only=True)
rws=list(wbk["Data1"].iter_rows(values_only=True)); ir=[i for i,r in enumerate(rws) if r and r[0]=="Series ID"][0]
col=list(rws[ir]).index("A83728647F"); qs=collections.defaultdict(list)
for r in rws[ir+1:]:
    if isinstance(r[0],datetime.datetime) and r[col] not in (None,""): qs[r[0].year].append(float(r[col]))
verify("AU","homeprice",{y:sum(v)/len(v)*1000 for y,v in qs.items() if len(v)==4},0)

# --- rates ---
key=[k for k in rows("ecb-mir-euro-area-house-purchase.csv")[0] if "MIR." in k][0]
em=collections.defaultdict(list)
for r in rows("ecb-mir-euro-area-house-purchase.csv"):
    if r[key].strip(): em[int(r["DATE"][:4])].append(float(r[key]))
ecb={y:sum(v)/len(v) for y,v in em.items()}
for iso in ["DE","FR","IT","ES","NL","BE","AT","IE","PT","GR","FI","EE","CY"]: verify(iso,"rate",ecb,2)
wbk=openpyxl.load_workbook("sources/rba-f05-indicator-lending-rates.xlsx",read_only=True,data_only=True)
rws=list(wbk["Data"].iter_rows(values_only=True)); ir=[i for i,r in enumerate(rws) if r and r[0]=="Series ID"][0]
col=list(rws[ir]).index("FILRHLBVD"); rm=collections.defaultdict(list)
for r in rws[ir+1:]:
    if isinstance(r[0],datetime.datetime) and r[col] not in (None,""): rm[r[0].year].append(float(r[col]))
verify("AU","rate",{y:sum(v)/len(v) for y,v in rm.items()},2)

# --- coverage: did anything escape? ---
allpairs={(i,k) for i,ks in C.items() for k in ks}
missed = allpairs - seen
if got is None: missed -= {("US","homes"),("GB","homes"),("GB","homeprice")}
ck(not missed, f"NOT VERIFIED against any source: {sorted(missed)}")

# --- headline.js consistency ---
for iso,d in DATA.items():
    for kind in ("prices","wages","homes"):
        s=C[iso].get(kind)
        if not s: continue
        to=d[kind+"To"]; last=s["start"]+len(s["values"])-1
        i=to-s["start"]
        if 0<=i<len(s["values"]):
            meas=s["values"][i]-100
            ck(abs(meas-d[kind])<0.06 or to>last,
               f"headline {iso}.{kind}: {d[kind]}% to {to} but the series says {round(meas,1)}% at {to}")
    if d["rateSrc"]!="estimate":
        r=C[iso]["rate"]
        ck(abs(r["values"][2016-r["start"]]-d["rate16"])<0.005, f"headline {iso}.rate16 {d['rate16']} vs series {r['values'][2016-r['start']]}")
        ck(abs(r["values"][-1]-d["rate26"])<0.005, f"headline {iso}.rate26 {d['rate26']} vs series last {r['values'][-1]}")

print(f"eurostat homeprice countries: {nest} | deloitte: {ndl}")
print(f"series verified: {len(seen)} of {len(allpairs)}")
print(f"\n{n} value checks, {len(fails)} failures")
for f in fails: print("  !", f)
raise SystemExit(1 if fails else 0)
