// Each tool declares whether it is powered by a large language model via `llm`.
// LLM tools show a slanted "LLM" badge and run through callLLM() (BYOK or credits).
const TOOL_DEFINITIONS = [
  // Writing
  { id: "email-assistant", title: "Email Writer & Replier", category: "Writing Tools",
    summary: "Write a new email or reply to one, with tone and length controls.", llm: true, render: renderEmailAssistant },
  { id: "rewrite", title: "Rewrite & Tone", category: "Writing Tools",
    summary: "Make any text clearer, shorter, friendlier, or more professional.", llm: true, render: renderRewrite },
  { id: "reply-generator", title: "Reply Generator", category: "Writing Tools",
    summary: "Paste a message or thread and get three ready-to-send replies.", llm: true, render: renderReplyGenerator },
  { id: "proofread", title: "Proofread & Polish", category: "Writing Tools",
    summary: "Fix grammar and clarity, and see exactly what changed.", llm: true, render: renderProofread },

  // Summaries
  { id: "summarize", title: "Summarize Anything", category: "Summaries",
    summary: "Paste or speak text and get a TL;DR, key points, and actions — with translation.", llm: true, render: renderSummarize },
  { id: "meeting-notes", title: "Meeting Notes → Actions", category: "Summaries",
    summary: "Turn raw notes into a summary, decisions, action items, and a follow-up email.", llm: true, render: renderMeetingNotes },

  // Voice
  { id: "voice-notes", title: "Voice Note → Notes & Tasks", category: "Voice Tools",
    summary: "Record a voice note and get a clean write-up plus a task checklist.", llm: true, render: renderVoiceNotes },
  { id: "speech-to-text", title: "Speech to Text", category: "Voice Tools",
    summary: "Record speech from your microphone and turn it into editable text.", llm: false, render: renderSpeechToText },
  { id: "text-to-speech", title: "Text to Speech", category: "Voice Tools",
    summary: "Read text aloud using browser voices, speed, and pitch controls.", llm: false, render: renderTextToSpeech },

  // Social & content
  { id: "ai-post-generator", title: "AI Post Generator", category: "Social & Content",
    summary: "Turn one idea into platform-specific posts written by your chosen AI model.", llm: true, render: renderAiPostGenerator },
  { id: "repurpose", title: "Repurpose Content", category: "Social & Content",
    summary: "Turn long content into a thread, carousel, newsletter, or shorts script.", llm: true, render: renderRepurpose },
  { id: "headlines", title: "Headlines & Hooks", category: "Social & Content",
    summary: "Generate a batch of titles, subject lines, or hooks to choose from.", llm: true, render: renderHeadlines },

  // Free tools (no LLM, no key, run in the browser)
  { id: "word-counter", title: "Word & Character Counter", category: "Text Tools",
    summary: "Live word, character, sentence, and reading-time counts.", llm: false, render: renderWordCounter },
  { id: "case-converter", title: "Case Converter", category: "Text Tools",
    summary: "Convert text to UPPER, lower, Title, camelCase, snake_case, and more.", llm: false, render: renderCaseConverter },
  { id: "text-cleaner", title: "Text Cleaner & Replace", category: "Text Tools",
    summary: "Find & replace, trim, dedupe, and sort lines.", llm: false, render: renderTextCleaner },
  { id: "json-formatter", title: "JSON Formatter", category: "Text Tools",
    summary: "Format, minify, and validate JSON.", llm: false, render: renderJsonFormatter },
  { id: "markdown-preview", title: "Markdown Preview", category: "Text Tools",
    summary: "Write Markdown and see a live HTML preview.", llm: false, render: renderMarkdownPreview },

  { id: "base64", title: "Base64 Encode / Decode", category: "Developer Tools",
    summary: "Encode text to Base64 or decode it back.", llm: false, render: renderBase64 },
  { id: "url-encoder", title: "URL Encode / Decode", category: "Developer Tools",
    summary: "Percent-encode or decode text for URLs.", llm: false, render: renderUrlEncoder },
  { id: "hash-generator", title: "Hash Generator", category: "Developer Tools",
    summary: "SHA-256/1/384/512 hashes of any text.", llm: false, render: renderHashGenerator },
  { id: "uuid-generator", title: "UUID Generator", category: "Developer Tools",
    summary: "Generate random v4 UUIDs in bulk.", llm: false, render: renderUuidGenerator },
  { id: "regex-tester", title: "Regex Tester", category: "Developer Tools",
    summary: "Test a regular expression against sample text.", llm: false, render: renderRegexTester },
  { id: "timestamp-converter", title: "Timestamp Converter", category: "Developer Tools",
    summary: "Convert between Unix timestamps and dates.", llm: false, render: renderTimestampConverter },
  { id: "color-converter", title: "Color Converter", category: "Developer Tools",
    summary: "Convert between HEX, RGB, and HSL.", llm: false, render: renderColorConverter },

  { id: "password-generator", title: "Password Generator", category: "Calculators",
    summary: "Create strong random passwords in your browser.", llm: false, render: renderPasswordGenerator },
  { id: "unit-converter", title: "Unit Converter", category: "Calculators",
    summary: "Convert length, weight, and temperature units.", llm: false, render: renderUnitConverter },
  { id: "percentage-calculator", title: "Percentage & Tip", category: "Calculators",
    summary: "Percentage math and a tip splitter.", llm: false, render: renderPercentageCalculator },
  { id: "date-calculator", title: "Date & Age Calculator", category: "Calculators",
    summary: "Days between dates, and exact age.", llm: false, render: renderDateCalculator },
  { id: "pomodoro", title: "Pomodoro Timer", category: "Calculators",
    summary: "A focus/break timer for deep work.", llm: false, render: renderPomodoro },

  { id: "image-compress", title: "Image Crop & Resize", category: "Image Tools",
    summary: "Crop, resize, compress, and convert images — privately in your browser.", llm: false, render: renderImageCompress },
  { id: "image-base64", title: "Image to Base64", category: "Image Tools",
    summary: "Turn an image into a Base64 data URL.", llm: false, render: renderImageBase64 }
];

// ---- shared helpers ----
function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function copyText(text, statusElement) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      if (statusElement) statusElement.textContent = "Copied to clipboard.";
    })
    .catch(() => {
      if (statusElement) statusElement.textContent = "Copy failed. Select the output and copy manually.";
    });
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function renderShell(mount, html) {
  mount.innerHTML = html;
}

function speakText(text) {
  if (!("speechSynthesis" in window) || !text) return;
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

// Attach push-to-talk dictation that appends into a textarea.
function attachDictation(button, target, statusEl) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    button.disabled = true;
    button.textContent = "Voice input not supported";
    return;
  }
  let recognition = null;
  let active = false; // user wants to keep recording
  let base = ""; // text before the current session
  let sessionFinal = "";

  function paint(interim) {
    target.value = `${base} ${sessionFinal} ${interim}`.replace(/\s+/g, " ").trim();
  }
  function startSession() {
    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    sessionFinal = "";
    recognition.onstart = () => {
      button.textContent = "Stop recording";
      if (statusEl) statusEl.textContent = "Listening…";
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        active = false;
        if (statusEl) statusEl.textContent = "Mic access is blocked.";
      }
    };
    recognition.onresult = (event) => {
      let interim = "";
      let finals = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finals += `${t} `;
        else interim += t;
      }
      sessionFinal = finals.trim();
      paint(interim);
    };
    recognition.onend = () => {
      if (sessionFinal) {
        base = `${base} ${sessionFinal}`.replace(/\s+/g, " ").trim();
        sessionFinal = "";
      }
      paint("");
      // Restart across Chrome's silence timeout so long voice notes keep going.
      if (active) {
        startSession();
      } else {
        button.textContent = "Record voice";
        if (statusEl) statusEl.textContent = "";
      }
    };
    try {
      recognition.start();
    } catch {
      /* ignore transient start error */
    }
  }
  button.addEventListener("click", () => {
    if (active) {
      active = false;
      if (recognition) recognition.stop();
      return;
    }
    base = target.value ? target.value.trim() : "";
    sessionFinal = "";
    active = true;
    startSession();
  });
}

// ---- LLM tool gate + generic engine ----
function renderLlmGate(mount, renderBody) {
  if (canUseLlm()) {
    renderBody(mount);
    return;
  }
  renderShell(
    mount,
    `<div class="llm-gate">
      <h3>Use your own key, or buy credits</h3>
      <p>This is an AI tool. Either bring your own Claude, OpenAI, or Gemini key (free, stored only in your browser), or buy credits and use it with no key. Pick an option in the panel.</p>
      <button class="primary" id="gateOpen">Set up access</button>
    </div>`
  );
  document.getElementById("gateOpen").addEventListener("click", () => window.openLlmSettings());
}

