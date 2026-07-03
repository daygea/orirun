// tests/chatbot-grounding.test.js — frontend repo.
// Run from repo root:  npm install jsdom --no-save && node tests/chatbot-grounding.test.js
// Proves knowledge retrieval v2: diacritic folding, word-boundary matching,
// confidence thresholds, and the grounding handoff to the AI path.

const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "public", "js", "chatbot.js"), "utf8");

const dom = new JSDOM('<body><div id="chatbot-messages"></div></body>', {
  runScripts: "outside-only", url: "https://orirun.com/",
});
const w = dom.window;
w.SERVER_URL = ""; w.chatHistory = [{ role: "system", content: "base" }]; w.LANGUAGES = {};
let captured = null;
w.fetch = (u, o) => { captured = JSON.parse(o.body); return Promise.resolve({ ok: true, json: () => Promise.resolve({ message: "x" }) }); };
w.localStorage = { getItem: () => null, setItem: () => {} };
try { w.eval(src); } catch (e) { /* page-boot hooks need globals from other files; functions are loaded */ }

w.ifaKnowledgeBase = {
  "ase, ashe, life force": { text: "Ase is the divine force to make things happen.", media: [{ type: "audio", url: "x", title: "Ase" }] },
  "orunmila, orula, ifa deity": { text: "Orunmila is the witness of destiny.", media: [] },
  "ori, inner head, destiny head": { text: "Ori is the personal divinity of destiny.", media: [] },
  "ebo, sacrifice, offering": { text: "Ebo is the prescribed offering that realigns destiny.", media: [] },
};

let pass = 0, fail = 0;
const check = (l, c) => { c ? pass++ : fail++; console.log((c ? "  ✓ " : "  ✗ ") + l); };

(async () => {
  check("keyword hit → curated verbatim", (w.checkIfaKnowledgeBase("what is ase?") || {}).text?.includes("divine force"));
  check("media carried through", (w.checkIfaKnowledgeBase("what is ase?") || {}).media?.length === 1);
  check("diacritic input matches plain key", (w.checkIfaKnowledgeBase("ta ni \u1ecc\u0300r\u00fanm\u00ecl\u00e0?") || {}).text?.includes("witness"));
  check("no false positive from substrings", w.checkIfaKnowledgeBase("please help me with my problem") === null);
  check("ambiguous multi-topic → defers to AI", w.checkIfaKnowledgeBase("tell me about ori and ebo together") === null);

  await w.eval("(async()=>{await getAIResponse();})()");
  const sys = captured.chatHistory.find((m) => m.role === "system" && /CURATED/.test(m.content));
  check("grounded system message sent to AI", !!sys);
  check("grounding carries both curated entries", sys && sys.content.includes("personal divinity") && sys.content.includes("prescribed offering"));
  check("no-invention rule present (grounded)", sys && /never invent od/i.test(sys.content));

  w.checkIfaKnowledgeBase("how do I fix my wifi router");
  captured = null;
  await w.eval("(async()=>{await getAIResponse();})()");
  const sys2 = captured.chatHistory.find((m) => m.role === "system" && /outside/.test(m.content));
  check("outside-corpus persona when nothing relevant", !!sys2);
  check("no-invention rule present (ungrounded)", sys2 && /never invent od/i.test(sys2.content));

  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
