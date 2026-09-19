// routes/babalawoRoutes.js
// ─────────────────────────────────────────────────────────────
//  Babaláwo / Elder authoring surface
//  A narrow, purpose-built API for contributors to author verses through
//  guided forms — WITHOUT exposing the generic superadmin content routes.
//
//  Hard invariants (enforced on every route, not just in the UI):
//    • Scope: eseIfa verses ONLY. No other collection is reachable here.
//    • Own work only: a contributor may read/edit/​add-interpretations to a
//      verse ONLY if they authored it. Someone else's verse → 403.
//    • Draft only: a contributor may edit a verse only while it is unverified
//      (draft/reviewed). Once an elder verifies it, it locks to the author.
//    • NEVER verify: nothing here sets verification.status to "verified" or
//      an interpretation's status to "verified". Verification is a separate
//      act, done by an elder through the admin surface — the four-eyes gate.
//    • Authorship is stamped server-side from the session, never trusted
//      from the request body — a contributor can't claim someone else's name.
//
//  Mount (in server.js):
//    const babalawoRoutes = require("./routes/babalawoRoutes");
//    app.use("/api/studio", requireRole(["babalawo", "elder"]), babalawoRoutes);
//  → endpoints live under /api/studio/…  (superadmin passes too, by override)
// ─────────────────────────────────────────────────────────────

const express = require("express");
const router = express.Router();

const repo = require("../utils/contentRepository");
const { buildVerse } = require("../utils/verseBuilder");
const {
  validateVerse,
  VALID_ORIENTATIONS,
  IRE_ORIENTATIONS,
  AYEWO_ORIENTATIONS,
} = require("../utils/verseSchema");

// Tone-mark helper — babaláwos entering raw Yorùbá need diacritic help. This
// only suggests (never saves), so it's safe for contributors.
let suggestDiacritics = null;
try { ({ suggestDiacritics } = require("../services/diacriticSuggestService")); } catch { /* optional */ }

// AI interpretation drafter — drafts NOTES for one orientation for the
// contributor to rewrite in their own words. Suggestion only; never saved.
let draftOne = null;
try { ({ draftOne } = require("../services/interpretationDraftService")); } catch { /* optional */ }

let notifyCorrection = null;
let notifySendBack = null;
let notifyElderRequest = null;
try { ({ notifyCorrection, notifySendBack, notifyElderRequest } = require("../services/correctionNotifyService")); } catch { /* optional */ }

let OpsAudit = null;
try { OpsAudit = require("../models/OpsAudit"); } catch { /* optional */ }
let AdminUser = null;
try { AdminUser = require("../models/AdminUser"); } catch { /* optional */ }
let _alignment = null;
try { _alignment = require("../services/alignmentService"); } catch { /* optional */ }
async function auditCorrection(target, actor, note) {
  if (!OpsAudit) return;
  try { await OpsAudit.create({ action: "verse.reopen", target, actor, note }); } catch { /* best-effort */ }
}

const COLLECTION = "eseIfa";

// The signed-in identity — always from the session, never the body.
function actorName(req) {
  return req.user?.username || req.user?.email || null;
}

// Author stamp lives in provenance.contributor.account — the account
// username, distinct from the display name. This is what "own work" checks,
// so a display-name change never orphans authorship.
function authorAccountOf(verse) {
  return verse?.provenance?.contributor?.account || null;
}

function isOwner(verse, req) {
  const me = actorName(req);
  return !!me && authorAccountOf(verse) === me;
}

// Elder-only capability. superadmin passes too (the mount allows it), so the
// verification surface is reachable by elders and superadmins, not babaláwos.
function isElder(req) {
  const r = req.user?.role;
  return r === "elder" || r === "superadmin";
}

// Superadmin — full operational authority. May self-verify (four-eyes is waived
// for them), but every such act is flagged selfVerified and remains re-openable
// by any elder, so the power is accountable, never final. See the verify routes.
function isSuperadmin(req) {
  return req.user?.role === "superadmin";
}

// The four-eyes rule: a verifier may NOT verify content they themselves
// authored. This is the invariant the whole trust model rests on — a
// "verified" badge must mean a DIFFERENT named person vouched for the work.
function authoredByMe(verse, req) {
  return authorAccountOf(verse) === actorName(req);
}

function isVerified(verse) {
  return verse?.verification?.status === "verified";
}

// A lightweight fingerprint of the editable content of a verse — the fields two
// elders might edit concurrently (verse text, translations, and each
// interpretation's text). Used for optimistic-concurrency: the UI captures this
// when it opens the editor and sends it back on save; if it no longer matches,
// someone else edited in between, so we warn before overwriting their work.
// Deliberately ignores verification/status churn — we only care about content
// collisions, not a re-verify happening alongside.
// A short extract of the verse — the first line or two of the Yorùbá — so the
// management lists (My Verses, To Verify) can be identified by their words, not
// just "Odù · N interpretations". Kept short to keep list payloads light.
function verseExtract(v, maxLen = 120) {
  const lines = Array.isArray(v?.yoruba) ? v.yoruba.filter((l) => String(l).trim()) : [];
  if (!lines.length) return "";
  let ex = lines[0].trim();
  if (ex.length < 60 && lines[1]) ex += " " + lines[1].trim(); // pull a 2nd line if the 1st is short
  return ex.length > maxLen ? ex.slice(0, maxLen - 1).trim() + "…" : ex;
}