// cfg: { inputLabel, placeholder, inputHeading?, runLabel?, maxTokens?, voiceInput?, readAloud?,
//        controls: [{id,label,type:"select",options:[]} | {id,label,type:"checkboxes",options:[]}],
//        build(input, values) -> { system, prompt } }
function renderPromptTool(mount, cfg) {
  renderLlmGate(mount, (m) => {
    const controlsHtml = (cfg.controls || [])
      .map((c) => {
        if (c.type === "checkboxes") {
          return `<div class="field"><label>${escapeHtml(c.label)}</label>
            <div class="metric-row" id="${c.id}">${c.options
              .map(
                (o, i) =>
                  `<label class="metric" style="cursor:pointer"><input type="checkbox" value="${escapeHtml(o)}" ${
                    i < (c.defaultCount == null ? c.options.length : c.defaultCount) ? "checked" : ""
                  } style="width:auto;min-height:auto;margin-right:6px"> ${escapeHtml(o)}</label>`
              )
              .join("")}</div></div>`;
        }
        return `<div class="field"><label for="${c.id}">${escapeHtml(c.label)}</label>
          <select id="${c.id}">${c.options.map((o) => `<option>${escapeHtml(o)}</option>`).join("")}</select></div>`;
      })
      .join("");

    renderShell(
      m,
      `<div class="tool-grid">
        <div class="panel">
          <h3>${escapeHtml(cfg.inputHeading || "Input")}</h3>
          <div class="field">
            <label for="ptInput">${escapeHtml(cfg.inputLabel)}</label>
            <textarea id="ptInput" placeholder="${escapeHtml(cfg.placeholder || "")}"></textarea>
            ${
              cfg.voiceInput
                ? `<div class="action-row"><button class="secondary" id="ptVoice" type="button">Record voice</button><span id="ptVoiceStatus" class="hint"></span></div>`
                : ""
            }
          </div>
          ${controlsHtml}
          <div class="action-row">
            <button class="primary" id="ptRun">${escapeHtml(cfg.runLabel || "Generate")}</button>
          </div>
          <p id="ptStatus" class="status"></p>
        </div>
        <div class="panel">
          <h3>Result</h3>
          <div id="ptOutput" class="output"></div>
          <div class="action-row">
            <button class="secondary" id="ptCopy">Copy</button>
            <button class="secondary" id="ptDownload">Download .txt</button>
            ${cfg.readAloud ? `<button class="secondary" id="ptSpeak">Read aloud</button>` : ""}
          </div>
        </div>
      </div>`
    );

    const input = document.getElementById("ptInput");
    const status = document.getElementById("ptStatus");
    const output = document.getElementById("ptOutput");

    if (cfg.voiceInput) {
      attachDictation(document.getElementById("ptVoice"), input, document.getElementById("ptVoiceStatus"));
    }

    function readValues() {
      const values = {};
      for (const c of cfg.controls || []) {
        if (c.type === "checkboxes") {
          values[c.id] = Array.from(document.querySelectorAll(`#${c.id} input:checked`)).map((el) => el.value);
        } else {
          const el = document.getElementById(c.id);
          values[c.id] = el ? el.value : "";
        }
      }
      return values;
    }

    document.getElementById("ptRun").addEventListener("click", async () => {
      const text = input.value.trim();
      if (!text) {
        status.textContent = "Add some text first.";
        return;
      }
      const { system, prompt } = cfg.build(text, readValues());
      status.textContent = "Working with your AI model…";
      output.textContent = "";
      try {
        output.textContent = await callLLM({ system, prompt, maxTokens: cfg.maxTokens || 1200 });
        status.textContent = "Done.";
      } catch (error) {
        status.textContent = error.message;
      }
    });

    document.getElementById("ptCopy").addEventListener("click", () => copyText(output.textContent, status));
    document.getElementById("ptDownload").addEventListener("click", () => downloadText(`${cfg.file || "output"}.txt`, output.textContent));
    if (cfg.readAloud) {
      document.getElementById("ptSpeak").addEventListener("click", () => speakText(output.textContent));
    }
  });
}

// ---- Writing tools ----
function renderEmailAssistant(mount) {
  renderPromptTool(mount, {
    inputHeading: "Email",
    inputLabel: "What's the email about? (or paste an email to reply to)",
    placeholder: "e.g. Ask the vendor for a revised quote by Friday…",
    runLabel: "Write email",
    maxTokens: 900,
    file: "email",
    controls: [
      { id: "goal", label: "Goal", type: "select", options: ["Write a new email", "Reply to this email"] },
      { id: "tone", label: "Tone", type: "select", options: ["Professional", "Friendly", "Formal", "Direct", "Warm"] },
      { id: "length", label: "Length", type: "select", options: ["Short", "Medium", "Detailed"] }
    ],
    build(input, v) {
      return {
        system:
          "You are an expert email writer. Write clear, natural, ready-to-send emails. If writing a new email, include a subject line, then the body. Return only the email — no preamble or commentary.",
        prompt: `${v.goal === "Reply to this email" ? "Write a reply to the email below." : "Write a new email."}
Tone: ${v.tone}. Length: ${v.length}.

${input}`
      };
    }
  });
}

function renderRewrite(mount) {
  renderPromptTool(mount, {
    inputHeading: "Text",
    inputLabel: "Text to rewrite",
    placeholder: "Paste the text you want to improve…",
    runLabel: "Rewrite",
    maxTokens: 900,
    file: "rewrite",
    controls: [
      {
        id: "style",
        label: "Make it",
        type: "select",
        options: ["Clearer", "Shorter", "Friendlier", "More professional", "More formal", "Simpler", "Expanded"]
      }
    ],
    build(input, v) {
      return {
        system: "You rewrite text while preserving its meaning and intent. Return only the rewritten text.",
        prompt: `Rewrite the text below to be ${v.style.toLowerCase()}.

${input}`
      };
    }
  });
}

function renderReplyGenerator(mount) {
  renderPromptTool(mount, {
    inputHeading: "Message",
    inputLabel: "Paste the message or thread you're replying to",
    placeholder: "Paste an email, Slack message, or DM…",
    runLabel: "Draft replies",
    maxTokens: 900,
    file: "replies",
    controls: [
      { id: "intent", label: "Your intent", type: "select", options: ["Acknowledge", "Say yes", "Say no politely", "Ask a clarifying question", "Push back"] },
      { id: "tone", label: "Tone", type: "select", options: ["Friendly", "Professional", "Casual", "Direct"] }
    ],
    build(input, v) {
      return {
        system:
          "You draft short, natural replies to messages (email, Slack, DM). Return three distinct options, each labeled 'Option 1', 'Option 2', 'Option 3'. Plain text.",
        prompt: `Reply to the message below. Intent: ${v.intent}. Tone: ${v.tone}.

${input}`
      };
    }
  });
}

function renderProofread(mount) {
  renderPromptTool(mount, {
    inputHeading: "Text",
    inputLabel: "Text to proofread",
    placeholder: "Paste text to fix…",
    runLabel: "Proofread",
    maxTokens: 1000,
    file: "proofread",
    build(input) {
      return {
        system: "You are a meticulous proofreader. Fix grammar, spelling, punctuation, and clarity without changing meaning or voice. Plain text.",
        prompt: `Return two sections:
CORRECTED: the corrected text.
CHANGES: a short bullet list of what you changed and why.

Text:
${input}`
      };
    }
  });
}

// ---- Summaries ----
function renderSummarize(mount) {
  renderPromptTool(mount, {
    inputHeading: "Source",
    inputLabel: "Paste text, an article, or a transcript — or use voice",
    placeholder: "Paste anything long here, or click Record voice…",
    runLabel: "Summarize",
    maxTokens: 1300,
    file: "summary",
    voiceInput: true,
    readAloud: true,
    controls: [
      { id: "length", label: "Summary length", type: "select", options: ["Brief", "Standard", "Detailed"] },
      {
        id: "translate",
        label: "Translate to",
        type: "select",
        options: ["No translation", "Spanish", "Hindi", "French", "German", "Portuguese", "Arabic", "Japanese", "Chinese"]
      }
    ],
    build(input, v) {
      const detail =
        v.length === "Brief" ? "Keep it tight: 3-4 key points." : v.length === "Detailed" ? "Be thorough: 7-10 key points." : "5-7 key points.";
      const translate = v.translate && v.translate !== "No translation" ? `\nWrite the entire response in ${v.translate}.` : "";
      return {
        system:
          "You are a precise summarizer. Produce a clear, faithful summary in plain text (no markdown symbols). Do not invent facts.",
        prompt: `Summarize the source below. ${detail}
Return exactly these sections, each heading in capitals followed by a colon on its own line:
TL;DR: one or two sentences.
KEY POINTS: bullet lines starting with "- ".
ACTION ITEMS: concrete next steps as "- ", or "None" if there are none.${translate}

Source:
"""
${input}
"""`
      };
    }
  });
}

function renderMeetingNotes(mount) {
  renderPromptTool(mount, {
    inputHeading: "Notes",
    inputLabel: "Paste meeting notes or a transcript",
    placeholder: "Paste raw notes or a meeting transcript…",
    runLabel: "Make minutes",
    maxTokens: 1500,
    file: "meeting-notes",
    build(input) {
      return {
        system: "You turn raw meeting notes or transcripts into structured minutes. Plain text, no markdown symbols.",
        prompt: `Produce these sections:
SUMMARY: a short paragraph.
DECISIONS: bullet list.
ACTION ITEMS: lines as "- owner — task (due date if mentioned)".
FOLLOW-UP EMAIL: a concise recap email ready to send.

Notes:
${input}`
      };
    }
  });
}

// ---- Voice ----
function renderVoiceNotes(mount) {
  renderPromptTool(mount, {
    inputHeading: "Voice note",
    inputLabel: "Record a voice note (or type / paste)",
    placeholder: "Click Record voice and start talking, or paste a rough note…",
    runLabel: "Clean up & extract tasks",
    maxTokens: 1000,
    file: "voice-notes",
    voiceInput: true,
    build(input) {
      return {
        system: "You turn messy voice notes or rough text into a clean note plus tasks. Plain text.",
        prompt: `From the note below, produce:
NOTE: a cleaned, readable version (fix filler words and run-ons).
SUMMARY: 2-4 bullet points.
TASKS: action items as a checklist, one per line as "- [ ] task".

Note:
${input}`
      };
    }
  });
}

