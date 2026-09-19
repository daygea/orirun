/* scripts/backfill-alignment.js
 * ─────────────────────────────────────────────────────────────
 *  One-time pass: score content-alignment for every already-VERIFIED
 *  interpretation that doesn't yet have an alignmentScore, so existing readings
 *  benefit immediately (not only newly-verified ones going forward).
 *
 *  Each (verse, orientation) is scored ONCE by the AI (via alignmentService,
 *  which caches), and the number is written onto the interpretation. Safe to
 *  re-run: it skips interpretations that already have a score. Rate-limited so
 *  it doesn't hammer the AI provider.
 *
 *  USAGE (from the backend root, where .env with MONGO_URI + the AI key live):
 *    node scripts/backfill-alignment.js            # score all unscored
 *    node scripts/backfill-alignment.js --rescore  # re-score everything
 *    node scripts/backfill-alignment.js --limit 50 # cap how many this run
 * ───────────────────────────────────────────────────────────── */

require("dotenv").config();
const mongoose = require("mongoose");
const Verse = require("../models/Verse");
const alignment = require("../services/alignmentService");

const MONGO_URI = process.env.MONGO_URI;
const RESCORE = process.argv.includes("--rescore");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i !== -1 ? parseInt(process.argv[i + 1], 10) || Infinity : Infinity;
})();
const DELAY_MS = 400; // gentle pacing between AI calls

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!MONGO_URI) {
    console.error("✖ No MONGO_URI in env. Run from the backend root where your .env lives.");
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI, { dbName: "orirun", serverSelectionTimeoutMS: 10000 });
  console.log("🔌 Connected. Scanning verified interpretations…");

  const verses = await Verse.find({}).lean();
  let scored = 0, skipped = 0, failed = 0, considered = 0;

  for (const verse of verses) {
    const interps = verse.interpretations || {};
    let dirty = false;
    const nextInterps = { ...interps };

    for (const [orientation, it] of Object.entries(interps)) {
      if (!it || it.status !== "verified") continue;         // only verified
      considered++;
      if (!RESCORE && typeof it.alignmentScore === "number") { skipped++; continue; }
      if (considered > LIMIT) break;

      // scoreVerseOrientation reads the interpretation text off the verse.
      const score = await alignment.scoreVerseOrientation(verse, orientation);
      await sleep(DELAY_MS);

      if (score == null) {
        failed++;
        console.warn(`  · could not score ${verse.id} / ${orientation}`);
        continue;
      }
      nextInterps[orientation] = { ...it, alignmentScore: score };
      dirty = true;
      scored++;
      console.log(`  ✓ ${verse.id} / ${orientation} → ${score.toFixed(2)}`);
    }

    if (dirty) {
      await Verse.updateOne({ _id: verse._id }, { $set: { interpretations: nextInterps } });
    }
    if (considered > LIMIT) break;
  }

  console.log(`\nDone. scored=${scored} skipped(already had a score)=${skipped} failed=${failed}`);
  await mongoose.disconnect();
  console.log("🔌 Disconnected.");
}

main().catch((err) => {
  console.error("✖ Backfill failed:", err);
  process.exit(1);
});
