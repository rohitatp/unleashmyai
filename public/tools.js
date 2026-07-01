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
    summary: "Generate a batch of titles, subject lines, or hooks to choose from.", llm: true, render: renderHeadlines }
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
  let listening = false;
  button.addEventListener("click", () => {
    if (listening && recognition) {
      recognition.stop();
      return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    let base = target.value ? `${target.value.trim()} ` : "";
    recognition.onstart = () => {
      listening = true;
      button.textContent = "Stop recording";
      if (statusEl) statusEl.textContent = "Listening…";
    };
    recognition.onerror = (event) => {
      if (statusEl) statusEl.textContent = `Mic error: ${event.error}`;
    };
    recognition.onend = () => {
      listening = false;
      button.textContent = "Record voice";
      if (statusEl) statusEl.textContent = "";
    };
    recognition.onresult = (event) => {
      let interim = "";
      let finalAdd = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalAdd += `${t} `;
        else interim += t;
      }
      if (finalAdd) base += finalAdd;
      target.value = `${base}${interim}`.replace(/\s+/g, " ").trimStart();
    };
    recognition.start();
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
      </div>
    </div>`
  );

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const startButton = document.getElementById("sttStart");
  const stopButton = document.getElementById("sttStop");
  const output = document.getElementById("sttOutput");
  const status = document.getElementById("sttStatus");
  let recognition = null;

  if (!SpeechRecognition) {
    status.textContent = "Speech recognition is not available in this browser.";
    startButton.disabled = true;
  }

  startButton.addEventListener("click", () => {
    recognition = new SpeechRecognition();
    recognition.lang = document.getElementById("sttLang").value;
    recognition.continuous = document.getElementById("sttMode").value === "true";
    recognition.interimResults = true;

    let finalText = output.value.trim();

    recognition.onstart = () => {
      status.textContent = "Listening...";
    };
    recognition.onerror = (event) => {
      status.textContent = `Recognition error: ${event.error}`;
    };
    recognition.onend = () => {
      status.textContent = "Recording stopped.";
    };
    recognition.onresult = (event) => {
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript.trim();
        if (event.results[index].isFinal) {
          finalText = `${finalText} ${transcript}`.trim();
        } else {
          interimText = transcript;
        }
      }
      output.value = [finalText, interimText].filter(Boolean).join("\n");
    };

    recognition.start();
  });

  stopButton.addEventListener("click", () => {
    if (recognition) recognition.stop();
  });

  document.getElementById("sttClear").addEventListener("click", () => {
    output.value = "";
    status.textContent = "Transcript cleared.";
  });

  document.getElementById("sttCopy").addEventListener("click", () => copyText(output.value, status));
  document.getElementById("sttDownload").addEventListener("click", () => downloadText("speech-transcript.txt", output.value));
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