// ---- Social & content ----
function renderAiPostGenerator(mount) {
  renderPromptTool(mount, {
    inputHeading: "Idea",
    inputLabel: "Your idea",
    placeholder: "What do you want to post about?",
    runLabel: "Generate posts",
    maxTokens: 1500,
    file: "ai-posts",
    controls: [
      { id: "platforms", label: "Platforms", type: "checkboxes", options: ["LinkedIn", "X", "Instagram", "Facebook"], defaultCount: 2 },
      { id: "tone", label: "Tone", type: "select", options: ["Practical", "Bold", "Story", "Professional", "Friendly"] }
    ],
    build(input, v) {
      const platforms = v.platforms && v.platforms.length ? v.platforms : ["LinkedIn", "X"];
      return {
        system:
          "You are a social media copywriter. Write platform-native posts that are specific and engaging, with no generic filler. Plain text — no markdown headers.",
        prompt: `Idea: ${input}

Tone: ${v.tone}.
Write one post for each platform: ${platforms.join(", ")}.
For each, put the platform name in capitals on its own line, then the post, then a blank line. Tailor each: LinkedIn = hook + short paragraphs; X = punchy, under 280 characters; Instagram = caption + a few fitting hashtags; Facebook = conversational. Hashtags only where they fit.`
      };
    }
  });
}

function renderRepurpose(mount) {
  renderPromptTool(mount, {
    inputHeading: "Content",
    inputLabel: "Paste the long content (article, transcript, notes)",
    placeholder: "Paste a blog post, transcript, or long notes…",
    runLabel: "Repurpose",
    maxTokens: 1600,
    file: "repurposed",
    controls: [
      {
        id: "formats",
        label: "Turn into",
        type: "checkboxes",
        options: ["LinkedIn post", "X thread", "Instagram carousel outline", "Newsletter blurb", "YouTube description", "Shorts/Reels script"],
        defaultCount: 2
      }
    ],
    build(input, v) {
      const formats = v.formats && v.formats.length ? v.formats : ["LinkedIn post", "X thread"];
      return {
        system: "You repurpose long content into platform-native formats. Plain text; put each format under its own capitalized heading.",
        prompt: `Repurpose the content below into: ${formats.join(", ")}. Keep the core message; adapt length and style to each format.

${input}`
      };
    }
  });
}

function renderHeadlines(mount) {
  renderPromptTool(mount, {
    inputHeading: "Topic",
    inputLabel: "What's it about?",
    placeholder: "e.g. A free tool that turns voice notes into tasks",
    runLabel: "Generate options",
    maxTokens: 700,
    file: "headlines",
    controls: [
      { id: "type", label: "Type", type: "select", options: ["Blog titles", "Email subject lines", "YouTube titles", "Hooks / opening lines", "Product taglines"] },
      { id: "count", label: "How many", type: "select", options: ["5", "8", "10"] }
    ],
    build(input, v) {
      return {
        system: "You are a punchy copywriter. Return a numbered list only — no preamble.",
        prompt: `Write ${v.count} ${v.type.toLowerCase()} for: ${input}
Make them varied: some curiosity-driven, some direct and specific, some benefit-led.`
      };
    }
  });
}

// ---- Translation (no LLM): on-device Translator API if present, else the free keyless MyMemory API ----
function chunkForTranslation(text, maxLen) {
  const parts = String(text).match(/[^.!?]+[.!?]*\s*/g) || [String(text)];
  const chunks = [];
  let cur = "";
  for (const part of parts) {
    if (part.length > maxLen) {
      if (cur.trim()) { chunks.push(cur.trim()); cur = ""; }
      for (let i = 0; i < part.length; i += maxLen) chunks.push(part.slice(i, i + maxLen).trim());
      continue;
    }
    if ((cur + part).length > maxLen && cur) { chunks.push(cur.trim()); cur = ""; }
    cur += part;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.filter(Boolean);
}

async function translateText(text, from, to) {
  if (!to || from === to) return text;
  // Prefer an already-downloaded on-device model (Chrome) — free, private, offline.
  try {
    if (typeof Translator !== "undefined" && Translator.availability) {
      const status = await Translator.availability({ sourceLanguage: from, targetLanguage: to });
      if (status === "available") {
        const translator = await Translator.create({ sourceLanguage: from, targetLanguage: to });
        return await translator.translate(text);
      }
    }
  } catch {
    /* fall through to the network service */
  }
  // Free, keyless fallback. Chunk to respect the per-request limit.
  const out = [];
  for (const chunk of chunkForTranslation(text, 450)) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${encodeURIComponent(from)}|${encodeURIComponent(to)}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    const translated = data && data.responseData && data.responseData.translatedText;
    if (!res.ok || !translated || (data.responseStatus && Number(data.responseStatus) >= 400)) {
      throw new Error("Translation is busy or over its free daily limit. Try again shortly.");
    }
    out.push(translated);
  }
  return out.join(" ");
}

// ---- Browser voice tools (no LLM) ----
function renderSpeechToText(mount) {
  renderShell(
    mount,
    `<div class="tool-grid">
      <div class="panel">
        <h3>Record</h3>
        <p class="hint">Works in browsers that expose the Web Speech Recognition API. Chrome is usually the most reliable.</p>
        <div class="field-grid">
          <div class="field">
            <label for="sttLang">Language</label>
            <select id="sttLang">
              <option value="en-US">English (US)</option>
              <option value="en-IN">English (India)</option>
              <option value="hi-IN">Hindi</option>
              <option value="es-ES">Spanish</option>
              <option value="fr-FR">French</option>
            </select>
          </div>
          <div class="field">
            <label for="sttMode">Mode</label>
            <select id="sttMode">
              <option value="true">Continuous</option>
              <option value="false">Single phrase</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label for="sttTranslate">Translate to</label>
          <select id="sttTranslate">
            <option value="">Off</option>
            <option value="es">Spanish</option>
            <option value="hi">Hindi</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="pt">Portuguese</option>
            <option value="ar">Arabic</option>
            <option value="ja">Japanese</option>
            <option value="zh">Chinese</option>
          </select>
        </div>
        <div class="action-row">
          <button class="primary" id="sttStart">Start recording</button>
          <button class="secondary" id="sttStop">Stop</button>
          <button class="danger" id="sttClear">Clear</button>
        </div>
        <p id="sttStatus" class="status"></p>
      </div>
      <div class="panel">
        <h3>Transcript</h3>
        <textarea id="sttOutput" placeholder="Your transcript appears here..."></textarea>
        <div class="action-row">
          <button class="secondary" id="sttCopy">Copy</button>
          <button class="secondary" id="sttDownload">Download .txt</button>
        </div>
        <div id="sttTransBlock" hidden>
          <h3 style="margin-top:18px">Translation</h3>
          <div id="sttTransOut" class="output"></div>
          <div class="action-row">
            <button class="primary" id="sttTranslateBtn">Translate</button>
            <button class="secondary" id="sttTransCopy">Copy</button>
            <button class="secondary" id="sttTransDownload">Download .txt</button>
          </div>
        </div>
      </div>
    </div>`
  );

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const startButton = document.getElementById("sttStart");
  const stopButton = document.getElementById("sttStop");
  const output = document.getElementById("sttOutput");
  const status = document.getElementById("sttStatus");

  let recognition = null;
  let listening = false; // user intends to keep recording
  let wantContinuous = true; // from the Mode select, read at Start
  let committed = ""; // text finalized in previous recognition sessions
  let sessionFinal = ""; // text finalized in the current session

  if (!SpeechRecognition) {
    status.textContent = "Speech recognition is not available in this browser (try Chrome).";
    startButton.disabled = true;
  }

  function paint(interim) {
    output.value = [committed, sessionFinal, interim]
      .filter((s) => s && s.trim())
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function startRecognition() {
    recognition = new SpeechRecognition();
    recognition.lang = document.getElementById("sttLang").value;
    recognition.continuous = wantContinuous;
    recognition.interimResults = true;
    sessionFinal = "";

    recognition.onstart = () => {
      status.textContent = "Listening…";
    };
    recognition.onerror = (event) => {
      // Fatal → stop for good. Transient (no-speech/aborted/network) → onend restarts.
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        listening = false;
        status.textContent = "Microphone access is blocked. Allow the mic and try again.";
      }
    };
    recognition.onresult = (event) => {
      // Rebuild from the full results list each time so nothing is skipped.
      let interim = "";
      let finals = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finals += `${transcript} `;
        else interim += transcript;
      }
      sessionFinal = finals.trim();
      paint(interim);
    };
    recognition.onend = () => {
      // Fold this session's finalized text into the running transcript.
      if (sessionFinal) {
        committed = `${committed} ${sessionFinal}`.replace(/\s+/g, " ").trim();
        sessionFinal = "";
      }
      paint("");
      // Chrome auto-stops after a few seconds of silence — restart so long
      // dictation keeps going instead of dropping the rest of the speech.
      if (listening && wantContinuous) {
        startRecognition();
      } else {
        listening = false;
        status.textContent = "Recording stopped.";
        if (document.getElementById("sttTranslate").value) runTranslate();
      }
    };

    try {
      recognition.start();
    } catch {
      /* ignore a transient "already started"; next onend will recreate it */
    }
  }

  startButton.addEventListener("click", () => {
    if (!SpeechRecognition || listening) return;
    committed = output.value.trim();
    sessionFinal = "";
    wantContinuous = document.getElementById("sttMode").value === "true";
    listening = true;
    startRecognition();
  });

  stopButton.addEventListener("click", () => {
    listening = false;
    if (recognition) recognition.stop();
    status.textContent = "Recording stopped.";
  });

  document.getElementById("sttClear").addEventListener("click", () => {
    committed = "";
    sessionFinal = "";
    output.value = "";
    status.textContent = "Transcript cleared.";
  });

  document.getElementById("sttCopy").addEventListener("click", () => copyText(output.value, status));
  document.getElementById("sttDownload").addEventListener("click", () => downloadText("speech-transcript.txt", output.value));

  // Optional translation (off by default; no LLM).
  const translateSel = document.getElementById("sttTranslate");
  const transBlock = document.getElementById("sttTransBlock");
  const transOut = document.getElementById("sttTransOut");
  translateSel.addEventListener("change", () => {
    transBlock.hidden = !translateSel.value;
  });
  async function runTranslate() {
    const to = translateSel.value;
    if (!to) return;
    const text = output.value.trim();
    if (!text) {
      status.textContent = "Nothing to translate yet.";
      return;
    }
    const from = (document.getElementById("sttLang").value || "en").split("-")[0];
    status.textContent = "Translating…";
    try {
      transOut.textContent = await translateText(text, from, to);
      status.textContent = "Translated.";
    } catch (error) {
      status.textContent = error.message;
    }
  }
  document.getElementById("sttTranslateBtn").addEventListener("click", runTranslate);
  document.getElementById("sttTransCopy").addEventListener("click", () => copyText(transOut.textContent, status));
  document.getElementById("sttTransDownload").addEventListener("click", () => downloadText("translation.txt", transOut.textContent));
}

