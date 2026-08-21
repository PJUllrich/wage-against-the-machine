#!/usr/bin/env node
/**
 * Copy the deployable files into dist/.
 *
 *   node scripts/build-site.mjs
 *
 * There is no bundling, minifying or transforming here, and there should not
 * be: the pages are meant to be readable as shipped. This exists only so the
 * deploy has an explicit directory, and so CLAUDE.md, README.md, scripts/ and
 * .git never end up served at the public URL.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

/* Everything the browser needs, and nothing else. */
const SHIP = ["index.html", "data.html", "sources.html", "styles.css", "data"];

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

let files = 0, bytes = 0;
for (const entry of SHIP) {
  const from = path.join(ROOT, entry);
  if (!fs.existsSync(from)) {
    console.error(`Missing ${entry}. Run: node scripts/build-data.mjs`);
    process.exit(1);
  }
  fs.cpSync(from, path.join(DIST, entry), { recursive: true });
  for (const f of fs.statSync(from).isDirectory()
    ? fs.readdirSync(from).map(n => path.join(from, n))
    : [from]) { files++; bytes += fs.statSync(f).size; }
}

console.log(`dist/ ready — ${files} files, ${(bytes / 1024).toFixed(0)} KB`);
