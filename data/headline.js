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
   ============================================================ */
/* DATA:START */
const DATA = {
  US: {name:"United States", cur:"USD", sym:"$",  locale:"en-US", prices:39, wages:45, homes:80, rate16:3.7, rate26:6.4, solid:true},
  GB: {name:"United Kingdom",cur:"GBP", sym:"£",  locale:"en-GB", prices:41, wages:46, homes:45, rate16:2.2, rate26:4.6, solid:false},
  DE: {name:"Germany",       cur:"EUR", sym:"€",  locale:"de-DE", prices:35, wages:39, homes:45, rate16:1.8, rate26:3.7, solid:false},
  FR: {name:"France",        cur:"EUR", sym:"€",  locale:"fr-FR", prices:26, wages:28, homes:25, rate16:1.6, rate26:3.4, solid:false},
  IT: {name:"Italy",         cur:"EUR", sym:"€",  locale:"it-IT", prices:26, wages:22, homes:12, rate16:2.1, rate26:3.6, solid:false},
  ES: {name:"Spain",         cur:"EUR", sym:"€",  locale:"es-ES", prices:29, wages:32, homes:60, rate16:2.0, rate26:3.3, solid:false},
  NL: {name:"Netherlands",   cur:"EUR", sym:"€",  locale:"nl-NL", prices:39, wages:42, homes:90, rate16:2.4, rate26:4.0, solid:false},
  BE: {name:"Belgium",       cur:"EUR", sym:"€",  locale:"nl-BE", prices:37, wages:42, homes:42, rate16:2.1, rate26:3.5, solid:false},
  AT: {name:"Austria",       cur:"EUR", sym:"€",  locale:"de-AT", prices:40, wages:44, homes:70, rate16:1.9, rate26:3.8, solid:false},
  IE: {name:"Ireland",       cur:"EUR", sym:"€",  locale:"en-IE", prices:27, wages:40, homes:75, rate16:3.3, rate26:4.0, solid:false},
  PT: {name:"Portugal",      cur:"EUR", sym:"€",  locale:"pt-PT", prices:30, wages:45, homes:130,rate16:1.9, rate26:3.4, solid:false},
  GR: {name:"Greece",        cur:"EUR", sym:"€",  locale:"el-GR", prices:25, wages:25, homes:70, rate16:2.8, rate26:4.0, solid:false},
  FI: {name:"Finland",       cur:"EUR", sym:"€",  locale:"fi-FI", prices:28, wages:28, homes:-5, rate16:1.2, rate26:3.6, solid:false},
  EE: {name:"Estonia",       cur:"EUR", sym:"€",  locale:"et-EE", prices:64, wages:105,homes:125,rate16:2.3, rate26:4.7, solid:true},
  CY: {name:"Cyprus",        cur:"EUR", sym:"€",  locale:"el-CY", prices:22, wages:26, homes:30, rate16:2.6, rate26:4.3, solid:true},
  SE: {name:"Sweden",        cur:"SEK", sym:"kr", locale:"sv-SE", prices:35, wages:33, homes:40, rate16:1.7, rate26:4.2, solid:false},
  DK: {name:"Denmark",       cur:"DKK", sym:"kr", locale:"da-DK", prices:27, wages:32, homes:45, rate16:1.5, rate26:4.0, solid:false},
  NO: {name:"Norway",        cur:"NOK", sym:"kr", locale:"nb-NO", prices:40, wages:45, homes:45, rate16:2.5, rate26:5.3, solid:false},
  CH: {name:"Switzerland",   cur:"CHF", sym:"CHF",locale:"de-CH", prices:8,  wages:12, homes:40, rate16:1.5, rate26:2.2, solid:false},
  PL: {name:"Poland",        cur:"PLN", sym:"zł", locale:"pl-PL", prices:57, wages:100,homes:100,rate16:4.4, rate26:7.5, solid:false},
  CZ: {name:"Czechia",       cur:"CZK", sym:"Kč", locale:"cs-CZ", prices:55, wages:85, homes:120,rate16:2.1, rate26:5.0, solid:false},
  HU: {name:"Hungary",       cur:"HUF", sym:"Ft", locale:"hu-HU", prices:76, wages:150,homes:190,rate16:5.0, rate26:6.6, solid:true},
  RO: {name:"Romania",       cur:"RON", sym:"lei",locale:"ro-RO", prices:64, wages:140,homes:80, rate16:3.8, rate26:5.8, solid:true}
};
/* DATA:END */
window.HEADLINE = DATA;