function renderTextToSpeech(mount) {
  renderShell(
    mount,
    `<div class="tool-grid">
      <div class="panel">
        <h3>Text</h3>
        <textarea id="ttsText" placeholder="Paste the text you want to hear...">Welcome to Unleash My AI. This text to speech tool uses your browser, not an AI model.</textarea>
        <div class="field-grid">
          <div class="field">
            <label for="ttsVoice">Voice</label>
            <select id="ttsVoice"></select>
          </div>
          <div class="field">
            <label for="ttsRate">Speed</label>
            <input id="ttsRate" type="range" min="0.6" max="1.6" step="0.1" value="1">
          </div>
          <div class="field">
            <label for="ttsPitch">Pitch</label>
            <input id="ttsPitch" type="range" min="0.6" max="1.6" step="0.1" value="1">
          </div>
          <div class="field">
            <label for="ttsVolume">Volume</label>
            <input id="ttsVolume" type="range" min="0" max="1" step="0.1" value="1">
          </div>
        </div>
        <div class="action-row">
          <button class="primary" id="ttsSpeak">Speak</button>
          <button class="secondary" id="ttsPause">Pause</button>
          <button class="secondary" id="ttsResume">Resume</button>
          <button class="danger" id="ttsStop">Stop</button>
        </div>
        <p id="ttsStatus" class="status"></p>
      </div>
      <div class="panel">
        <h3>Notes</h3>
        <div class="output">This tool uses the browser SpeechSynthesis API. Browser voices are playable, but direct audio file export is not supported consistently without recording system audio. Use the text download button for scripts and browser playback for review.</div>
        <div class="action-row">
          <button class="secondary" id="ttsDownload">Download script</button>
        </div>
      </div>
    </div>`
  );

  const voiceSelect = document.getElementById("ttsVoice");
  const status = document.getElementById("ttsStatus");

  function loadVoices() {
    const voices = speechSynthesis.getVoices();
    voiceSelect.innerHTML = voices
      .map((voice, index) => `<option value="${index}">${escapeHtml(voice.name)} (${escapeHtml(voice.lang)})</option>`)
      .join("");
  }

  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;

  document.getElementById("ttsSpeak").addEventListener("click", () => {
    const text = document.getElementById("ttsText").value.trim();
    if (!text) {
      status.textContent = "Enter some text first.";
      return;
    }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    utterance.voice = voices[Number(voiceSelect.value)] || null;
    utterance.rate = Number(document.getElementById("ttsRate").value);
    utterance.pitch = Number(document.getElementById("ttsPitch").value);
    utterance.volume = Number(document.getElementById("ttsVolume").value);
    utterance.onstart = () => {
      status.textContent = "Speaking...";
    };
    utterance.onend = () => {
      status.textContent = "Finished.";
    };
    speechSynthesis.speak(utterance);
  });

  document.getElementById("ttsPause").addEventListener("click", () => speechSynthesis.pause());
  document.getElementById("ttsResume").addEventListener("click", () => speechSynthesis.resume());
  document.getElementById("ttsStop").addEventListener("click", () => {
    speechSynthesis.cancel();
    status.textContent = "Stopped.";
  });
  document.getElementById("ttsDownload").addEventListener("click", () => downloadText("text-to-speech-script.txt", document.getElementById("ttsText").value));
}

// ================= Free tools (no LLM, no key, run in the browser) =================

// ---- Text tools ----
function renderWordCounter(mount) {
  renderShell(mount, `<div class="tool-grid">
    <div class="panel"><h3>Text</h3><div class="field"><textarea id="wcIn" placeholder="Type or paste text…"></textarea></div></div>
    <div class="panel"><h3>Counts</h3><div id="wcOut" class="output"></div></div>
  </div>`);
  const inp = document.getElementById("wcIn");
  const out = document.getElementById("wcOut");
  function update() {
    const t = inp.value;
    const words = (t.match(/\S+/g) || []).length;
    const sentences = (t.match(/[.!?]+(\s|$)/g) || []).length;
    const paras = t.split(/\n{2,}/).filter((s) => s.trim()).length;
    const mins = Math.max(1, Math.round(words / 200));
    out.textContent = `Words: ${words}\nCharacters: ${t.length}\nCharacters (no spaces): ${t.replace(/\s/g, "").length}\nSentences: ${sentences}\nParagraphs: ${paras}\nReading time: ~${mins} min`;
  }
  inp.addEventListener("input", update);
  update();
}

function renderCaseConverter(mount) {
  renderShell(mount, `<div class="tool-grid">
    <div class="panel"><h3>Text</h3><div class="field"><textarea id="ccIn" placeholder="Type or paste text…"></textarea></div>
      <div class="action-row">
        <button class="secondary" data-case="upper">UPPER</button>
        <button class="secondary" data-case="lower">lower</button>
        <button class="secondary" data-case="title">Title</button>
        <button class="secondary" data-case="sentence">Sentence</button>
        <button class="secondary" data-case="camel">camelCase</button>
        <button class="secondary" data-case="snake">snake_case</button>
        <button class="secondary" data-case="kebab">kebab-case</button>
      </div>
    </div>
    <div class="panel"><h3>Result</h3><div id="ccOut" class="output"></div>
      <div class="action-row"><button class="secondary" id="ccCopy">Copy</button></div>
    </div>
  </div>`);
  const inp = document.getElementById("ccIn");
  const out = document.getElementById("ccOut");
  const words = (t) => t.trim().split(/\s+/).filter(Boolean);
  const fns = {
    upper: (t) => t.toUpperCase(),
    lower: (t) => t.toLowerCase(),
    title: (t) => t.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()),
    sentence: (t) => t.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase()),
    camel: (t) => words(t.toLowerCase()).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join(""),
    snake: (t) => words(t.toLowerCase()).join("_"),
    kebab: (t) => words(t.toLowerCase()).join("-")
  };
  document.querySelectorAll("[data-case]").forEach((btn) =>
    btn.addEventListener("click", () => {
      out.textContent = fns[btn.dataset.case](inp.value);
    })
  );
  document.getElementById("ccCopy").addEventListener("click", () => copyText(out.textContent));
}

function renderTextCleaner(mount) {
  renderShell(mount, `<div class="tool-grid">
    <div class="panel"><h3>Text</h3><div class="field"><textarea id="tcIn" placeholder="Paste lines or text…"></textarea></div>
      <div class="field-grid">
        <div class="field"><label for="tcFind">Find</label><input id="tcFind" placeholder="text or /regex/"></div>
        <div class="field"><label for="tcReplace">Replace with</label><input id="tcReplace" placeholder="replacement"></div>
      </div>
      <div class="metric-row">
        <label class="metric" style="cursor:pointer"><input type="checkbox" id="tcTrim" checked style="width:auto;min-height:auto;margin-right:6px">Trim lines</label>
        <label class="metric" style="cursor:pointer"><input type="checkbox" id="tcBlank" checked style="width:auto;min-height:auto;margin-right:6px">Remove blank lines</label>
        <label class="metric" style="cursor:pointer"><input type="checkbox" id="tcDedupe" style="width:auto;min-height:auto;margin-right:6px">Dedupe</label>
        <label class="metric" style="cursor:pointer"><input type="checkbox" id="tcSort" style="width:auto;min-height:auto;margin-right:6px">Sort A–Z</label>
      </div>
      <div class="action-row"><button class="primary" id="tcRun">Clean</button></div>
    </div>
    <div class="panel"><h3>Result</h3><div id="tcOut" class="output"></div>
      <div class="action-row"><button class="secondary" id="tcCopy">Copy</button></div>
    </div>
  </div>`);
  const out = document.getElementById("tcOut");
  document.getElementById("tcRun").addEventListener("click", () => {
    let text = document.getElementById("tcIn").value;
    const find = document.getElementById("tcFind").value;
    const rep = document.getElementById("tcReplace").value;
    if (find) {
      try {
        const m = find.match(/^\/(.*)\/([a-z]*)$/);
        text = m ? text.replace(new RegExp(m[1], m[2] || "g"), rep) : text.split(find).join(rep);
      } catch {
        out.textContent = "Invalid regex.";
        return;
      }
    }
    let lines = text.split("\n");
    if (document.getElementById("tcTrim").checked) lines = lines.map((l) => l.trim());
    if (document.getElementById("tcBlank").checked) lines = lines.filter((l) => l.trim());
    if (document.getElementById("tcDedupe").checked) lines = [...new Set(lines)];
    if (document.getElementById("tcSort").checked) lines = lines.sort((a, b) => a.localeCompare(b));
    out.textContent = lines.join("\n");
  });
  document.getElementById("tcCopy").addEventListener("click", () => copyText(out.textContent));
}

