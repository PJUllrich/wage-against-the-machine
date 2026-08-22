/**
 * A very small xlsx reader — enough to read a statistics agency's time series
 * spreadsheet, and nothing more.
 *
 * The ABS and RBA publish their tables as xlsx and only as xlsx. Every other
 * file in sources/ is a CSV, and adding a spreadsheet library to a repository
 * whose only runtime dependency is workers-og would cost more than this does.
 * An xlsx is a zip of XML: unzip it with node:zlib, pull the shared string
 * table and one sheet, and read the cells.
 *
 * What it does not do: formulas (the cached value is used), styles beyond
 * telling a date from a number, merged cells, or anything at all with the
 * second and later sheets of a workbook unless asked for by name.
 */

import { inflateRawSync } from "node:zlib";

/* ---------- zip ---------- */

/**
 * Entries of a zip file, by name. Read from the central directory rather than
 * by scanning local headers, because a local header may say the sizes are in a
 * trailing descriptor and the central directory always knows them.
 */
function unzip(buf) {
  const EOCD = 0x06054b50, CEN = 0x02014b50;
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== EOCD) end--;   /* skip any zip comment */
  if (end < 0) throw new Error("not a zip file");
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== CEN) throw new Error("bad central directory");
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    /* The local header repeats the name and carries its own extra field, whose
       length differs from the central one, so both have to be read here. */
    const lNameLen = buf.readUInt16LE(offset + 26), lExtraLen = buf.readUInt16LE(offset + 28);
    const start = offset + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + compSize);
    files[name] = method === 0 ? raw : inflateRawSync(raw);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

/* ---------- xml ---------- */

const ENTITY = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescape = s => s.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (m, e) =>
  e[0] === "#"
    ? String.fromCodePoint(parseInt(e[1] === "x" ? e.slice(2) : e.slice(1), e[1] === "x" ? 16 : 10))
    : (ENTITY[e] ?? m));

/** Every <t> in a shared-string item, joined: rich text splits one string across runs. */
const textOf = xml => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => unescape(m[1])).join("");

/* ---------- dates ---------- */

/**
 * Excel keeps a date as days since 1899-12-30 — the 30th, not the 31st, because
 * the serial numbers pretend 1900 was a leap year and this offset cancels it for
 * every date after February 1900, which is every date a statistics agency
 * publishes.
 */
export const excelDate = serial => new Date(Math.round(serial * 86400000) + Date.UTC(1899, 11, 30));

/** Number formats that mean "date": the built-in date codes, or any custom one with y/m/d in it. */
function dateFormats(files) {
  const styles = files["xl/styles.xml"];
  const isDate = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
  if (styles) {
    const xml = styles.toString("utf8");
    for (const m of xml.matchAll(/<numFmt[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g))
      if (/[ymd]/.test(m[2].replace(/\[[^\]]*\]/g, "").replace(/"[^"]*"/g, ""))) isDate.add(Number(m[1]));
    const block = xml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/);
    if (block) {
      return [...block[1].matchAll(/<xf\b[^>]*\/?>/g)]
        .map(x => Number((x[0].match(/numFmtId="(\d+)"/) || [, 0])[1]))
        .map(id => isDate.has(id));
    }
  }
  return [];
}

/* ---------- sheets ---------- */

const colOf = ref => {                       /* "BC12" → 54 */
  let n = 0;
  for (const c of ref) {
    if (c < "A" || c > "Z") break;
    n = n * 26 + (c.charCodeAt(0) - 64);
  }
  return n - 1;
};

/**
 * Read one sheet of an xlsx as an array of rows of cell values: a string, a
 * number, a Date, or null for a blank. Rows are dense — a row the file skips
 * entirely comes back as an empty array, and a gap in the middle of a row comes
 * back as nulls — so a column index means the same thing on every row.
 *
 *   readSheet(buffer)               first sheet
 *   readSheet(buffer, "Data1")      by name
 */
export function readSheet(buf, sheetName) {
  const files = unzip(buf);
  const wb = files["xl/workbook.xml"].toString("utf8");
  const rels = files["xl/_rels/workbook.xml.rels"].toString("utf8");
  const sheets = [...wb.matchAll(/<sheet\b[^>]*\/?>/g)].map(m => ({
    name: unescape((m[0].match(/name="([^"]*)"/) || [, ""])[1]),
    rid: (m[0].match(/r:id="([^"]*)"/) || [, ""])[1],
  }));
  const sheet = sheetName ? sheets.find(s => s.name === sheetName) : sheets[0];
  if (!sheet) throw new Error(`no sheet ${JSON.stringify(sheetName)}; have ${sheets.map(s => s.name).join(", ")}`);
  const target = (rels.match(new RegExp(`<Relationship[^>]*Id="${sheet.rid}"[^>]*Target="([^"]*)"`)) || [])[1];
  if (!target) throw new Error(`no relationship for sheet ${sheet.name}`);
  const key = ("xl/" + target).replace(/^xl\/\//, "").replace(/\/\.\//g, "/");
  const xml = (files[key] || files[target.replace(/^\//, "")]).toString("utf8");

  const shared = files["xl/sharedStrings.xml"]
    ? [...files["xl/sharedStrings.xml"].toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => textOf(m[1]))
    : [];
  const isDateStyle = dateFormats(files);

  const rows = [];
  for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const n = Number((rm[1].match(/\br="(\d+)"/) || [, rows.length + 1])[1]);
    const cells = [];
    for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1], body = cm[2] || "";
      const at = colOf((attrs.match(/\br="([A-Z]+\d+)"/) || [, ""])[1]);
      const type = (attrs.match(/\bt="([^"]*)"/) || [, "n"])[1];
      const style = Number((attrs.match(/\bs="(\d+)"/) || [, -1])[1]);
      let v;
      if (type === "s") v = shared[Number((body.match(/<v>([\s\S]*?)<\/v>/) || [, ""])[1])] ?? null;
      else if (type === "inlineStr") v = textOf(body);
      else if (type === "str") v = unescape((body.match(/<v>([\s\S]*?)<\/v>/) || [, ""])[1]);
      else {
        const raw = (body.match(/<v>([\s\S]*?)<\/v>/) || [, ""])[1];
        if (raw === "") v = null;
        else if (type === "b") v = raw === "1";
        else {
          const num = Number(raw);
          v = isDateStyle[style] && Number.isFinite(num) ? excelDate(num) : num;
        }
      }
      while (cells.length < at) cells.push(null);
      cells[at] = v;
    }
    while (rows.length < n - 1) rows.push([]);
    rows[n - 1] = cells;
  }
  return rows;
}