function contentFingerprint(v) {
  if (!v || typeof v !== "object") return "";
  const parts = [];
  parts.push((v.yoruba || []).join("\n"));
  parts.push((v.english || []).join("\n"));
  const interps = (v.interpretations && typeof v.interpretations === "object") ? v.interpretations : {};
  for (const ori of Object.keys(interps).sort()) {
    parts.push(ori + "::" + ((interps[ori] && interps[ori].text) || ""));
  }
  const s = parts.join("\u241F"); // unit separator, unlikely in content
  // Small, fast, non-cryptographic hash (djb2) — collision-resistant enough to
  // detect "did the content change", which is all we need.
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

// Shape a verse for the authoring UI — the fields a contributor works with.
function authoringShape(v) {
  const interps = (v.interpretations && typeof v.interpretations === "object") ? v.interpretations : {};
  return {
    id: v.id,
    odu: v.odu || "",
    title: v.title || "",
    yoruba: Array.isArray(v.yoruba) ? v.yoruba : [],
    english: Array.isArray(v.english) ? v.english : [],
    practicalNotes: Array.isArray(v.practicalNotes) ? v.practicalNotes : [],
    themes: Array.isArray(v.themes) ? v.themes : [],
    media: Array.isArray(v.media) ? v.media : [],
    context: v.context || "",
    verseStatus: v.verification?.status || "draft",
    selfVerified: v.verification?.selfVerified === true, // superadmin verified own work
    contributorName: v.provenance?.contributor?.name || "",
    lineage: v.provenance?.lineage || "",
    region: v.provenance?.region || "",
    // Verse-pending (Ase Ifá) signals — needed so the Review panel can show the
    // orientation + verse completion controls for a verse-optional record.
    versePending: v.versePending === true,
    hasVerseText: v.hasVerseText === false ? false : (Array.isArray(v.yoruba) && v.yoruba.length > 0),
    provenance: { tier: v.provenance?.tier || "" },
    interpretations: Object.entries(interps).map(([ori, it]) => ({
      orientation: ori,
      text: it?.text || "",
      status: it?.status || "draft",
      by: it?.interpretedBy?.name || "",
    })),
    editable: !isVerified(v), // contributor can edit only while unverified
    fingerprint: contentFingerprint(v), // for optimistic-concurrency on save
    reviewNotes: Array.isArray(v.reviewNotes) ? v.reviewNotes : [],
  };
}

// ── The orientations catalogue (for the form's picker) ────────
router.get("/orientations", (req, res) => {
  res.json({ ire: IRE_ORIENTATIONS, ayewo: AYEWO_ORIENTATIONS, all: VALID_ORIENTATIONS });
});

// ── MY VERSES — everything this contributor authored ──────────
router.get("/my-verses", async (req, res) => {
  try {
    const me = actorName(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    // Query only THIS contributor's verses (indexed on contributor.account),
    // optionally narrowed by a search term. This is one person's own work, so
    // the set is bounded — we can rank-sort it in JS and page the result while
    // keeping the exact attention ordering consistent across pages.
    const filter = {
      "provenance.contributor.account": me,
      ...repo.verseSearchFilter(req.query.q),
    };
    const { rows: all } = await repo.queryVerses({ filter });
    // Order by what needs the contributor's attention. needs_revision first
    // (an elder is waiting on them), then in-progress (draft/reviewed), then
    // verified last (done — kept visible so the ledger stays complete, but out
    // of the way). Nothing is filtered by status: My Verses is the
    // contributor's full, lossless record of their own authored work.
    const RANK = { needs_revision: 0, reviewed: 1, draft: 2, verified: 3 };
    function attentionRank(v) {
      const vs = v.verification?.status || "draft";
      // A verse whose own status is fine but which has a sent-back
      // interpretation still needs attention — rank it with needs_revision.
      const anyInterpRevision = Object.values(v.interpretations || {})
        .some((it) => it?.status === "needs_revision");
      if (vs === "needs_revision" || anyInterpRevision) return 0;
      return RANK[vs] ?? 2;
    }
    const ranked = all
      .sort((a, b) => {
        // Primary: attention rank (needs_revision first, verified last).
        const r = attentionRank(a) - attentionRank(b);
        if (r !== 0) return r;
        // Tiebreak: newest first within the same rank, so a freshly-added
        // verse appears at the top of its group rather than buried at the end.
        const ta = new Date(a.createdAt || a.provenance?.collectedAt || 0).getTime();
        const tb = new Date(b.createdAt || b.provenance?.collectedAt || 0).getTime();
        return tb - ta;
      });
    const total = ranked.length;
    const mine = ranked
      .slice((page - 1) * limit, (page - 1) * limit + limit)
      .map((v) => ({
        id: v.id,
        odu: v.odu || "",
        title: v.title || "",
        extract: verseExtract(v),
        verseStatus: v.verification?.status || "draft",
        interpretationCount: v.interpretations ? Object.keys(v.interpretations).length : 0,
        reviewNoteCount: Array.isArray(v.reviewNotes) ? v.reviewNotes.length : 0,
        // The actual unresolved feedback, so the contributor reads it on the
        // card without opening the verse — visible at a glance. Excludes re-open
        // audit notes (history, not a revision task for the contributor).
        openNotes: (Array.isArray(v.reviewNotes) ? v.reviewNotes : [])
          .filter((n) => !n.resolved && n.kind !== "reopen" && !/^Re-opened for correction/.test(n.note || ""))
          .map((n) => ({ orientation: n.orientation || null, note: n.note || "", by: n.by || "" })),
        editable: !isVerified(v),
      }));
    res.json({ verses: mine, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── READ ONE (own only) ───────────────────────────────────────
router.get("/verses/:id", async (req, res) => {
  try {
    const verse = await repo.getItem(COLLECTION, req.params.id);
    if (!verse) return res.status(404).json({ error: "Verse not found." });
    if (!isOwner(verse, req) && !isElder(req)) return res.status(403).json({ error: "This verse belongs to another contributor." });
    res.json({ verse: authoringShape(verse) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CREATE a draft verse ──────────────────────────────────────
//  { odu, yoruba:[], english:[], title?, themes?, lineage?, region? }
router.post("/verses", async (req, res) => {
  try {
    const me = actorName(req);
    if (!me) return res.status(401).json({ error: "No signed-in account." });

    const { odu, yoruba, english, practicalNotes, title, themes, lineage, region, media } = req.body || {};
    if (!odu || typeof odu !== "string") return res.status(400).json({ error: "Choose an Odù for this verse." });
    const yLines = Array.isArray(yoruba) ? yoruba.map((l) => String(l).trim()).filter(Boolean) : [];
    if (!yLines.length) return res.status(400).json({ error: "Enter the verse in Yorùbá (at least one line)." });
    const eLines = Array.isArray(english) ? english.map((l) => String(l).trim()).filter(Boolean) : [];
    const pLines = Array.isArray(practicalNotes) ? practicalNotes.map((l) => String(l).trim()).filter(Boolean) : [];

    const slug = String(odu).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const id = `${slug}-b${Date.now().toString(36)}`;

    const themeList = Array.isArray(themes) ? themes.map((t) => String(t).trim()).filter(Boolean) : [];

    const verse = buildVerse({
      id,
      odu,
      title,
      yoruba: yLines,
      english: eLines,
      practicalNotes: pLines,
      themes: themeList,
      context: "Contributed through the Orírùn studio; pending elder verification.",
      lineage,
      region,
      source: { type: "oral", detail: "Contributed by a babaláwo/ìyánífá through the Orírùn studio." },
      // name = display credit; account = the auth username used for own-work checks.
      contributor: { name: me, account: me, role: "babaláwo contributor" },
      status: "draft", // a contributor never self-verifies
      media: media || "",              // optional recording URL (sanitized in buildVerse)
      mediaAuthor: me,
    });

    // Validate against the schema before persisting so the form can't produce
    // an invalid verse. (Drafts never carry verified-only requirements, so the
    // schema's verified-gate checks don't fire here.)
    const v = validateVerse(verse);
    if (v.errors && v.errors.length) {
      return res.status(400).json({ error: "Verse didn't pass validation.", validationErrors: v.errors });
    }

    const result = await repo.createItem(COLLECTION, null, verse, me);
    res.status(201).json({ message: "Draft verse saved.", id, verse: authoringShape(verse), ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, validationErrors: err.validationErrors });
  }
});

// ── EDIT own draft verse ──────────────────────────────────────
//  Only the verse text/meta — never the verification state.
router.put("/verses/:id", async (req, res) => {
  try {
    const verse = await repo.getItem(COLLECTION, req.params.id);
    if (!verse) return res.status(404).json({ error: "Verse not found." });
    if (!isOwner(verse, req) && !isElder(req)) return res.status(403).json({ error: "This verse belongs to another contributor." });
    if (isVerified(verse)) return res.status(409).json({ error: "This verse is verified — re-open it for correction first (elders only)." });

    // Optimistic-concurrency: if the client tells us which version it started
    // from (baseFingerprint) and the verse has changed since — another elder
    // edited it in between — refuse and let the UI warn, unless the user has
    // chosen to override (force:true). Absent baseFingerprint, we skip the check
    // (older clients, or callers that don't opt in).
    const baseFingerprint = req.body?.baseFingerprint;
    if (baseFingerprint && !req.body?.force) {
      const currentFp = contentFingerprint(verse);
      if (String(baseFingerprint) !== String(currentFp)) {
        return res.status(409).json({
          error: "This verse was edited by someone else since you opened it.",
          reason: "stale_edit",
          currentFingerprint: currentFp,
        });
      }
    }

    const { yoruba, english, practicalNotes, title, themes, odu, lineage, region, media } = req.body || {};
    const next = { ...verse };
    if (odu && typeof odu === "string") next.odu = odu;
    if (typeof title === "string") next.title = title.trim() || next.title;
    if (Array.isArray(yoruba)) next.yoruba = yoruba.map((l) => String(l).trim()).filter(Boolean);
    if (Array.isArray(english)) {
      const e = english.map((l) => String(l).trim()).filter(Boolean);
      if (e.length) next.english = e; else delete next.english; // empty → absent, not []
    }
    if (Array.isArray(practicalNotes)) {
      const p = practicalNotes.map((l) => String(l).trim()).filter(Boolean);
      if (p.length) next.practicalNotes = p; else delete next.practicalNotes; // empty → absent
    }
    if (Array.isArray(themes)) {
      const t = themes.map((x) => String(x).trim()).filter(Boolean);
      if (t.length) next.themes = t; else delete next.themes;
    }
    // Media: when the field is present, re-sanitize and set it (empty string
    // clears it). Absent field leaves existing media untouched.
    if (media !== undefined) {
      const { sanitizeMediaUrl } = require("../utils/mediaUrl");
      if (!String(media).trim()) {
        next.media = [];
      } else {
        const s = sanitizeMediaUrl(media);
        if (!s.ok) return res.status(400).json({ error: `Recording link: ${s.reason}` });
        next.media = [{ url: s.url, type: s.type, author: verse.provenance?.contributor?.name || "" }];
      }
    }
    if (!next.yoruba.length) return res.status(400).json({ error: "The verse needs at least one Yorùbá line." });

    // [TRANSITION] A verse-optional Ase Ifá record becomes a FULL verse the
    // moment its ẹsẹ Ifá is transcribed. Flip the verse-optional flags so the
    // record is no longer "pending" — which correctly makes title + lineage
    // required from here on (they describe the now-present verse). The form
    // collects them; see the clearer error below.
    const wasVerseOptional =
      verse.versePending === true ||
      verse.hasVerseText === false ||
      verse.provenance?.tier === "verse-pending";
    if (wasVerseOptional && next.yoruba.length) {
      next.hasVerseText = true;
      next.versePending = false;
      if (next.provenance && next.provenance.tier === "verse-pending") {
        next.provenance = { ...next.provenance };
        delete next.provenance.tier;
      }
    }

    // Preserve authorship. Verification: if the elder had sent this verse back
    // for revision, editing it clears that flag back to draft (the contributor
    // has responded) and marks the matching verse-level note resolved.
    next.provenance = { ...verse.provenance };
    if (lineage) next.provenance.lineage = lineage;
    // Always record a lineage so provenance is never missing — default to "Other"
    // when neither the request nor the existing record supplies one. Never blocks.
    if (!next.provenance.lineage) next.provenance.lineage = "Other";
    if (region !== undefined) next.provenance.region = region || null;
    next.verification = { ...verse.verification };
    if (next.verification.status === "needs_revision") {
      next.verification.status = "draft";
      next.reviewNotes = (Array.isArray(verse.reviewNotes) ? verse.reviewNotes : [])
        .map((n) => (!n.orientation && !n.resolved ? { ...n, resolved: true } : n));
    }

    const v = validateVerse(next);
    if (v.errors && v.errors.length) {
      return res.status(400).json({ error: "Verse didn't pass validation.", validationErrors: v.errors });
    }

    const result = await repo.updateItem(COLLECTION, req.params.id, next, actorName(req));
    res.json({ message: "Verse updated.", verse: authoringShape(next), ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, validationErrors: err.validationErrors });
  }
});

// ── ADD / EDIT an interpretation for an orientation (own draft) ──
//  { orientation, text }  — always saved as draft; never verified here.
router.put("/verses/:id/interpretations/:orientation", async (req, res) => {
  try {
    const orientation = req.params.orientation;
    if (!VALID_ORIENTATIONS.includes(orientation)) {
      return res.status(400).json({ error: `Unknown orientation "${orientation}".` });
    }
    const verse = await repo.getItem(COLLECTION, req.params.id);
    if (!verse) return res.status(404).json({ error: "Verse not found." });
    if (!isOwner(verse, req) && !isElder(req)) return res.status(403).json({ error: "This verse belongs to another contributor." });

    // Optimistic-concurrency at the interpretation level: if the client sends the
    // text it started from (baseText) and the stored text has since changed,
    // another elder edited this interpretation in between — warn rather than
    // silently overwrite, unless force:true.
    const existingIt = verse.interpretations && verse.interpretations[orientation];
    if (typeof req.body?.baseText === "string" && !req.body?.force && existingIt) {
      const currentText = String(existingIt.text || "");
      if (req.body.baseText !== currentText) {
        return res.status(409).json({
          error: "This interpretation was edited by someone else since you opened it.",
          reason: "stale_edit",
          currentText,
        });
      }
    }

    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ error: "Write the interpretation before saving." });

    const me = actorName(req);
    const interps = { ...(verse.interpretations || {}) };
    const existing = interps[orientation] || {};
    // Protection is per-interpretation, NOT per-verse: an interpretation may be
    // edited unless THAT interpretation is itself verified. A verse can be
    // verified overall while one of its interpretations has been sent back for
    // revision (status needs_revision) — the contributor must be able to fix
    // exactly that one. Only a verified interpretation is locked, so an elder's
    // sign-off is never silently overwritten.
    if (existing.status === "verified") {
      return res.status(409).json({ error: "This orientation's interpretation is already verified and can't be changed here." });
    }
    interps[orientation] = {
      text: text,
      status: "draft", // never verified from this surface; also clears needs_revision
      interpretedBy: { name: me, account: me, role: "babaláwo contributor" },
      interpretedAt: new Date().toISOString(),
    };

    const next = { ...verse, interpretations: interps };
    // If an elder had sent this orientation back, editing it resolves that note.
    if (existing.status === "needs_revision") {
      next.reviewNotes = (Array.isArray(verse.reviewNotes) ? verse.reviewNotes : [])
        .map((n) => (n.orientation === orientation && !n.resolved ? { ...n, resolved: true } : n));
    }
    const v = validateVerse(next);
    if (v.errors && v.errors.length) {
      return res.status(400).json({ error: "Interpretation didn't pass validation.", validationErrors: v.errors });
    }

    const result = await repo.updateItem(COLLECTION, req.params.id, next, me);
    res.json({ message: `Interpretation for ${orientation} saved.`, verse: authoringShape(next), ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, validationErrors: err.validationErrors });
  }
});

// ── REMOVE an interpretation (own draft, and only if not verified) ──
router.delete("/verses/:id/interpretations/:orientation", async (req, res) => {
  try {
    const orientation = req.params.orientation;
    const verse = await repo.getItem(COLLECTION, req.params.id);
    if (!verse) return res.status(404).json({ error: "Verse not found." });
    if (!isOwner(verse, req) && !isElder(req)) return res.status(403).json({ error: "This verse belongs to another contributor." });

    const interps = { ...(verse.interpretations || {}) };
    if (!interps[orientation]) return res.status(404).json({ error: "No interpretation for that orientation." });
    if (interps[orientation].status === "verified") {
      return res.status(409).json({ error: "A verified interpretation can't be removed here." });
    }
    delete interps[orientation];

    const next = { ...verse, interpretations: interps };
    const result = await repo.updateItem(COLLECTION, req.params.id, next, actorName(req));
    res.json({ message: `Interpretation for ${orientation} removed.`, verse: authoringShape(next), ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, validationErrors: err.validationErrors });
  }
});

// ── Tone-mark (diacritic) suggestion — suggest only, never saves ──
//  { yoruba: [...lines] } → { suggestion: [...], unsure }
router.post("/suggest-diacritics", async (req, res) => {
  try {
    if (!suggestDiacritics) return res.status(404).json({ error: "Tone-mark helper is not available." });
    const lines = Array.isArray(req.body?.yoruba) ? req.body.yoruba.filter(Boolean) : [];
    if (!lines.length) return res.status(400).json({ error: "Enter the Yorùbá text first." });
    const result = await suggestDiacritics(lines);
    res.json({ suggestion: result.suggestion, unsure: result.unsure });
  } catch (err) {
    res.status(err.http || 502).json({ error: err.message, reason: err.reason || "suggest_failed" });
  }
});

// ── AI draft for ONE orientation — a starting point to rewrite, never saved ──
//  Returns { speaks, text, notes }. The contributor rewrites it in their own
//  words and saves through the normal interpretation endpoint.
router.post("/verses/:id/draft-interpretation/:orientation", async (req, res) => {
  try {
    if (!draftOne) return res.status(404).json({ error: "AI draft helper is not available." });
    const orientation = req.params.orientation;
    if (!VALID_ORIENTATIONS.includes(orientation)) {
      return res.status(400).json({ error: `Unknown orientation "${orientation}".` });
    }
    const verse = await repo.getItem(COLLECTION, req.params.id);
    if (!verse) return res.status(404).json({ error: "Verse not found." });
    if (!isOwner(verse, req) && !isElder(req)) return res.status(403).json({ error: "This verse belongs to another contributor." });

    const result = await draftOne(verse, orientation);
    if (!result.speaks) {
      return res.json({ speaks: false, message: "The draft helper judged this verse doesn't clearly speak to this orientation — trust your own reading." });
    }
    res.json({
      speaks: true,
      text: result.interpretation?.text || "",
      notes: result.interpretation?.notes || "",
      confidence: result.interpretation?.confidence || "unknown",
    });
  } catch (err) {
    res.status(err.http || 502).json({ error: err.message, reason: err.reason || "draft_failed" });
  }
});

// ═══════════════════════════════════════════════════════════════
//  ELDER VERIFICATION SURFACE (elder / superadmin only)
//  Granular verification: the verse text and each interpretation are signed
//  off independently, each matching the schema's per-item verifiedBy gate.
//  The four-eyes rule is enforced on every verify route: an elder can never
//  verify content they authored.
// ═══════════════════════════════════════════════════════════════

// ── ELDER QUEUE — others' pending work (never the elder's own) ──
router.get("/verify-queue", async (req, res) => {
  try {
    if (!isElder(req)) return res.status(403).json({ error: "Verification is for elders." });
    const me = actorName(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    // Narrow at the query level: exclude the elder's own work (four-eyes,
    // indexed on contributor.account) and apply any search term. The precise
    // "needs verification" test inspects each verse's interpretations, which
    // isn't a single indexed field, so it stays in JS — but it now runs over a
    // much smaller, pre-filtered set.
    // Exclude the elder's own work (four-eyes). Superadmin is exempt — they may
    // self-verify — so their own verses stay in their queue.
    const filter = {
      ...(isSuperadmin(req) ? {} : { "provenance.contributor.account": { $ne: me } }),
      ...repo.verseSearchFilter(req.query.q),
    };
    const { rows: all } = await repo.queryVerses({ filter, sort: { createdAt: -1 } });
    const pending = [];
    for (const v of all) {
      const verseStatus = v.verification?.status || "draft";
      const verseNeedsVerify = verseStatus !== "verified";
      const interps = (v.interpretations && typeof v.interpretations === "object") ? v.interpretations : {};
      const pendingInterps = Object.entries(interps)
        .filter(([, it]) => (it?.status || "draft") !== "verified")
        .map(([ori]) => ori);
      if (verseNeedsVerify || pendingInterps.length) {
        pending.push({
          id: v.id,
          odu: v.odu || "",
          title: v.title || "",
          extract: verseExtract(v),
          contributor: v.provenance?.contributor?.name || "",
          verseStatus,
          verseNeedsVerify,
          pendingInterpretations: pendingInterps,
          // Verse-optional Ase Ifá marker, so the queue can badge it at a glance.
          versePending: !!(v.versePending === true || v.hasVerseText === false ||
            (v.provenance && v.provenance.tier === "verse-pending")),
        });
      }
    }
    const total = pending.length;
    const items = pending.slice((page - 1) * limit, (page - 1) * limit + limit);
    res.json({ items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── READ a verse for verification (any elder, not own) ──
router.get("/verify/:id", async (req, res) => {
  try {
    if (!isElder(req)) return res.status(403).json({ error: "Verification is for elders." });
    const verse = await repo.getItem(COLLECTION, req.params.id);
    if (!verse) return res.status(404).json({ error: "Verse not found." });
    if (authoredByMe(verse, req)) {
      return res.status(403).json({ error: "You authored this verse — it must be verified by a different elder." });
    }
    res.json({ verse: authoringShape(verse), authorName: verse.provenance?.contributor?.name || "" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── VERIFY the verse text ──
//  { name, title?, lineage? }  — name = the elder vouching (required).
router.post("/verify/:id/verse", async (req, res) => {
  try {
    if (!isElder(req)) return res.status(403).json({ error: "Verification is for elders." });
    const { name, title, lineage } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Your name is required — verification means a named elder vouches for this verse." });
    }
    const verse = await repo.getItem(COLLECTION, req.params.id);
    if (!verse) return res.status(404).json({ error: "Verse not found." });
    // Four-eyes: normally you may not verify your own verse. Superadmin is the
    // one exception — they carry full authority — but a self-verification is
    // flagged (selfVerified) so it's transparent, and any elder can re-open it,
    // so it's never final. For everyone else the wall stands.
    const selfAuthored = authoredByMe(verse, req);
    if (selfAuthored && !isSuperadmin(req)) {
      return res.status(403).json({ error: "You authored this verse — it must be verified by a different elder." });
    }

    const next = {
      ...verse,
      verification: {
        ...(verse.verification || {}),
        status: "verified",
        verifiedBy: { name: String(name).trim(), title: title || null, lineage: lineage || null },
        verifiedAt: new Date().toISOString(),
        recordedBy: actorName(req),
        selfVerified: selfAuthored && isSuperadmin(req) ? true : false,
      },
    };
    const result = await repo.updateItem(COLLECTION, req.params.id, next, actorName(req));
    res.json({ message: `Verse verified by ${name}.`, verse: authoringShape(next), ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, validationErrors: err.validationErrors });
  }
});

// ── RE-OPEN a verified verse for correction (elder capability) ──
//  A verified verse can be wrong — a mis-keyed interpretation, incorrect tone
//  marks. Any elder may re-open it for correction, but doing so SETS ASIDE the
//  verification (the corrected words must be re-verified — a stamp must always
//  mean the elder vouched for THESE exact words). The event is logged and the
//  superadmin(s), the original verifier, and the contributor are notified.
//    body: { scope: "verse" | "interpretation:<orientation>", reason? }
router.post("/verify/:id/reopen", async (req, res) => {
  try {
    if (!isElder(req)) return res.status(403).json({ error: "Re-opening a verified verse is for elders." });
    const verse = await repo.getItem(COLLECTION, req.params.id);
    if (!verse) return res.status(404).json({ error: "Verse not found." });

    const scope = String(req.body?.scope || "verse");
    const reason = (req.body?.reason || "").trim();
    const me = actorName(req);

    // Capture who to notify BEFORE we mutate — the stamp we're setting aside.
    const priorVerifierName =
      verse.verification?.verifiedBy?.name || null;               // display name
    const contributorAccount = authorAccountOf(verse) || null;    // username
    const odu = verse.odu || "";

    const next = { ...verse };
    let didReopen = false;

    if (scope.startsWith("interpretation:")) {
      // Re-open a single interpretation: drop it back to "reviewed".
      const orientation = scope.split(":")[1];
      const it = next.interpretations && next.interpretations[orientation];
      if (!it) return res.status(404).json({ error: `No interpretation for "${orientation}".` });
      next.interpretations = { ...next.interpretations };
      next.interpretations[orientation] = {
        ...it, status: "reviewed", verifiedBy: null, verifiedAt: null,
      };
      didReopen = true;
    } else {
      // Re-open the whole verse: verse-level verification + any verified
      // interpretations all return to "reviewed".
      if (next.verification?.status === "verified") {
        next.verification = { ...next.verification, status: "reviewed", verifiedBy: null, verifiedAt: null };
        didReopen = true;
      }
      const interps = { ...(next.interpretations || {}) };
      for (const [o, it] of Object.entries(interps)) {
        if (it && it.status === "verified") {
          interps[o] = { ...it, status: "reviewed", verifiedBy: null, verifiedAt: null };
          didReopen = true;
        }
      }
      next.interpretations = interps;
    }

    if (!didReopen) {
      return res.status(409).json({ error: "Nothing to re-open — this isn't verified." });
    }

    // Record that it was corrected, so the history is legible. This is an
    // AUDIT note, not revision feedback to the contributor: a re-open means an
    // ELDER is correcting the verse (the contributor has nothing to revise), so
    // it's tagged kind:"reopen" and pre-resolved — it never enters the
    // contributor's "needs revision" queue. The real "act on this" signal is the
    // status dropping to "reviewed", which surfaces in the elder re-verify queue.
    next.reviewNotes = Array.isArray(next.reviewNotes) ? [...next.reviewNotes] : [];
    next.reviewNotes.push({
      by: me, at: new Date().toISOString(),
      kind: "reopen",
      resolved: true,
      note: `Re-opened for correction (${scope})${reason ? ": " + reason : ""}. Prior verification set aside; awaits re-verification.`,
    });

    const result = await repo.updateItem(COLLECTION, req.params.id, next, me);
    await auditCorrection(req.params.id, me, `${scope}${reason ? " — " + reason : ""}`);

    // Notify — best-effort, never blocks the correction.
    let notify = { notified: [], skipped: [] };
    if (notifyCorrection) {
      try {
        notify = await notifyCorrection({
          verseId: req.params.id, odu, scope, correctedBy: me,
          originalVerifier: priorVerifierName, contributor: contributorAccount, reason,
        });
      } catch { /* best-effort */ }
    }

    res.json({
      message: "Verse re-opened for correction. It now awaits re-verification.",
      verse: authoringShape(next),
      notified: notify.notified,
      ...result,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, validationErrors: err.validationErrors });
  }
});

// ── ALL VERSES (elder browse) ─────────────────────────────────
//  Elders can browse/search every verse — including VERIFIED ones — so they can
//  find one that needs correction. Read-only listing; the correction itself goes
//  through /verify/:id/reopen then the edit endpoints.
//    query: q (search), status ("verified"|"reviewed"|"draft"), page, limit
router.get("/all-verses", async (req, res) => {
  try {
    if (!isElder(req)) return res.status(403).json({ error: "This view is for elders." });
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filter = { ...repo.verseSearchFilter(req.query.q) };
    const { rows: all } = await repo.queryVerses({ filter, sort: { createdAt: -1 } });

    const statusF = req.query.status;
    const rows = [];
    for (const v of all) {
      const verseStatus = v.verification?.status || "draft";
      if (statusF && verseStatus !== statusF) continue;
      rows.push({
        id: v.id,
        odu: v.odu || "",
        title: v.title || "",
        extract: verseExtract(v),
        contributor: v.provenance?.contributor?.name || "",
        verseStatus,
        verifiedBy: v.verification?.verifiedBy?.name || null,
        selfVerified: v.verification?.selfVerified === true,
        interpretationCount: v.interpretations ? Object.keys(v.interpretations).length : 0,
      });
    }
    const total = rows.length;
    const items = rows.slice((page - 1) * limit, (page - 1) * limit + limit);
    res.json({ items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── VERIFY one interpretation ──
//  { name, title?, lineage? }
router.post("/verify/:id/interpretation/:orientation", async (req, res) => {
  try {
    if (!isElder(req)) return res.status(403).json({ error: "Verification is for elders." });
    const orientation = req.params.orientation;
    if (!VALID_ORIENTATIONS.includes(orientation)) {
      return res.status(400).json({ error: `Unknown orientation "${orientation}".` });
    }
    const { name, title, lineage } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Your name is required to verify an interpretation." });
    }
    const verse = await repo.getItem(COLLECTION, req.params.id);
    if (!verse) return res.status(404).json({ error: "Verse not found." });
    const sa = isSuperadmin(req);
    if (authoredByMe(verse, req) && !sa) {
      return res.status(403).json({ error: "You authored this verse — its interpretations must be verified by a different elder." });
    }
    const interps = { ...(verse.interpretations || {}) };
    const it = interps[orientation];
    if (!it) return res.status(404).json({ error: "No interpretation for that orientation." });
    // Four-eyes at the INTERPRETATION level too: an elder who authored or edited
    // THIS interpretation (e.g. while correcting another's verse) may not verify
    // it — a different elder must. (The verse-author check above doesn't catch
    // this case, since the interpretation author can differ from the verse author.)
    // Superadmin is exempt (full authority) but the act is flagged selfVerified.
    const selfWrote = (authoredByMe(verse, req)) ||
      (it.interpretedBy && it.interpretedBy.account === actorName(req));
    if (it.interpretedBy && it.interpretedBy.account === actorName(req) && !sa) {
      return res.status(403).json({ error: "You wrote this interpretation — it must be verified by a different elder." });
    }

    interps[orientation] = {
      ...it,
      status: "verified",
      verifiedBy: { name: String(name).trim(), title: title || null, lineage: lineage || null },
      verifiedAt: new Date().toISOString(),
      selfVerified: selfWrote && sa ? true : false,
    };
    const next = { ...verse, interpretations: interps };
    const result = await repo.updateItem(COLLECTION, req.params.id, next, actorName(req));

    // Content-alignment score (best-effort, never blocks verification): how
    // strongly this now-verified interpretation expresses its orientation's
    // meaning. Stored on the interpretation and used to ORDER verses in a
    // reading. Computed here, once, so it costs nothing at read time.
    if (_alignment) {
      try {
        const score = await _alignment.scoreVerseOrientation(next, orientation);
        if (score != null) {
          const cur = await repo.getItem(COLLECTION, req.params.id);
          if (cur && cur.interpretations && cur.interpretations[orientation] &&
              cur.interpretations[orientation].status === "verified") {
            const merged = {
              ...cur,
              interpretations: {
                ...cur.interpretations,
                [orientation]: { ...cur.interpretations[orientation], alignmentScore: score },
              },
            };
            await repo.updateItem(COLLECTION, req.params.id, merged, actorName(req));
          }
        }
      } catch { /* non-blocking — ranking falls back to representativeness */ }
    }

    res.json({ message: `Interpretation for ${orientation} verified by ${name}.`, verse: authoringShape(next), ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, validationErrors: err.validationErrors });
  }
});

// ── COMPLETE an Ase Ifá (verse-pending) — elder capability ──
//  Two completion actions an elder legitimately performs on a verse-pending
//  record, with the four-eyes rule preserved:
//   • setOrientation: move the Ase Ifá text from one orientation to another
//     (e.g. off the generic "Gbogbo Ire" to the true one). This is VERIFICATION
//     JUDGMENT, not authoring — freely allowed, no re-gating.
//   • yoruba: supply the ẹsẹ Ifá verse that wasn't transcribed. This IS
//     authoring — so the acting elder is stamped as the verse's contributor,
//     which makes the existing four-eyes check require a DIFFERENT elder to
//     verify the now-complete verse. Knowledge flows in; nobody verifies their
//     own authored verse.
//  Body: { setOrientation?: "<to>", yoruba?: ["line", ...], title? }
router.post("/verify/:id/complete-aseifa", async (req, res) => {
  try {
    if (!isElder(req)) return res.status(403).json({ error: "Completing an Ase Ifá is for elders." });
    const verse = await repo.getItem(COLLECTION, req.params.id);
    if (!verse) return res.status(404).json({ error: "Verse not found." });

    const { setOrientation, yoruba, title } = req.body || {};
    let next = { ...verse };
    const actions = [];

    // (1) Set/correct orientation — move the interpretation text to the target.
    if (setOrientation) {
      if (!VALID_ORIENTATIONS.includes(setOrientation)) {
        return res.status(400).json({ error: `Unknown orientation "${setOrientation}".` });
      }
      const interps = { ...(next.interpretations || {}) };
      const src = Object.keys(interps).find((o) => interps[o] && String(interps[o].text || "").trim());
      if (!src) return res.status(400).json({ error: "No interpretation text to place." });
      if (src !== setOrientation) {
        interps[setOrientation] = { ...interps[src] };
        delete interps[src];
        next.interpretations = interps;
        actions.push(`orientation set to ${setOrientation}`);
      }
    }

    // (2) Add/replace the verse text — this is AUTHORING → stamp the elder as
    // contributor so four-eyes requires a different elder to verify.
    if (yoruba !== undefined) {
      const lines = Array.isArray(yoruba)
        ? yoruba.map((l) => String(l).trim()).filter(Boolean)
        : String(yoruba || "").split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length) {
        next.yoruba = lines;
        next.hasVerseText = true;
        next.versePending = false;
        if (title) next.title = String(title).trim();
        next.provenance = {
          ...(next.provenance || {}),
          tier: "verse-supplied",
          contributor: {
            ...((next.provenance && next.provenance.contributor) || {}),
            name: (next.provenance?.contributor?.name && !/Legacy oduData/.test(next.provenance.contributor.name))
              ? next.provenance.contributor.name
              : actorName(req),
            account: actorName(req),   // authorship → four-eyes will require a different verifier
          },
        };
        // Adding a verse resets verification to reviewed — a different elder must
        // now verify the completed verse (the existing /verify endpoints enforce
        // the not-your-own-work rule via authoredByMe).
        next.verification = { ...(next.verification || {}), status: "reviewed", verifiedBy: null, verifiedAt: null };
        actions.push("verse text supplied (now awaits verification by another elder)");
      } else {
        // Cleared → stays verse-optional, honest.
        delete next.yoruba;
        next.hasVerseText = false;
        actions.push("verse text cleared (stays verse-optional)");
      }
    }

    if (!actions.length) return res.status(400).json({ error: "Nothing to complete — provide setOrientation and/or yoruba." });

    const result = await repo.updateItem(COLLECTION, req.params.id, next, actorName(req));
    res.json({ message: "Ase Ifá updated: " + actions.join("; ") + ".", verse: authoringShape(next), ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, validationErrors: err.validationErrors });
  }
});

// ── SEND BACK — decline with a required note; authorship untouched ──
//  { note, orientation? }  — omit orientation to send back the whole verse;
//  include it to flag one interpretation. The elder never edits the words —
//  the note tells the contributor what to revise, keeping authorship clean.
router.post("/verify/:id/send-back", async (req, res) => {
  try {
    if (!isElder(req)) return res.status(403).json({ error: "Verification is for elders." });
    const note = String(req.body?.note || "").trim();
    const orientation = req.body?.orientation || null;
    if (!note) return res.status(400).json({ error: "A note is required — tell the contributor what to revise." });

    const verse = await repo.getItem(COLLECTION, req.params.id);
    if (!verse) return res.status(404).json({ error: "Verse not found." });
    if (authoredByMe(verse, req)) {
      return res.status(403).json({ error: "This is your own verse." });
    }

    const entry = {
      by: actorName(req),
      at: new Date().toISOString(),
      note,
      orientation: orientation || null,
      resolved: false,
    };
    // Notes live in a reviewNotes array the contributor sees in My Verses. We
    // do NOT change the words — only attach the elder's guidance and move the
    // item to needs_revision so its state is legible to everyone.
    const next = {
      ...verse,
      reviewNotes: [...(Array.isArray(verse.reviewNotes) ? verse.reviewNotes : []), entry],
    };
    if (orientation && next.interpretations?.[orientation]) {
      // Flag this one interpretation as needing revision.
      next.interpretations = {
        ...next.interpretations,
        [orientation]: { ...next.interpretations[orientation], status: "needs_revision" },
      };
    } else if (!orientation) {
      // Whole verse sent back — flag the verse text (never a verified verse
      // silently; but if it was verified, sending back means unpublish-for-fix).
      next.verification = { ...(verse.verification || {}), status: "needs_revision" };
    }
    const result = await repo.updateItem(COLLECTION, req.params.id, next, actorName(req));

    // Email the contributor so they learn of the feedback without needing to log
    // in. Best-effort — never blocks the send-back.
    let emailed = false;
    if (notifySendBack) {
      try {
        const r = await notifySendBack({
          contributor: authorAccountOf(verse),
          odu: verse.odu || "",
          verseId: req.params.id,
          note,
          orientation,
          sentBy: actorName(req),
        });
        emailed = !!r.notified;
      } catch { /* best-effort */ }
    }
    res.json({ message: "Sent back to the contributor with your note.", emailed, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── NOTIFICATIONS — a light summary for badges + the login notice ──
//  Contributor: how many of my verses an elder sent back (needs_revision).
//  Elder: how many others' items await my verification.
router.get("/notifications", async (req, res) => {
  try {
    const me = actorName(req);

    // Contributor side: only MY verses (indexed on contributor.account),
    // flagged needs_revision or carrying unresolved notes.
    let needsRevision = 0;
    const revisionItems = [];
    const { rows: mine } = await repo.queryVerses({
      filter: { "provenance.contributor.account": me },
    });
    for (const v of mine) {
      const verseFlagged = v.verification?.status === "needs_revision";
      const interpFlagged = Object.values(v.interpretations || {})
        .some((it) => it?.status === "needs_revision");
      const unresolvedNotes = (Array.isArray(v.reviewNotes) ? v.reviewNotes : [])
        .filter((n) => !n.resolved && n.kind !== "reopen" &&
          // Legacy re-open notes (written before kind-tagging) recognised by text,
          // so they don't wrongly sit in the contributor's revision queue.
          !/^Re-opened for correction/.test(n.note || "")).length;
      if (verseFlagged || interpFlagged || unresolvedNotes) {
        needsRevision++;
        revisionItems.push({ id: v.id, odu: v.odu, title: v.title, notes: unresolvedNotes });
      }
    }

    // Elder side: others' items awaiting verification. Exclude my own work at
    // the query level (four-eyes) — EXCEPT for superadmins, who may self-verify,
    // so their own pending verses count toward their "to verify" notice too.
    let toVerify = 0;
    if (isElder(req)) {
      const verifyFilter = isSuperadmin(req)
        ? {} // superadmin sees all pending work, including their own
        : { "provenance.contributor.account": { $ne: me } };
      const { rows: others } = await repo.queryVerses({ filter: verifyFilter });
      for (const v of others) {
        const verseNeeds = (v.verification?.status || "draft") !== "verified";
        const interpNeeds = Object.values(v.interpretations || {})
          .some((it) => (it?.status || "draft") !== "verified");
        if (verseNeeds || interpNeeds) toVerify++;
      }
    }

    // Superadmin side: contributors who have asked to serve as a verifier and
    // await review. Surfaced so an elder request is noticed actively, not only
    // when someone happens to open the Users panel.
    let pendingElderRequests = 0;
    if (isSuperadmin(req) && AdminUser) {
      try {
        pendingElderRequests = await AdminUser.countDocuments({
          elderRequest: true, role: "babalawo", disabled: { $ne: true },
        });
      } catch { /* non-blocking */ }
    }

    res.json({
      role: req.user?.role || "",
      needsRevision,          // contributor badge/notice
      revisionItems,          // details for the notice
      toVerify,               // elder badge/notice
      pendingElderRequests,   // superadmin badge/notice — offers to verify awaiting review
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── VERIFIER REQUEST (a logged-in contributor offers to become an elder) ──
//  A babaláwo who is already signed up can raise their hand to serve as a
//  verifier. This sets the SAME elderRequest flag the signup checkbox sets — a
//  request only, never a role change. A superadmin reviews and promotes.
//    GET  /me/verifier-request        → { elderRequest }
//    POST /me/verifier-request {wish} → set/clear the request
router.get("/me/verifier-request", async (req, res) => {
  try {
    if (!AdminUser) return res.json({ elderRequest: false });
    const me = actorName(req);
    const u = me ? await AdminUser.findOne({ username: String(me).toLowerCase().trim() }).lean() : null;
    res.json({ elderRequest: !!(u && u.elderRequest), role: u ? u.role : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/me/verifier-request", async (req, res) => {
  try {
    if (!AdminUser) return res.status(503).json({ error: "Not available." });
    const me = actorName(req);
    if (!me) return res.status(401).json({ error: "Not signed in." });
    const u = await AdminUser.findOne({ username: String(me).toLowerCase().trim() });
    if (!u) return res.status(404).json({ error: "Account not found." });
    // Only a contributor can offer — elders/superadmins already verify.
    if (u.role !== "babalawo") {
      return res.status(400).json({ error: "Only contributors can offer to become a verifier." });
    }
    u.elderRequest = req.body?.wish === true;
    await u.save();
    if (OpsAudit) {
      try { await OpsAudit.create({ action: "user.role-change", target: u.username, actor: me, note: u.elderRequest ? "requested verifier standing" : "withdrew verifier request" }); } catch { /* best-effort */ }
    }
    // Email superadmins when the offer is RAISED (not on withdrawal), so it's
    // never missed. Best-effort — never blocks the request.
    if (u.elderRequest && notifyElderRequest) {
      try { await notifyElderRequest({ username: u.username, email: u.emailContact, via: "studio" }); } catch { /* best-effort */ }
    }
    res.json({ elderRequest: u.elderRequest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
