#!/usr/bin/env node
/* scripts/bump-build.js
 * ─────────────────────────────────────────────────────────────
 *  Stamps sw.js's BUILD constant with the current date-time, so returning
 *  users always fetch fresh files after a deploy — WITHOUT you remembering to
 *  hand-edit it. This was a recurring "my change didn't take" trap; running
 *  this removes the human step.
 *
 *  RUN IT RIGHT BEFORE YOU DEPLOY (commit/push), from the frontend root:
 *      node scripts/bump-build.js
 *  or, if you use npm:
 *      npm run deploy         (see package.json — bumps, then you push)
 *
 *  It rewrites ONLY the BUILD line in sw.js and prints the new value. Safe to
 *  run repeatedly; each run produces a new unique stamp.
 * ───────────────────────────────────────────────────────────── */

const fs = require("fs");
const path = require("path");

// sw.js sits at the frontend root; this script lives in <root>/scripts/.
const SW_PATH = path.resolve(__dirname, "..", "sw.js");

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  // e.g. 2026-09-19-1432-07  (date + HHMM + seconds → always unique per run)
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-` +
         `${p(d.getHours())}${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function main() {
  let src;
  try {
    src = fs.readFileSync(SW_PATH, "utf8");
  } catch (e) {
    console.error(`✖ Could not read ${SW_PATH}. Run this from the frontend root (where sw.js lives).`);
    process.exit(1);
  }

  const newBuild = stamp();
  // Match:  const BUILD  = "anything";   (any spacing / quote style)
  const re = /(const\s+BUILD\s*=\s*)(['"])(.*?)\2\s*;/;
  if (!re.test(src)) {
    console.error("✖ Could not find the `const BUILD = \"...\";` line in sw.js. Nothing changed.");
    process.exit(1);
  }
  const prev = src.match(re)[3];
  const out = src.replace(re, `$1"${newBuild}";`);
  fs.writeFileSync(SW_PATH, out);
  console.log(`✓ sw.js BUILD bumped: ${prev}  →  ${newBuild}`);
  console.log("  Now commit & push (or run your deploy) so users pick up the new files.");
}

main();