function renderJsonFormatter(mount) {
  renderShell(mount, `<div class="tool-grid">
    <div class="panel"><h3>JSON</h3><div class="field"><textarea id="jfIn" placeholder='{"paste":"your JSON here"}'></textarea></div>
      <div class="action-row"><button class="primary" id="jfPretty">Format</button><button class="secondary" id="jfMin">Minify</button></div>
      <p id="jfStatus" class="status"></p>
    </div>
    <div class="panel"><h3>Result</h3><div id="jfOut" class="output"></div>
      <div class="action-row"><button class="secondary" id="jfCopy">Copy</button></div>
    </div>
  </div>`);
  const out = document.getElementById("jfOut");
  const status = document.getElementById("jfStatus");
  function run(minify) {
    try {
      const parsed = JSON.parse(document.getElementById("jfIn").value);
      out.textContent = JSON.stringify(parsed, null, minify ? 0 : 2);
      status.textContent = "Valid JSON.";
    } catch (e) {
      status.textContent = `Invalid JSON: ${e.message}`;
    }
  }
  document.getElementById("jfPretty").addEventListener("click", () => run(false));
  document.getElementById("jfMin").addEventListener("click", () => run(true));
  document.getElementById("jfCopy").addEventListener("click", () => copyText(out.textContent, status));
}

