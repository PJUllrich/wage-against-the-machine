/* ============================================================
   Headline figures — the calculator's inputs. Cumulative % change,
   2016 -> 2026. Edit here, or regenerate with
   scripts/fetch-eurostat.mjs (which rewrites the block between the
   DATA:START and DATA:END markers).

   prices : consumer price index (HICP / CPI-U)
   wages  : nominal average gross earnings
   homes  : residential property price index
   rate16 : typical rate on new housing loans, 2016 (% p.a.)
   rate26 : the same rate today (% p.a.)
   solid  : true if prices/wages/homes come directly from a published
            source; false if estimated from annual rates (shown with
            an approximation sign in the table). Mortgage rates are
            estimates in every country and always show one.

   These are NOT the same numbers as the annual series in series.js:
   they run to 2026 and lean on estimates, where the series only go as
   far as the publishers do. data.html reconciles the two per country.

   Since the calculator gained a year selector it reads the SERIES first
   and only falls back to these figures when no series covers a line —
   in practice Cyprus pay and housing, and mortgage rates outside the
   euro area. A fallback only ever applies to 2016, because 2016 is the
   only year these numbers describe.
   ============================================================ */
/* DATA:START */
/* Wages and euro-area mortgage rates imported from sources/ on 2026-08-21 by scripts/import-local.mjs. */
const DATA = {
  US: {name:"United States",  cur:"USD", sym:"$",   locale:"en-US",
       prices:39,     pricesTo:2026, wages:45.6,   wagesTo:2025, homes:80,     homesTo:2026,
       rate16:3.7,  rate26:6.4,  rateSrc:"estimate", solid:true},
  GB: {name:"United Kingdom", cur:"GBP", sym:"£",   locale:"en-GB",
       prices:41,     pricesTo:2026, wages:36.9,   wagesTo:2025, homes:45,     homesTo:2026,
       rate16:2.2,  rate26:4.6,  rateSrc:"estimate", solid:false},
  DE: {name:"Germany",        cur:"EUR", sym:"€",   locale:"de-DE",
       prices:35,     pricesTo:2026, wages:37.1,   wagesTo:2025, homes:42.1,   homesTo:2025,
       rate16:1.97, rate26:3.42, rateSrc:"ecb-mir",  solid:false},
  FR: {name:"France",         cur:"EUR", sym:"€",   locale:"fr-FR",
       prices:26,     pricesTo:2026, wages:22.8,   wagesTo:2025, homes:25.8,   homesTo:2025,
       rate16:1.97, rate26:3.42, rateSrc:"ecb-mir",  solid:false},
  IT: {name:"Italy",          cur:"EUR", sym:"€",   locale:"it-IT",
       prices:26,     pricesTo:2026, wages:16.8,   wagesTo:2025, homes:15.9,   homesTo:2025,
       rate16:1.97, rate26:3.42, rateSrc:"ecb-mir",  solid:false},
  ES: {name:"Spain",          cur:"EUR", sym:"€",   locale:"es-ES",
       prices:29,     pricesTo:2026, wages:30.4,   wagesTo:2025, homes:72.6,   homesTo:2025,
       rate16:1.97, rate26:3.42, rateSrc:"ecb-mir",  solid:false},
  NL: {name:"Netherlands",    cur:"EUR", sym:"€",   locale:"nl-NL",
       prices:39,     pricesTo:2026, wages:32.2,   wagesTo:2025, homes:104.3,  homesTo:2025,
       rate16:1.97, rate26:3.42, rateSrc:"ecb-mir",  solid:false},
  BE: {name:"Belgium",        cur:"EUR", sym:"€",   locale:"nl-BE",
       prices:37,     pricesTo:2026, wages:38.9,   wagesTo:2025, homes:41.6,   homesTo:2025,
       rate16:1.97, rate26:3.42, rateSrc:"ecb-mir",  solid:false},
  AT: {name:"Austria",        cur:"EUR", sym:"€",   locale:"de-AT",
       prices:40,     pricesTo:2026, wages:40.8,   wagesTo:2025, homes:56.6,   homesTo:2025,
       rate16:1.97, rate26:3.42, rateSrc:"ecb-mir",  solid:false},
  IE: {name:"Ireland",        cur:"EUR", sym:"€",   locale:"en-IE",
       prices:27,     pricesTo:2026, wages:37.3,   wagesTo:2025, homes:83.5,   homesTo:2025,
       rate16:1.97, rate26:3.42, rateSrc:"ecb-mir",  solid:false},
  PT: {name:"Portugal",       cur:"EUR", sym:"€",   locale:"pt-PT",
       prices:30,     pricesTo:2026, wages:55.7,   wagesTo:2025, homes:146.3,  homesTo:2025,
       rate16:1.97, rate26:3.42, rateSrc:"ecb-mir",  solid:false},
  GR: {name:"Greece",         cur:"EUR", sym:"€",   locale:"el-GR",
       prices:25,     pricesTo:2026, wages:12.1,   wagesTo:2025, homes:82.2,   homesTo:2025,
       rate16:1.97, rate26:3.42, rateSrc:"ecb-mir",  solid:false},
  FI: {name:"Finland",        cur:"EUR", sym:"€",   locale:"fi-FI",
       prices:28,     pricesTo:2026, wages:23.7,   wagesTo:2025, homes:-2.2,   homesTo:2025,
       rate16:1.97, rate26:3.42, rateSrc:"ecb-mir",  solid:false},
  EE: {name:"Estonia",        cur:"EUR", sym:"€",   locale:"et-EE",
       prices:64,     pricesTo:2026, wages:90.5,   wagesTo:2025, homes:110.7,  homesTo:2025,
       rate16:1.97, rate26:3.42, rateSrc:"ecb-mir",  solid:true},
  CY: {name:"Cyprus",         cur:"EUR", sym:"€",   locale:"el-CY",
       prices:22,     pricesTo:2026, wages:26,     wagesTo:2026, homes:30,     homesTo:2026,
       rate16:1.97, rate26:3.42, rateSrc:"ecb-mir",  solid:true},
  SE: {name:"Sweden",         cur:"SEK", sym:"kr",  locale:"sv-SE",
       prices:35,     pricesTo:2026, wages:34,     wagesTo:2025, homes:23.3,   homesTo:2025,
       rate16:1.7,  rate26:4.2,  rateSrc:"estimate", solid:false},
  DK: {name:"Denmark",        cur:"DKK", sym:"kr",  locale:"da-DK",
       prices:27,     pricesTo:2026, wages:27.8,   wagesTo:2025, homes:46.1,   homesTo:2025,
       rate16:1.5,  rate26:4,    rateSrc:"estimate", solid:false},
  NO: {name:"Norway",         cur:"NOK", sym:"kr",  locale:"nb-NO",
       prices:40,     pricesTo:2026, wages:41.2,   wagesTo:2025, homes:42.5,   homesTo:2025,
       rate16:2.5,  rate26:5.3,  rateSrc:"estimate", solid:false},
  CH: {name:"Switzerland",    cur:"CHF", sym:"CHF", locale:"de-CH",
       prices:8,      pricesTo:2026, wages:13.2,   wagesTo:2025, homes:43.2,   homesTo:2025,
       rate16:1.5,  rate26:2.2,  rateSrc:"estimate", solid:false},
  PL: {name:"Poland",         cur:"PLN", sym:"zł",  locale:"pl-PL",
       prices:57,     pricesTo:2026, wages:108.9,  wagesTo:2025, homes:112.9,  homesTo:2025,
       rate16:4.4,  rate26:7.5,  rateSrc:"estimate", solid:false},
  CZ: {name:"Czechia",        cur:"CZK", sym:"Kč",  locale:"cs-CZ",
       prices:55,     pricesTo:2026, wages:81.4,   wagesTo:2025, homes:128.9,  homesTo:2025,
       rate16:2.1,  rate26:5,    rateSrc:"estimate", solid:false},
  HU: {name:"Hungary",        cur:"HUF", sym:"Ft",  locale:"hu-HU",
       prices:76,     pricesTo:2026, wages:160.1,  wagesTo:2025, homes:223.4,  homesTo:2025,
       rate16:5,    rate26:6.6,  rateSrc:"estimate", solid:true},
  RO: {name:"Romania",        cur:"RON", sym:"lei", locale:"ro-RO",
       prices:64,     pricesTo:2026, wages:173.5,  wagesTo:2024, homes:55.6,   homesTo:2025,
       rate16:3.8,  rate26:5.8,  rateSrc:"estimate", solid:true}
};
/* DATA:END */
window.HEADLINE = DATA;
