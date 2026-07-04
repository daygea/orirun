let aiRequestInProgress = false;

let chatHistory = [
    { role: "system", content: "You are a helpful assistant specializing in Ifa divination and Yoruba spirituality." }
];

/* ─────────────────────────────────────────────────────────────
 *  FEEDBACK INACTIVITY TIMER
 *  Shows feedback only after 90 s of silence — not after every
 *  message. Cleared whenever the user sends a new message.
 * ───────────────────────────────────────────────────────────── */
let _chatFeedbackTimer = null;
let _lastChatExchange  = { userMessage: "", response: "", source: "AI" };

async function reportChatMessage(msgId) {
  const el = document.getElementById(msgId);
  const reportedText = el ? el.innerText.slice(0, 1000) : "";
  try {
    await fetch(`${SERVER_URL}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feedback: "report",
        contextType: "ai_chat_report",
        contextData: { reportedResponse: reportedText, userMessage: _lastChatExchange?.userMessage || "" },
        timestamp: new Date().toISOString()
      })
    });
    alert("Thank you. This response has been reported to our team for review.");
  } catch (e) {
    window.location.href = "mailto:info@orirun.com?subject=Report%20AI%20response&body="
      + encodeURIComponent(reportedText);
  }
}

function _scheduleChatFeedback() {
  clearTimeout(_chatFeedbackTimer);
  _chatFeedbackTimer = setTimeout(() => {
    const messagesDiv = document.getElementById("chatbot-messages");
    if (!messagesDiv) return;
    // Don't stack if feedback already visible
    if (messagesDiv.querySelector(".feedback-section")) return;
    // Only show if the last message was a bot reply
    const lastWrapper = messagesDiv.lastElementChild;
    if (!lastWrapper?.classList.contains("align-left")) return;
    renderFeedbackSection(
      "chatbot",
      _lastChatExchange,
      messagesDiv
    );
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }, 90 * 1000); // 90 seconds of silence
}

function _cancelChatFeedback() {
  clearTimeout(_chatFeedbackTimer);
}

/* ─────────────────────────────────────────────────────────────
 *  TOGGLE CHATBOT
 * ───────────────────────────────────────────────────────────── */
function toggleChatbot() {
    let chatbot      = document.getElementById("chatbot-container");
    let toggleButton = document.getElementById("chatbot-toggle");

    if (window.innerWidth <= 768) {
        chatbot.style.position    = "fixed";
        chatbot.style.bottom      = "10px";
        chatbot.style.right       = "10px";
        chatbot.style.width       = "90vw";
        chatbot.style.height      = "50vh";
        chatbot.style.borderRadius= "10px";
    } else {
        chatbot.style.position = "fixed";
        chatbot.style.bottom   = "20px";
        chatbot.style.right    = "20px";
        chatbot.style.width    = "350px";
        chatbot.style.height   = "380px";
    }

    if (chatbot.style.display === "none" || chatbot.style.display === "") {
        chatbot.style.display      = "block";
        toggleButton.style.display = "none";
        _cancelChatFeedback(); // reset timer on open
    } else {
        chatbot.style.display      = "none";
        toggleButton.style.display = "block";
        _cancelChatFeedback();

        // Show feedback immediately when user closes the chat
        const messagesDiv = document.getElementById("chatbot-messages");
        if (messagesDiv && !messagesDiv.querySelector(".feedback-section")) {
          const lastBot = messagesDiv.querySelector(".align-left:last-of-type");
          if (lastBot && _lastChatExchange.response) {
            renderFeedbackSection("chatbot", _lastChatExchange, messagesDiv);
          }
        }
    }
}

// Ensure chatbot starts minimized
document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("chatbot-container").style.display = "none";
    document.getElementById("chatbot-toggle").style.display    = "block";
});

// Enter key sends message
document.addEventListener("keydown", function (event) {
    if (event.target.id === "chatbot-input" && event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

function appendMessage(message, sender = "bot") {
    const wrapper  = document.createElement("div");
    wrapper.className = "chat-message-wrapper " + (sender === "user" ? "align-right" : "align-left");
    const msgDiv   = document.createElement("div");
    msgDiv.className  = "chat-message " + (sender === "user" ? "user-message" : "bot-message");
    msgDiv.innerHTML  = message;
    wrapper.appendChild(msgDiv);
    document.getElementById("chatbot-messages").appendChild(wrapper);
    document.getElementById("chatbot-messages").scrollTop =
      document.getElementById("chatbot-messages").scrollHeight;
}

async function getAIResponse() {
  // Tell the model which language to reply in (resolved from the app's selector).
  const _lang = (typeof currentLang !== "undefined") ? currentLang : "en";
  const _langName =
    (typeof LANGUAGES !== "undefined" && _lang && _lang !== "baseline" && _lang !== "en")
      ? (LANGUAGES[_lang] || "English")
      : "English";

  // Inject the language directive into the messages we send, so the model
  // replies in the selected language even if the conversation history is in
  // another language (and even if the backend hasn't added it yet).
  const _msgs = chatHistory.slice(-10);

  // GROUNDING: the retrieval pass leaves the most relevant curated entries
  // in _kbCandidates. The model answers FROM Orírùn's own knowledge where
  // it applies, and is forbidden from inventing verses either way.
  const _grounding = Array.isArray(_kbCandidates) ? _kbCandidates : [];
  if (_grounding.length) {
    const ctx = _grounding
      .map((g, i) => `[${i + 1}] ${String(g.text).slice(0, 700)}`)
      .join("\n\n");
    _msgs.unshift({
      role: "system",
      content:
        "You are Orírùn's Ifá assistant, specialising in Ifá divination and Yorùbá spirituality.\n\n" +
        "CURATED ORÍRÙN KNOWLEDGE (primary source):\n\n" + ctx + "\n\n" +
        "Ground your answer in the curated knowledge above wherever it covers the question, " +
        "staying faithful to its meaning and terms. If it does not cover the question, say so " +
        "in one short phrase and answer from general Ifá tradition. Never invent odù verses, " +
        "quotations, or attributions.",
    });
  } else {
    _msgs.unshift({
      role: "system",
      content:
        "You are Orírùn's Ifá assistant, specialising in Ifá divination and Yorùbá spirituality. " +
        "This question falls outside Orírùn's curated knowledge base: answer from general Ifá " +
        "tradition, be plain about uncertainty, and never invent odù verses, quotations, or attributions.",
    });
  }
  if (_langName && !/^english$/i.test(_langName)) {
    _msgs.unshift({
      role: "system",
      content:
        `Reply to the user ENTIRELY in ${_langName}, regardless of the language used ` +
        `in earlier messages. Keep sacred Yoruba terms and names (Ifa, Esu, Odu, Ebo, ` +
        `Orisha, Orunmila) in Yoruba.`,
    });
  }

  const response = await fetch(`${SERVER_URL}/api/ai/chat`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ chatHistory: _msgs, langName: _langName }),
  });

  const data = await response.json();

  if (!response.ok || !data.message) {
    throw new Error(data.error || "AI service failed");
  }

  return data.message;
}

async function getBotResponse(userInput) {
    userInput = userInput.toLowerCase().trim();
    let possibleResponses = [];
    for (let key in ifaKnowledgeBase) {
        let keywords = key.split(",").map(k => k.trim().toLowerCase());
        if (keywords.some(keyword => userInput.includes(keyword))) {
            possibleResponses.push(ifaKnowledgeBase[key]);
        }
    }
    if (possibleResponses.length === 1)  return possibleResponses[0];
    if (possibleResponses.length > 1)
        return `I found multiple possible answers. Can you clarify?\n\n- ${possibleResponses.join("\n- ")}`;
    // The assistant's AI reply is a live call — it can't be served offline.
    // If there's no cached knowledge-base match and we're offline, say so
    // honestly instead of leaving the user on a spinner that never resolves.
    if (typeof window.orirunIsOnline === "function" && !window.orirunIsOnline()) {
        return (typeof window.orirunOfflineNotice === "function")
            ? window.orirunOfflineNotice("The assistant")
            : "The assistant needs an internet connection. Please reconnect and try again.";
    }
    return await getAIResponse(userInput);
}

async function sendMessage(userInput, options = {}) {

  const { silentUser = false } = options;

  const inputField  = document.getElementById("chatbot-input");
  const messagesDiv = document.getElementById("chatbot-messages");

  const message = (userInput || inputField.value).trim();
  if (!message) return;

  /* Cancel any pending feedback — user is still talking */
  _cancelChatFeedback();

  /* Remove any existing feedback section so it doesn't stack */
  messagesDiv.querySelector(".feedback-section")?.remove();

  if (!silentUser) {
    const userEl = document.createElement("div");
    userEl.className = "chat-message-wrapper align-right";
    userEl.innerHTML = `<div class="chat-message user-message">${message}</div>`;
    messagesDiv.appendChild(userEl);
    inputField.value = "";
  }

  const normalized = message.toLowerCase();

  const helpTriggers    = ["help", "help me", "show help", "show topics", "list topics", "what can you teach", "topics"];
  const knowledgeCommands = ["araba", "akoda", "aseda", "ojubona"];
  const isHelpRequest   = helpTriggers.some(t => normalized.includes(t)) || knowledgeCommands.includes(normalized);

  const nonLogCommands  = ["help", "araba", "akoda", "aseda", "ojubona"];
  const shouldLog       = !nonLogCommands.includes(normalized);

  chatHistory.push({ role: "user", content: message });

  const botWrapper = document.createElement("div");
  botWrapper.className = "chat-message-wrapper align-left";
  botWrapper.innerHTML = `<div class="chat-message bot-message"><em data-translate>Loading...</em></div>`;
  messagesDiv.appendChild(botWrapper);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  let aiText = "";
  let source = "AI";

  try {

    if (isHelpRequest) {
      aiText = getKnowledgeBaseIndex(1, 5, "");
      source = "Internal";

    } else {
      const kbResult = checkIfaKnowledgeBase(normalized);

      if (kbResult) {
        const { text, media } = kbResult;
        source = "Internal";
        let html = `🧿 ${formatResponseAsHTML(text)}`;

        if (media && media.length) {
          html += `<div class="kb-media">`;
          media.forEach(item => {
            if (item.type === "audio") {
              html += `<button class="kb-media-btn" onclick="openAudioModal('${item.url}')">🎧 <span data-translate>Play audio of</span> ${item.title}</button>`;
            }
            if (item.type === "video") {
              html += `<button class="kb-media-btn" onclick="openVideoModal('${item.url}')">▶️ <span data-translate>Play video of</span> ${item.title}</button>`;
            }
          });
          html += `</div>`;
        }

        aiText = html;
        chatHistory.push({ role: "assistant", content: `From the Orirun Knowledgebase: ${text}` });

      } else {
        aiText = await getAIResponse();
      }
    }

    // botWrapper.innerHTML = `<div class="chat-message bot-message">${aiText}</div>`;
    const _msgId = 'botmsg_' + Date.now();
    botWrapper.innerHTML =
      `<div class="chat-message bot-message" id="${_msgId}">${aiText}</div>` +
      `<button class="report-btn" onclick="reportChatMessage('${_msgId}')" ` +
      `style="background:none;border:none;color:#999;font-size:11px;cursor:pointer;margin:2px 0 8px 4px;">⚐ <span data-translate>Report</span></button>`;

    // Save exchange details for deferred feedback
    _lastChatExchange = { userMessage: message, response: aiText, source };

    chatHistory.push({ role: "assistant", content: aiText });

    if (shouldLog) await logChat(message, aiText);

    /* Start the 90 s inactivity timer — feedback shows if user goes quiet */
    _scheduleChatFeedback();

  } catch (err) {
    console.error("AI error:", err.message);
    botWrapper.innerHTML = `
      <div class="chat-message bot-message">
        ⚠️ <span data-translate>The Orirun server is currently interpreting heavy energies. Please try again shortly.</span>
      </div>
    `;
  }

  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

/* ── Knowledge retrieval v2 ──────────────────────────────────────
   The old matcher required the user's message to CONTAIN an entire
   key phrase verbatim ("bi ase pin aye ni igba iwase"), so most of
   the curated corpus was unreachable and questions fell through to
   the AI with no grounding at all. Now:
   • Diacritic folding — "Ọ̀rúnmìlà" and "orunmila" match the same key.
   • Word-boundary token scoring — "ase" no longer hides in "please".
   • A confident, clearly-best hit answers in the curated voice,
     verbatim, media included.
   • Weak or ambiguous hits are handed to the AI as GROUNDING, so the
     model synthesizes from Orírùn's own knowledge instead of memory. */
let _kbIndex = null;
let _kbCandidates = [];

function normalizeYo(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // strips tone marks and dot-below
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const _KB_STOP = new Set(["the","a","an","of","in","on","is","are","was","what",
  "who","how","why","when","which","and","or","to","for","do","does","did","me",
  "my","i","you","your","it","its","tell","about","please","can","could","would"]);

function _kbTokens(str) {
  return normalizeYo(str).split(" ").filter((t) => t && !_KB_STOP.has(t));
}

function _buildKbIndex() {
  _kbIndex = Object.keys(ifaKnowledgeBase).map((key) => {
    const phrases = key.split(",").map((p) => normalizeYo(p)).filter(Boolean);
    const tokens = new Set(phrases.flatMap((p) => p.split(" ")).filter((t) => t && !_KB_STOP.has(t)));
    return { key, phrases, tokens };
  });
}

function _kbEntryPayload(key) {
  const entry = ifaKnowledgeBase[key];
  if (!entry || !entry.text) return null;
  let text = entry.text;
  if (Array.isArray(text)) text = text[Math.floor(Math.random() * text.length)];
  return { key, text, media: entry.media || [] };
}

function checkIfaKnowledgeBase(userMessage) {
  _kbCandidates = [];
  if (!ifaKnowledgeBase || !Object.keys(ifaKnowledgeBase).length) return null;
  if (!_kbIndex || _kbIndex.length !== Object.keys(ifaKnowledgeBase).length) _buildKbIndex();

  const inputNorm = " " + normalizeYo(userMessage) + " ";
  const inputTokens = _kbTokens(userMessage);

  const scored = _kbIndex
    .map((item) => {
      let score = 0;
      for (const p of item.phrases) {
        if (p && inputNorm.includes(" " + p + " ")) {
          score += Math.min(8, 2 + p.split(" ").length * 2); // whole keyword phrase present
        }
      }
      for (const t of inputTokens) if (item.tokens.has(t)) score += 1;
      return { item, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  // Grounding for the AI path: the top three relevant curated entries.
  _kbCandidates = scored.slice(0, 3).map((x) => _kbEntryPayload(x.item.key)).filter(Boolean);
  if (!scored.length) return null;

  const top = scored[0], second = scored[1];
  // Confident direct answer: a real phrase/keyword hit, clearly ahead of
  // the runner-up → serve the curated text verbatim, media and all.
  if (top.score >= 4 && (!second || top.score >= second.score * 2)) {
    return _kbEntryPayload(top.item.key);
  }
  return null; // ambiguous or weak → let the AI synthesize FROM the candidates
}

const pageSize = 5;
let currentSearch = "";

function highlightMatch(text, searchTerm) {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

function getKnowledgeBaseIndex(page = 1, pageSizeLocal = pageSize, searchTerm = "") {
    if (!ifaKnowledgeBase || Object.keys(ifaKnowledgeBase).length === 0) return ``;

    const keys = Object.keys(ifaKnowledgeBase)
        .sort((a, b) => a.localeCompare(b))
        .filter(key => key.toLowerCase().includes(searchTerm.toLowerCase()));

    const totalPages  = Math.ceil(keys.length / pageSizeLocal);
    page = Math.max(1, Math.min(page, totalPages || 1));
    const startIndex  = (page - 1) * pageSizeLocal;
    const paginatedKeys = keys.slice(startIndex, startIndex + pageSizeLocal);

    const listHtml = paginatedKeys.map((key, i) => {
        const item = ifaKnowledgeBase[key];
        const count = Array.isArray(item) ? ` (${item.length})` : "";
        const highlightedKey = highlightMatch(key, searchTerm);
        return `
            <div class="kb-item" data-key="${key}">
                ${startIndex + i + 1}.
                <span style="text-transform:capitalize">${highlightedKey}${count}</span>
            </div>`;
    }).join("");

    const windowSize = window.innerWidth < 600 ? 3 : 5;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end   = Math.min(totalPages, start + windowSize - 1);
    if (end - start < windowSize - 1) start = Math.max(1, end - windowSize + 1);

    let paginationButtons = "";
    if (start > 1) {
        paginationButtons += `<button class="kb-page-btn" data-page="1">1</button>`;
        if (start > 2) paginationButtons += `<span class="kb-ellipsis">…</span>`;
    }
    for (let i = start; i <= end; i++) {
        paginationButtons += `<button class="kb-page-btn ${i === page ? "active" : ""}" data-page="${i}">${i}</button>`;
    }
    if (end < totalPages) {
        if (end < totalPages - 1) paginationButtons += `<span class="kb-ellipsis">…</span>`;
        paginationButtons += `<button class="kb-page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    const paginationHtml = totalPages > 1 ? `
      <div class="kb-pagination">
        <div class="kb-page-numbers">${paginationButtons}</div>
        <div class="kb-page-info">${startIndex + 1}–${Math.min(startIndex + pageSizeLocal, keys.length)} / ${keys.length}</div>
      </div>` : "";

    return `
        <div class="kb-index">
            <input type="text" id="kb-search" placeholder="🔍 Search topics..." data-translate-attr="placeholder" value="${searchTerm}" />
            <div class="kb-list">${listHtml || "<p data-translate>No topics match your search.</p>"}</div>
            ${paginationHtml}
        </div>`;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function updateKnowledgeBase() {
    const kbIndexContainer = document.querySelector(".kb-index");
    if (!kbIndexContainer) return;
    const searchInput = document.querySelector("#kb-search");
    if (searchInput) {
        currentSearch = searchInput.value;
        const cursorPosition = searchInput.selectionStart;
        const hasFocus = document.activeElement === searchInput;
        kbIndexContainer.outerHTML = getKnowledgeBaseIndex(currentPage, pageSize, currentSearch);
        if (hasFocus) {
            const newSearchInput = document.querySelector("#kb-search");
            if (newSearchInput) {
                newSearchInput.focus();
                newSearchInput.setSelectionRange(cursorPosition, cursorPosition);
            }
        }
    } else {
        kbIndexContainer.outerHTML = getKnowledgeBaseIndex(currentPage, pageSize, currentSearch);
    }
}

const debouncedUpdateKnowledgeBase = debounce(updateKnowledgeBase, 300);

document.body.innerHTML += getKnowledgeBaseIndex(currentPage);

document.addEventListener("input", (e) => {
    if (e.target.id === "kb-search") {
        currentSearch = e.target.value;
        currentPage = 1;
        debouncedUpdateKnowledgeBase();
    }
});

document.addEventListener("click", (e) => {
    const btn = e.target.closest(".kb-page-btn");
    if (btn) {
        currentPage = parseInt(btn.dataset.page, 10);
        updateKnowledgeBase();
    }
});

document.addEventListener("keydown", (e) => {
    if (e.target.id === "kb-search" && e.key === "Enter") {
        e.preventDefault();
        currentSearch = e.target.value;
        currentPage = 1;
        updateKnowledgeBase();
    }
});

function resetChatMemory() {
    chatHistory = [
        { role: "system", content: "You are Orirun, a multilingual spiritual assistant specializing in Ifa divination, Yoruba cosmology, and African ancestral wisdom. Always preserve sacred Yoruba terms (Orunmila, Ogun, Sango, Odu, Ase, etc.) during translation." }
    ];
}

async function logChat(userMessage, botResponse) {
    try {
        await fetch(`${SERVER_URL}/api/chat/log`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ userMessage, botResponse }),
        });
    } catch (error) {
        console.error("Failed to log chat:", error);
    }
}

function formatResponseAsHTML(text) {
    if (/<[a-z][\s\S]*>/i.test(text)) return text;
    let escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    escaped = escaped.replace(/^###\s?(.*)$/gm, "<h3>$1</h3>");
    escaped = escaped.replace(/^##\s?(.*)$/gm,  "<h2>$1</h2>");
    escaped = escaped.replace(/^#\s?(.*)$/gm,   "<h1>$1</h1>");
    escaped = escaped.replace(/\*\*(.*?)\*\*/g,  "<strong>$1</strong>");
    escaped = escaped.replace(/\*(.*?)\*/g,       "<em>$1</em>");
    escaped = escaped.replace(/`([^`]+)`/g,       "<code>$1</code>");
    escaped = escaped.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
    escaped = escaped.replace(/^>\s?(.*)$/gm,     "<blockquote>$1</blockquote>");
    escaped = escaped.replace(/^(?:-|\*)\s(.+)$/gm, "<li>$1</li>");
    if (escaped.includes("<li>")) {
        escaped = escaped.replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>");
    }
    escaped = escaped
        .split(/\n{2,}/)
        .map(block => {
            if (!block.trim()) return "";
            if (/^\s*<\/?(h\d|ul|ol|li|pre|blockquote|code)/.test(block)) return block;
            return `<p>${block.trim()}</p>`;
        })
        .join("\n");
    escaped = escaped.replace(/\n/g, "<br>");
    return escaped;
}

document.addEventListener("input", function (event) {
    if (event.target.id === "kb-search") {
        const searchTerm = event.target.value.toLowerCase();
        document.querySelectorAll(".kb-item").forEach(item => {
            item.style.display = item.textContent.toLowerCase().includes(searchTerm) ? "block" : "none";
        });
    }
});

function renderKnowledgeBaseList(filter = "") {
  const kbList = document.getElementById("kb-list");
  kbList.innerHTML = "";
  const keys = Object.keys(ifaKnowledgeBase).filter(k =>
    k.toLowerCase().includes(filter.toLowerCase())
  );
  if (keys.length === 0) { kbList.innerHTML = `<p data-translate>No topics found.</p>`; return; }
  keys.forEach((key, i) => {
    const item  = ifaKnowledgeBase[key];
    const count = Array.isArray(item) ? `(${item.length})` : "";
    const div   = document.createElement("div");
    div.className    = "kb-item";
    div.dataset.key  = key;
    div.innerHTML    = `${i + 1}. ${key} ${count}`;
    kbList.appendChild(div);
  });
}

let isProcessingClick = false;

document.addEventListener("click", async e => {
  const item = e.target.closest(".kb-item");
  if (!item || isProcessingClick) return;
  isProcessingClick = true;
  const key = item.dataset.key;
  if (!key) { isProcessingClick = false; return; }
  await sendMessage(key);
  setTimeout(() => { isProcessingClick = false; }, 300);
});

const textarea = document.getElementById("chatbot-input");
textarea.addEventListener("input", () => {
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 90) + "px";
});