function renderMarkdownPreview(mount) {
  renderShell(mount, `<div class="tool-grid">
    <div class="panel"><h3>Markdown</h3><div class="field"><textarea id="mdIn" placeholder="# Heading&#10;**bold**, *italic*, [link](https://…)&#10;- list item"></textarea></div></div>
    <div class="panel"><h3>Preview</h3><div id="mdOut" class="output"></div></div>
  </div>`);
  const inp = document.getElementById("mdIn");
  const out = document.getElementById("mdOut");
  function render() {
    let h = escapeHtml(inp.value);
    h = h
      .replace(/^### (.*)$/gm, "<h4>$1</h4>")
      .replace(/^## (.*)$/gm, "<h3>$1</h3>")
      .replace(/^# (.*)$/gm, "<h2>$1</h2>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      .replace(/^\s*[-*] (.*)$/gm, "<li>$1</li>");
    h = h.replace(/(?:<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
    h = h.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>");
    out.innerHTML = `<p>${h}</p>`;
  }
  inp.addEventListener("input", render);
  render();
}

// ---- Developer tools ----
function renderBase64(mount) {
  renderShell(mount, `<div class="tool-grid">
    <div class="panel"><h3>Input</h3><div class="field"><textarea id="b64In" placeholder="Text to encode, or Base64 to decode…"></textarea></div>
      <div class="action-row"><button class="primary" id="b64Enc">Encode</button><button class="secondary" id="b64Dec">Decode</button></div>
      <p id="b64Status" class="status"></p>
    </div>
    <div class="panel"><h3>Result</h3><div id="b64Out" class="output"></div>
      <div class="action-row"><button class="secondary" id="b64Copy">Copy</button></div>
    </div>
  </div>`);
  const out = document.getElementById("b64Out");
  const status = document.getElementById("b64Status");
  const val = () => document.getElementById("b64In").value;
  document.getElementById("b64Enc").addEventListener("click", () => {
    try { out.textContent = btoa(unescape(encodeURIComponent(val()))); status.textContent = ""; }
    catch { status.textContent = "Could not encode."; }
  });
  document.getElementById("b64Dec").addEventListener("click", () => {
    try { out.textContent = decodeURIComponent(escape(atob(val().trim()))); status.textContent = ""; }
    catch { status.textContent = "Not valid Base64."; }
  });
  document.getElementById("b64Copy").addEventListener("click", () => copyText(out.textContent, status));
}

function renderUrlEncoder(mount) {
  renderShell(mount, `<div class="tool-grid">
    <div class="panel"><h3>Input</h3><div class="field"><textarea id="urlIn" placeholder="Text or URL…"></textarea></div>
      <div class="action-row"><button class="primary" id="urlEnc">Encode</button><button class="secondary" id="urlDec">Decode</button></div>
      <p id="urlStatus" class="status"></p>
    </div>
    <div class="panel"><h3>Result</h3><div id="urlOut" class="output"></div>
      <div class="action-row"><button class="secondary" id="urlCopy">Copy</button></div>
    </div>
  </div>`);
  const out = document.getElementById("urlOut");
  const status = document.getElementById("urlStatus");
  const val = () => document.getElementById("urlIn").value;
  document.getElementById("urlEnc").addEventListener("click", () => { out.textContent = encodeURIComponent(val()); status.textContent = ""; });
  document.getElementById("urlDec").addEventListener("click", () => {
    try { out.textContent = decodeURIComponent(val()); status.textContent = ""; } catch { status.textContent = "Could not decode."; }
  });
  document.getElementById("urlCopy").addEventListener("click", () => copyText(out.textContent, status));
}

function renderHashGenerator(mount) {
  renderShell(mount, `<div class="tool-grid">
    <div class="panel"><h3>Input</h3><div class="field"><textarea id="hashIn" placeholder="Text to hash…"></textarea></div>
      <div class="field"><label for="hashAlg">Algorithm</label><select id="hashAlg"><option>SHA-256</option><option>SHA-1</option><option>SHA-384</option><option>SHA-512</option></select></div>
      <div class="action-row"><button class="primary" id="hashRun">Hash</button></div>
      <p id="hashStatus" class="status"></p>
    </div>
    <div class="panel"><h3>Digest (hex)</h3><div id="hashOut" class="output"></div>
      <div class="action-row"><button class="secondary" id="hashCopy">Copy</button></div>
    </div>
  </div>`);
  const out = document.getElementById("hashOut");
  const status = document.getElementById("hashStatus");
  document.getElementById("hashRun").addEventListener("click", async () => {
    try {
      const data = new TextEncoder().encode(document.getElementById("hashIn").value);
      const buf = await crypto.subtle.digest(document.getElementById("hashAlg").value, data);
      out.textContent = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
      status.textContent = "";
    } catch { status.textContent = "Hashing failed in this browser."; }
  });
  document.getElementById("hashCopy").addEventListener("click", () => copyText(out.textContent, status));
}

function renderUuidGenerator(mount) {
  renderShell(mount, `<div class="tool-grid">
    <div class="panel"><h3>Generate</h3>
      <div class="field"><label for="uuidCount">How many</label><select id="uuidCount"><option>1</option><option>5</option><option>10</option><option>25</option></select></div>
      <div class="action-row"><button class="primary" id="uuidRun">Generate UUIDs</button><button class="secondary" id="uuidCopy">Copy</button></div>
    </div>
    <div class="panel"><h3>UUIDs (v4)</h3><div id="uuidOut" class="output"></div></div>
  </div>`);
  const out = document.getElementById("uuidOut");
  function gen() {
    const n = Number(document.getElementById("uuidCount").value);
    out.textContent = Array.from({ length: n }, () => (crypto.randomUUID ? crypto.randomUUID() : "")).join("\n");
  }
  document.getElementById("uuidRun").addEventListener("click", gen);
  document.getElementById("uuidCopy").addEventListener("click", () => copyText(out.textContent));
}

function renderRegexTester(mount) {
  renderShell(mount, `<div class="tool-grid">
    <div class="panel"><h3>Pattern</h3>
      <div class="field-grid">
        <div class="field"><label for="reInput">Regex</label><input id="reInput" placeholder="\\d+"></div>
        <div class="field"><label for="reFlags">Flags</label><input id="reFlags" value="g" placeholder="gi"></div>
      </div>
      <div class="field"><label for="reText">Test string</label><textarea id="reText" placeholder="Text to search…"></textarea></div>
      <p id="reStatus" class="status"></p>
    </div>
    <div class="panel"><h3>Matches</h3><div id="reOut" class="output"></div></div>
  </div>`);
  const out = document.getElementById("reOut");
  const status = document.getElementById("reStatus");
  function run() {
    const pat = document.getElementById("reInput").value;
    if (!pat) { out.textContent = ""; status.textContent = ""; return; }
    try {
      const re = new RegExp(pat, (document.getElementById("reFlags").value || "").includes("g") ? document.getElementById("reFlags").value : `${document.getElementById("reFlags").value}g`);
      const matches = [...document.getElementById("reText").value.matchAll(re)];
      status.textContent = `${matches.length} match(es).`;
      out.textContent = matches.map((m, i) => `${i + 1}. "${m[0]}"${m.length > 1 ? " — groups: " + m.slice(1).map((g) => JSON.stringify(g)).join(", ") : ""}`).join("\n");
    } catch (e) { status.textContent = `Invalid regex: ${e.message}`; }
  }
  ["reInput", "reFlags", "reText"].forEach((id) => document.getElementById(id).addEventListener("input", run));
}

function renderTimestampConverter(mount) {
  const ZONES = ["Local", "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];
  renderShell(mount, `<div class="tool-grid">
    <div class="panel"><h3>Convert</h3>
      <div class="field"><label for="tsZone">Timezone</label><select id="tsZone">${ZONES.map((z) => `<option>${z}</option>`).join("")}</select></div>

      <div class="field" style="margin-top:14px"><label for="tsEpoch">Unix timestamp (seconds or ms)</label><input id="tsEpoch" placeholder="1700000000"></div>
      <div class="action-row"><button class="primary" id="tsToDate">Timestamp → Date</button><button class="secondary" id="tsNow">Now</button></div>

      <div class="field" style="margin-top:16px"><label for="tsDate">Date &amp; time</label><input id="tsDate" type="datetime-local" step="1"></div>
      <div class="action-row"><button class="primary" id="tsToEpoch">Date → Timestamp</button></div>
      <p id="tsStatus" class="status"></p>
    </div>
    <div class="panel"><h3>Result</h3><div id="tsOut" class="output"></div></div>
  </div>`);
  const out = document.getElementById("tsOut");
  const status = document.getElementById("tsStatus");
  const zoneEl = document.getElementById("tsZone");
  const tz = () => (zoneEl.value === "Local" ? undefined : zoneEl.value);

  // Offset (ms) of a timezone from UTC at a given instant.
  function offsetMs(zone, date) {
    if (!zone) return -date.getTimezoneOffset() * 60000;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).formatToParts(date).reduce((a, x) => ((a[x.type] = x.value), a), {});
    const hour = parts.hour === "24" ? 0 : Number(parts.hour);
    const asUTC = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, Number(parts.minute), Number(parts.second));
    return asUTC - date.getTime();
  }

  function fmt(ms) {
    const d = new Date(ms);
    const readable = d.toLocaleString(undefined, {
      timeZone: tz(), weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short"
    });
    return `In ${zoneEl.value}:  ${readable}\nUTC (ISO):  ${d.toISOString()}\nSeconds:  ${Math.floor(ms / 1000)}\nMillis:  ${ms}`;
  }

  document.getElementById("tsToDate").addEventListener("click", () => {
    let n = Number(document.getElementById("tsEpoch").value.trim());
    if (!n) { status.textContent = "Enter a timestamp."; return; }
    if (Math.abs(n) < 1e12) n *= 1000; // seconds → ms
    out.textContent = fmt(n);
    status.textContent = "";
  });

  document.getElementById("tsNow").addEventListener("click", () => {
    const now = Date.now();
    document.getElementById("tsEpoch").value = Math.floor(now / 1000);
    out.textContent = fmt(now);
    status.textContent = "";
  });

  document.getElementById("tsToEpoch").addEventListener("click", () => {
    const v = document.getElementById("tsDate").value;
    const m = v && v.match(/(\d+)-(\d+)-(\d+)T(\d+):(\d+)(?::(\d+))?/);
    if (!m) { status.textContent = "Pick a date and time."; return; }
    const naiveUTC = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    const ms = naiveUTC - offsetMs(tz(), new Date(naiveUTC));
    out.textContent = fmt(ms);
    status.textContent = "";
  });

  zoneEl.addEventListener("change", () => {
    const n = Number(document.getElementById("tsEpoch").value.trim());
    if (n) out.textContent = fmt(Math.abs(n) < 1e12 ? n * 1000 : n);
  });
}

function renderColorConverter(mount) {
  renderShell(mount, `<div class="tool-grid">
    <div class="panel"><h3>Color</h3>
      <div class="field"><label for="colIn">Hex or rgb()</label><input id="colIn" placeholder="#0f766e or rgb(15,118,110)"></div>
      <input id="colPick" type="color" value="#0f766e" style="height:44px;padding:2px">
    </div>
    <div class="panel"><h3>Values</h3>
      <div id="colSwatch" style="height:52px;border-radius:8px;border:1px solid var(--line);margin-bottom:12px"></div>
      <div id="colOut" class="output"></div>
      <div class="action-row"><button class="secondary" id="colCopy">Copy</button></div>
    </div>
  </div>`);
  const out = document.getElementById("colOut");
  const swatch = document.getElementById("colSwatch");
  function toRgb(str) {
    str = str.trim();
    let m = str.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) {
      let h = m[1];
      if (h.length === 3) h = h.split("").map((c) => c + c).join("");
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    m = str.match(/rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i);
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
    return null;
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }
  function update(str) {
    const rgb = toRgb(str);
    if (!rgb) { out.textContent = "Enter a valid hex or rgb() color."; return; }
    const hex = "#" + rgb.map((n) => n.toString(16).padStart(2, "0")).join("");
    const [h, s, l] = rgbToHsl(...rgb);
    swatch.style.background = hex;
    out.textContent = `HEX: ${hex}\nRGB: rgb(${rgb.join(", ")})\nHSL: hsl(${h}, ${s}%, ${l}%)`;
  }
  document.getElementById("colIn").addEventListener("input", (e) => update(e.target.value));
  document.getElementById("colPick").addEventListener("input", (e) => { document.getElementById("colIn").value = e.target.value; update(e.target.value); });
  document.getElementById("colCopy").addEventListener("click", () => copyText(out.textContent));
  update("#0f766e");
}

// ---- Calculators ----
function renderPasswordGenerator(mount) {
  renderShell(mount, `<div class="tool-grid">
    <div class="panel"><h3>Options</h3>
      <div class="field"><label for="pwLen">Length: <span id="pwLenVal">16</span></label><input id="pwLen" type="range" min="6" max="64" value="16"></div>
      <div class="metric-row">
        <label class="metric" style="cursor:pointer"><input type="checkbox" id="pwUpper" checked style="width:auto;min-height:auto;margin-right:6px">A–Z</label>
        <label class="metric" style="cursor:pointer"><input type="checkbox" id="pwLower" checked style="width:auto;min-height:auto;margin-right:6px">a–z</label>
        <label class="metric" style="cursor:pointer"><input type="checkbox" id="pwDigits" checked style="width:auto;min-height:auto;margin-right:6px">0–9</label>
        <label class="metric" style="cursor:pointer"><input type="checkbox" id="pwSymbols" checked style="width:auto;min-height:auto;margin-right:6px">!@#$</label>
      </div>
      <div class="action-row"><button class="primary" id="pwRun">Generate</button><button class="secondary" id="pwCopy">Copy</button></div>
      <p id="pwStatus" class="status"></p>
    </div>
    <div class="panel"><h3>Password</h3><div id="pwOut" class="output" style="font-size:1.1rem"></div></div>
  </div>`);
  const out = document.getElementById("pwOut");
  const status = document.getElementById("pwStatus");
  const lenInput = document.getElementById("pwLen");
  lenInput.addEventListener("input", () => (document.getElementById("pwLenVal").textContent = lenInput.value));
  function gen() {
    let pool = "";
    if (document.getElementById("pwUpper").checked) pool += "ABCDEFGHJKLMNPQRSTUVWXYZ";
    if (document.getElementById("pwLower").checked) pool += "abcdefghijkmnpqrstuvwxyz";
    if (document.getElementById("pwDigits").checked) pool += "23456789";
    if (document.getElementById("pwSymbols").checked) pool += "!@#$%^&*-_=+?";
    if (!pool) { status.textContent = "Pick at least one character set."; return; }
    const len = Number(lenInput.value);
    const rnd = new Uint32Array(len);
    crypto.getRandomValues(rnd);
    out.textContent = Array.from(rnd, (n) => pool[n % pool.length]).join("");
    status.textContent = "";
  }
  document.getElementById("pwRun").addEventListener("click", gen);
  document.getElementById("pwCopy").addEventListener("click", () => copyText(out.textContent, status));
  gen();
}

function renderUnitConverter(mount) {
  const UNITS = {
    Length: { base: "m", units: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254 } },
    Weight: { base: "g", units: { kg: 1000, g: 1, mg: 0.001, lb: 453.592, oz: 28.3495 } },
    Temperature: { units: { "°C": 1, "°F": 1, K: 1 } }
  };
  renderShell(mount, `<div class="tool-grid">
    <div class="panel"><h3>Convert</h3>
      <div class="field"><label for="ucCat">Category</label><select id="ucCat">${Object.keys(UNITS).map((c) => `<option>${c}</option>`).join("")}</select></div>
      <div class="field"><label for="ucVal">Value</label><input id="ucVal" type="number" value="1"></div>
      <div class="field-grid">
        <div class="field"><label for="ucFrom">From</label><select id="ucFrom"></select></div>
        <div class="field"><label for="ucTo">To</label><select id="ucTo"></select></div>
      </div>
    </div>
    <div class="panel"><h3>Result</h3><div id="ucOut" class="output" style="font-size:1.15rem"></div></div>
  </div>`);
  const catSel = document.getElementById("ucCat");
  const fromSel = document.getElementById("ucFrom");
  const toSel = document.getElementById("ucTo");
  const out = document.getElementById("ucOut");
  function fillUnits() {
    const cat = UNITS[catSel.value] ? catSel.value : Object.keys(UNITS)[0];
    const keys = Object.keys(UNITS[cat].units);
    fromSel.innerHTML = keys.map((u) => `<option>${u}</option>`).join("");
    toSel.innerHTML = keys.map((u) => `<option>${u}</option>`).join("");
    if (keys[1]) toSel.value = keys[1];
  }
  function convertTemp(v, from, to) {
    let c = from === "°C" ? v : from === "°F" ? (v - 32) * 5 / 9 : v - 273.15;
    return to === "°C" ? c : to === "°F" ? c * 9 / 5 + 32 : c + 273.15;
  }
  function compute() {
    const v = Number(document.getElementById("ucVal").value);
    const cat = UNITS[catSel.value] ? catSel.value : Object.keys(UNITS)[0];
    let result;
    if (cat === "Temperature") result = convertTemp(v, fromSel.value, toSel.value);
    else { const u = UNITS[cat].units; result = (v * u[fromSel.value]) / u[toSel.value]; }
    out.textContent = `${v} ${fromSel.value} = ${Number(result.toFixed(6))} ${toSel.value}`;
  }
  catSel.addEventListener("change", () => { fillUnits(); compute(); });
  [fromSel, toSel, document.getElementById("ucVal")].forEach((el) => el.addEventListener("input", compute));
  fillUnits();
  compute();
}

function renderPercentageCalculator(mount) {
  renderShell(mount, `<div class="tool-grid">
    <div class="panel"><h3>Percentage</h3>
      <div class="field"><label for="pcMode">Calculate</label><select id="pcMode">
        <option>What is A% of B</option><option>A is what percent of B</option><option>Percent change A → B</option>
      </select></div>
      <div class="field-grid">
        <div class="field"><label for="pcA">A</label><input id="pcA" type="number" value="10"></div>
        <div class="field"><label for="pcB">B</label><input id="pcB" type="number" value="200"></div>
      </div>
      <div id="pcOut" class="output" style="font-size:1.1rem"></div>
    </div>
    <div class="panel"><h3>Tip split</h3>
      <div class="field-grid">
        <div class="field"><label for="tipBill">Bill</label><input id="tipBill" type="number" value="80"></div>
        <div class="field"><label for="tipPct">Tip %</label><input id="tipPct" type="number" value="15"></div>
        <div class="field"><label for="tipPeople">People</label><input id="tipPeople" type="number" value="2"></div>
      </div>
      <div id="tipOut" class="output"></div>
    </div>
  </div>`);
  const pcOut = document.getElementById("pcOut");
  function pc() {
    const a = Number(document.getElementById("pcA").value);
    const b = Number(document.getElementById("pcB").value);
    const mode = document.getElementById("pcMode").value;
    let r = "";
    if (mode.startsWith("What")) r = `${a}% of ${b} = ${Number(((a / 100) * b).toFixed(4))}`;
    else if (mode.startsWith("A is")) r = b ? `${a} is ${Number(((a / b) * 100).toFixed(4))}% of ${b}` : "B can't be 0";
    else r = a ? `Change: ${Number((((b - a) / a) * 100).toFixed(4))}%` : "A can't be 0";
    pcOut.textContent = r;
  }
  const tipOut = document.getElementById("tipOut");
  function tip() {
    const bill = Number(document.getElementById("tipBill").value);
    const pct = Number(document.getElementById("tipPct").value);
    const people = Math.max(1, Number(document.getElementById("tipPeople").value));
    const t = bill * (pct / 100);
    const total = bill + t;
    tipOut.textContent = `Tip: ${t.toFixed(2)}\nTotal: ${total.toFixed(2)}\nPer person: ${(total / people).toFixed(2)}`;
  }
  ["pcMode", "pcA", "pcB"].forEach((id) => document.getElementById(id).addEventListener("input", pc));
  ["tipBill", "tipPct", "tipPeople"].forEach((id) => document.getElementById(id).addEventListener("input", tip));
  pc(); tip();
}

function renderDateCalculator(mount) {
  renderShell(mount, `<div class="tool-grid">
    <div class="panel"><h3>Difference between dates</h3>
      <div class="field-grid">
        <div class="field"><label for="dcStart">Start</label><input id="dcStart" type="date"></div>
        <div class="field"><label for="dcEnd">End</label><input id="dcEnd" type="date"></div>
      </div>
      <div id="dcOut" class="output"></div>
    </div>
    <div class="panel"><h3>Age</h3>
      <div class="field"><label for="dcBirth">Birth date</label><input id="dcBirth" type="date"></div>
      <div id="dcAge" class="output"></div>
    </div>
  </div>`);
  const dcOut = document.getElementById("dcOut");
  function diff() {
    const s = new Date(document.getElementById("dcStart").value);
    const e = new Date(document.getElementById("dcEnd").value);
    if (isNaN(s) || isNaN(e)) { dcOut.textContent = "Pick both dates."; return; }
    const days = Math.round((e - s) / 86400000);
    dcOut.textContent = `Days: ${days}\nWeeks: ${Math.floor(Math.abs(days) / 7)} (+${Math.abs(days) % 7}d)\n~Months: ${(days / 30.44).toFixed(1)}\n~Years: ${(days / 365.25).toFixed(2)}`;
  }
  const dcAge = document.getElementById("dcAge");
  function age() {
    const b = new Date(document.getElementById("dcBirth").value);
    if (isNaN(b)) { dcAge.textContent = "Pick a birth date."; return; }
    const now = new Date();
    let y = now.getFullYear() - b.getFullYear();
    let m = now.getMonth() - b.getMonth();
    let d = now.getDate() - b.getDate();
    if (d < 0) m -= 1;
    if (m < 0) { y -= 1; m += 12; }
    dcAge.textContent = `${y} years, ${((m % 12) + 12) % 12} months\nTotal days: ${Math.floor((now - b) / 86400000)}`;
  }
  ["dcStart", "dcEnd"].forEach((id) => document.getElementById(id).addEventListener("input", diff));
  document.getElementById("dcBirth").addEventListener("input", age);
}

function renderPomodoro(mount) {
  renderShell(mount, `<div class="tool-grid">
    <div class="panel"><h3>Timer</h3>
      <div class="field-grid">
        <div class="field"><label for="pmWork">Focus (min)</label><input id="pmWork" type="number" value="25"></div>
        <div class="field"><label for="pmBreak">Break (min)</label><input id="pmBreak" type="number" value="5"></div>
      </div>
      <div class="action-row"><button class="primary" id="pmStart">Start</button><button class="secondary" id="pmPause">Pause</button><button class="danger" id="pmReset">Reset</button></div>
      <p id="pmStatus" class="status"></p>
    </div>
    <div class="panel"><h3 id="pmPhase">Focus</h3><div class="output" id="pmClock" style="font-size:2.6rem;text-align:center;letter-spacing:1px">25:00.000</div></div>
  </div>`);
  const clock = document.getElementById("pmClock");
  const phaseEl = document.getElementById("pmPhase");
  const status = document.getElementById("pmStatus");
  let phase = "Focus";
  let remainingMs = 25 * 60000;
  let endAt = null; // wall-clock target while running (keeps it drift-free)
  let timer = null;

  function phaseDurationMs(p) {
    return Math.max(0, Number(document.getElementById(p === "Focus" ? "pmWork" : "pmBreak").value)) * 60000;
  }
  function show(ms) {
    const c = Math.max(0, ms);
    const m = String(Math.floor(c / 60000)).padStart(2, "0");
    const s = String(Math.floor((c % 60000) / 1000)).padStart(2, "0");
    const mmm = String(Math.floor(c % 1000)).padStart(3, "0");
    clock.textContent = `${m}:${s}.${mmm}`;
    phaseEl.textContent = phase;
  }
  function frame() {
    if (!document.body.contains(clock)) { clearInterval(timer); return; } // stop after leaving the tool
    const ms = endAt - Date.now();
    if (ms <= 0) {
      phase = phase === "Focus" ? "Break" : "Focus";
      remainingMs = phaseDurationMs(phase);
      endAt = Date.now() + remainingMs;
      status.textContent = `${phase} time!`;
      show(remainingMs);
      return;
    }
    show(ms);
  }
  document.getElementById("pmStart").addEventListener("click", () => {
    clearInterval(timer);
    endAt = Date.now() + remainingMs;
    timer = setInterval(frame, 31);
    status.textContent = "Running…";
  });
  document.getElementById("pmPause").addEventListener("click", () => {
    if (endAt) remainingMs = Math.max(0, endAt - Date.now());
    clearInterval(timer);
    endAt = null;
    status.textContent = "Paused.";
    show(remainingMs);
  });
  document.getElementById("pmReset").addEventListener("click", () => {
    clearInterval(timer);
    endAt = null;
    phase = "Focus";
    remainingMs = phaseDurationMs("Focus");
    status.textContent = "";
    show(remainingMs);
  });
  show(remainingMs);
}

// ---- Image tools (in-browser via canvas) ----
function renderImageCompress(mount) {
  renderShell(
    mount,
    `<div class="tool-grid">
      <div class="panel">
        <div class="img-editor-head">
          <h3 style="margin:0">Crop &amp; resize</h3>
          <label class="button secondary" style="cursor:pointer">Choose image<input id="ieFile" type="file" accept="image/*" style="display:none"></label>
        </div>
        <div id="ieStage" class="img-stage">
          <div id="ieEmpty" class="img-empty">Choose an image to start.</div>
          <img id="ieImg" alt="" style="display:none">
          <div id="ieCrop" class="img-crop" hidden>
            <span class="ih" data-dir="nw"></span><span class="ih" data-dir="n"></span><span class="ih" data-dir="ne"></span>
            <span class="ih" data-dir="w"></span><span class="ih" data-dir="e"></span>
            <span class="ih" data-dir="sw"></span><span class="ih" data-dir="s"></span><span class="ih" data-dir="se"></span>
          </div>
        </div>
        <p class="hint">Drag the box to move, drag a handle to resize. Everything runs in your browser — the file never leaves your device.</p>
      </div>
      <div class="panel">
        <div class="field"><label>Aspect ratio</label>
          <div class="metric-row" id="ieAspect">${["Free", "1:1", "4:3", "16:9", "3:2"]
            .map((a, i) => `<button type="button" class="chip${i === 0 ? " active" : ""}" data-aspect="${a}">${a}</button>`)
            .join("")}</div>
        </div>
        <div class="field"><label>Resize output (px)</label>
          <div style="display:flex;align-items:center;gap:8px">
            <input id="ieW" type="number" min="1" placeholder="W" style="flex:1">
            <span style="color:var(--muted)">×</span>
            <input id="ieH" type="number" min="1" placeholder="H" style="flex:1">
          </div>
          <label class="metric" style="cursor:pointer;margin-top:8px"><input type="checkbox" id="ieLock" checked style="width:auto;min-height:auto;margin-right:6px">Lock aspect ratio</label>
        </div>
        <div class="field"><label>Format</label>
          <div class="metric-row" id="ieFormat">${[["image/jpeg", "JPEG"], ["image/webp", "WebP"], ["image/png", "PNG"]]
            .map((f, i) => `<button type="button" class="chip${i === 0 ? " active" : ""}" data-fmt="${f[0]}">${f[1]}</button>`)
            .join("")}</div>
        </div>
        <div class="field"><label for="ieQuality">Quality: <span id="ieQVal">0.80</span></label><input id="ieQuality" type="range" min="0.3" max="1" step="0.05" value="0.8"></div>
        <div id="ieInfo" class="tool-callout" style="background:#f7f4ee;border-color:#e7ddcd"><p style="margin:0;color:#5f5a51">Choose an image to see the output size.</p></div>
        <div class="action-row"><button class="danger" id="ieReset">Reset</button><a id="ieDownload" class="button primary" style="display:none">Download</a></div>
      </div>
    </div>`
  );

  const stage = document.getElementById("ieStage");
  const imgEl = document.getElementById("ieImg");
  const cropEl = document.getElementById("ieCrop");
  const empty = document.getElementById("ieEmpty");
  const wIn = document.getElementById("ieW");
  const hIn = document.getElementById("ieH");
  const lock = document.getElementById("ieLock");
  const quality = document.getElementById("ieQuality");
  const info = document.getElementById("ieInfo");
  const dl = document.getElementById("ieDownload");

  let Nw = 0, Nh = 0, fileSize = 0, lastUrl = null, aspect = null;
  let fmt = "image/jpeg", fmtLabel = "JPEG";
  let crop = { x: 0, y: 0, w: 1, h: 1 };
  let renderTimer = null;

  function displaySize() {
    return { w: imgEl.clientWidth, h: imgEl.clientHeight };
  }
  function layout() {
    const { w, h } = displaySize();
    cropEl.style.left = `${crop.x * w}px`;
    cropEl.style.top = `${crop.y * h}px`;
    cropEl.style.width = `${crop.w * w}px`;
    cropEl.style.height = `${crop.h * h}px`;
  }
  function cropAspect() {
    return (crop.w * Nw) / (crop.h * Nh);
  }
  function setOutputsFromCrop() {
    wIn.value = Math.round(crop.w * Nw);
    hIn.value = Math.round(crop.h * Nh);
  }
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 130);
  }
  function render() {
    if (!Nw) return;
    const outW = Math.max(1, Math.round(Number(wIn.value) || crop.w * Nw));
    const outH = Math.max(1, Math.round(Number(hIn.value) || crop.h * Nh));
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    canvas.getContext("2d").drawImage(imgEl, crop.x * Nw, crop.y * Nh, crop.w * Nw, crop.h * Nh, 0, 0, outW, outH);
    canvas.toBlob(
      (blob) => {
        if (!blob) { info.innerHTML = `<p style="margin:0;color:#8a5a14">This browser can't export that format.</p>`; return; }
        if (lastUrl) URL.revokeObjectURL(lastUrl);
        lastUrl = URL.createObjectURL(blob);
        dl.href = lastUrl;
        dl.download = `image.${fmt.split("/")[1]}`;
        dl.style.display = "inline-flex";
        info.innerHTML = `<p style="margin:0;color:#5f5a51">Output: ${outW} × ${outH} · ${fmtLabel} · ~${(blob.size / 1024).toFixed(0)} KB <span style="color:#9a948a">(was ${(fileSize / 1024).toFixed(0)} KB)</span></p>`;
      },
      fmt,
      Number(quality.value)
    );
  }

  function loadFile(file) {
    if (!file) return;
    fileSize = file.size;
    const url = URL.createObjectURL(file);
    imgEl.onload = () => {
      Nw = imgEl.naturalWidth;
      Nh = imgEl.naturalHeight;
      empty.style.display = "none";
      imgEl.style.display = "block";
      cropEl.hidden = false;
      crop = { x: 0, y: 0, w: 1, h: 1 };
      aspect = null;
      stage.querySelectorAll("#ieAspect .chip").forEach((c, i) => c.classList.toggle("active", i === 0));
      requestAnimationFrame(() => {
        layout();
        setOutputsFromCrop();
        scheduleRender();
      });
    };
    imgEl.src = url;
  }
  document.getElementById("ieFile").addEventListener("change", (e) => loadFile(e.target.files[0]));

  // Drag to move / resize the crop box.
  stage.addEventListener("pointerdown", (e) => {
    if (!Nw) return;
    const handle = e.target.closest(".ih");
    const onBox = e.target === cropEl || cropEl.contains(e.target);
    if (!handle && !onBox) return;
    e.preventDefault();
    const rect = imgEl.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const start = { ...crop };
    const dir = handle ? handle.dataset.dir : "move";
    const minF = 0.04;
    function move(ev) {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      const c = { ...start };
      if (dir === "move") {
        c.x = Math.min(Math.max(0, start.x + dx), 1 - c.w);
        c.y = Math.min(Math.max(0, start.y + dy), 1 - c.h);
      } else {
        if (dir.includes("w")) { c.x = start.x + dx; c.w = start.w - dx; }
        if (dir.includes("e")) { c.w = start.w + dx; }
        if (dir.includes("n")) { c.y = start.y + dy; c.h = start.h - dy; }
        if (dir.includes("s")) { c.h = start.h + dy; }
        if (c.w < minF) { if (dir.includes("w")) c.x = start.x + start.w - minF; c.w = minF; }
        if (c.h < minF) { if (dir.includes("n")) c.y = start.y + start.h - minF; c.h = minF; }
        if (aspect) { c.h = (c.w * Nw) / (aspect * Nh); if (dir.includes("n")) c.y = start.y + start.h - c.h; }
        c.x = Math.max(0, c.x); c.y = Math.max(0, c.y);
        if (c.x + c.w > 1) c.w = 1 - c.x;
        if (c.y + c.h > 1) c.h = 1 - c.y;
        if (aspect) { c.h = (c.w * Nw) / (aspect * Nh); if (c.y + c.h > 1) { c.h = 1 - c.y; c.w = (aspect * Nh * c.h) / Nw; } }
      }
      crop = c;
      layout();
      setOutputsFromCrop();
      scheduleRender();
    }
    function up() {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    }
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  });

  // Aspect chips.
  document.getElementById("ieAspect").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    stage.querySelectorAll("#ieAspect .chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    const a = chip.dataset.aspect;
    aspect = a === "Free" ? null : (() => { const [p, q2] = a.split(":"); return Number(p) / Number(q2); })();
    if (aspect && Nw) {
      crop.h = (crop.w * Nw) / (aspect * Nh);
      if (crop.y + crop.h > 1) { crop.h = 1 - crop.y; crop.w = (aspect * Nh * crop.h) / Nw; }
      layout();
      setOutputsFromCrop();
      scheduleRender();
    }
  });

  // Format chips.
  document.getElementById("ieFormat").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    document.querySelectorAll("#ieFormat .chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    fmt = chip.dataset.fmt;
    fmtLabel = chip.textContent;
    scheduleRender();
  });

  wIn.addEventListener("input", () => {
    if (lock.checked && Nw) hIn.value = Math.round(Number(wIn.value) / cropAspect());
    scheduleRender();
  });
  hIn.addEventListener("input", () => {
    if (lock.checked && Nw) wIn.value = Math.round(Number(hIn.value) * cropAspect());
    scheduleRender();
  });
  quality.addEventListener("input", () => {
    document.getElementById("ieQVal").textContent = Number(quality.value).toFixed(2);
    scheduleRender();
  });
  document.getElementById("ieReset").addEventListener("click", () => {
    if (!Nw) return;
    crop = { x: 0, y: 0, w: 1, h: 1 };
    aspect = null;
    stage.querySelectorAll("#ieAspect .chip").forEach((c, i) => c.classList.toggle("active", i === 0));
    layout();
    setOutputsFromCrop();
    scheduleRender();
  });
  window.addEventListener("resize", function onResize() {
    if (!document.body.contains(stage)) { window.removeEventListener("resize", onResize); return; }
    if (Nw) layout();
  });
}

function renderImageBase64(mount) {
  renderShell(mount, `<div class="tool-grid">
    <div class="panel"><h3>Image</h3>
      <div class="field"><label for="ibFile">Choose an image</label><input id="ibFile" type="file" accept="image/*"></div>
      <img id="ibPreview" alt="" style="max-width:100%;border-radius:8px;display:none">
      <p class="hint">Runs in your browser — the file never leaves your device.</p>
    </div>
    <div class="panel"><h3>Data URL</h3><textarea id="ibOut" placeholder="Base64 data URL appears here…"></textarea>
      <div class="action-row"><button class="secondary" id="ibCopy">Copy</button></div>
    </div>
  </div>`);
  const out = document.getElementById("ibOut");
  const preview = document.getElementById("ibPreview");
  document.getElementById("ibFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { out.value = reader.result; preview.src = reader.result; preview.style.display = "block"; };
    reader.readAsDataURL(file);
  });
  document.getElementById("ibCopy").addEventListener("click", () => copyText(out.value));
}
