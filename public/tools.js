// Each tool declares whether it is powered by a large language model via `llm`.
// When `llm: true`, a slanted "LLM" badge is shown on the tool tab and heading
// (see app.js). Today's tools run on code; set `llm: true` when adding LLM tools.
const TOOL_DEFINITIONS = [
  {
    id: "speech-to-text",
    title: "Speech to Text",
    category: "Voice Tools",
    summary: "Record speech from your microphone and turn it into editable text.",
    llm: false,
    render: renderSpeechToText
  },
  {
    id: "text-to-speech",
    title: "Text to Speech",
    category: "Voice Tools",
    summary: "Read text aloud using browser voices, speed, and pitch controls.",
    llm: false,
    render: renderTextToSpeech
  },
  {
    id: "youtube-transcript",
    title: "YouTube Transcript",
    category: "YouTube Tools",
    summary: "Fetch public YouTube captions and export clean or timestamped text.",
    llm: false,
    render: renderYoutubeTranscript
  },
  {
    id: "youtube-summarizer",
    title: "YouTube Summarizer",
    category: "YouTube Tools",
    summary: "Paste a URL — get a TL;DR, key points, and chapters from the transcript.",
    llm: true,
    render: renderYoutubeSummarizer
  },
  {
    id: "transcript-summarizer",
    title: "Transcript Summarizer",
    category: "YouTube Tools",
    summary: "Paste any transcript or long text and get a clean summary with key points.",
    llm: true,
    render: renderTranscriptSummarizer
  },
  {
    id: "viral-post-generator",
    title: "Viral Post Generator",
    category: "Social Media Tools",
    summary: "Create platform-specific posts from one idea using deterministic templates.",
    llm: false,
    render: renderViralPostGenerator
  },
  {
    id: "ai-post-generator",
    title: "AI Post Generator",
    category: "Social Media Tools",
    summary: "Turn one idea into platform-specific posts written by your chosen AI model.",
    llm: true,
    render: renderAiPostGenerator
  },
  {
    id: "voice-to-linkedin-post",
    title: "Voice to LinkedIn Post",
    category: "Social Media Tools",
    summary: "Capture a voice note and shape it into a clean, structured LinkedIn post.",
    llm: false,
    render: renderVoiceToLinkedin
  },
  {
    id: "content-repurposer",
    title: "Content Repurposer",
    category: "Creator Tools",
    summary: "Turn long text into posts, threads, captions, and newsletter blurbs.",
    llm: false,
    render: renderContentRepurposer
  },
  {
    id: "clip-finder",
    title: "Clip Finder",
    category: "Creator Tools",
    summary: "Score transcript moments and find likely short-form clip candidates.",
    llm: false,
    render: renderClipFinder
  }
];

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 48);
}

function words(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function sentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function keywordList(text, limit = 8) {
  const stop = new Set([
    "about",
    "after",
    "again",
    "also",
    "because",
    "before",
    "being",
    "between",
    "could",
    "every",
    "from",
    "have",
    "into",
    "just",
    "like",
    "more",
    "most",
    "only",
    "other",
    "over",
    "should",
    "that",
    "their",
    "there",
    "these",
    "they",
    "this",
    "through",
    "what",
    "when",
    "where",
    "which",
    "while",
    "with",
    "would",
    "your"
  ]);
  const counts = new Map();

  for (const word of words(text)) {
    if (word.length < 4 || stop.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

function firstMeaningfulSentence(text) {
  return sentences(text).find((sentence) => sentence.length > 32) || String(text || "").trim();
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

function renderYoutubeTranscript(mount) {
  renderShell(
    mount,
    `<div class="tool-grid">
      <div class="panel">
        <h3>YouTube URL</h3>
        <div class="field">
          <label for="ytUrl">Video URL or ID</label>
          <input id="ytUrl" placeholder="https://www.youtube.com/watch?v=...">
        </div>
        <div class="field">
          <label for="ytFormat">Output format</label>
          <select id="ytFormat">
            <option value="timestampedText">Timestamped transcript</option>
            <option value="plainText">Plain text</option>
          </select>
        </div>
        <div class="action-row">
          <button class="primary" id="ytFetch">Get transcript</button>
          <button class="secondary" id="ytCopy">Copy</button>
          <button class="secondary" id="ytDownload">Download .txt</button>
        </div>
        <p id="ytStatus" class="status"></p>
      </div>
      <div class="panel">
        <h3 id="ytTitle">Transcript</h3>
        <div id="ytMeta" class="metric-row"></div>
        <div id="ytOutput" class="output"></div>
      </div>
    </div>`
  );

  const output = document.getElementById("ytOutput");
  const status = document.getElementById("ytStatus");
  let latestTranscript = null;

  function currentText() {
    if (!latestTranscript) return output.textContent || "";
    return latestTranscript[document.getElementById("ytFormat").value] || "";
  }

  document.getElementById("ytFormat").addEventListener("change", () => {
    if (latestTranscript) output.textContent = currentText();
  });

  document.getElementById("ytFetch").addEventListener("click", async () => {
    const url = document.getElementById("ytUrl").value.trim();
    if (!url) {
      status.textContent = "Paste a YouTube URL first.";
      return;
    }

    status.textContent = "Fetching public captions...";
    output.textContent = "";

    try {
      const response = await fetch(`/api/youtube-transcript?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Transcript request failed.");

      latestTranscript = data;
      document.getElementById("ytTitle").textContent = data.title || "Transcript";
      document.getElementById("ytMeta").innerHTML = [
        `${data.lines.length} lines`,
        data.language ? `Language: ${data.language}` : "",
        data.author ? `By ${data.author}` : ""
      ]
        .filter(Boolean)
        .map((item) => `<span class="metric">${escapeHtml(item)}</span>`)
        .join("");
      output.textContent = currentText();
      status.textContent = "Transcript loaded.";
    } catch (error) {
      status.textContent = error.message;
    }
  });

  document.getElementById("ytCopy").addEventListener("click", () => copyText(currentText(), status));
  document.getElementById("ytDownload").addEventListener("click", () => downloadText("youtube-transcript.txt", currentText()));
}

function createPosts(idea, options = {}) {
  const cleanIdea = String(idea || "").trim();
  const hook = firstMeaningfulSentence(cleanIdea).replace(/[.!?]+$/, "");
  const keywords = keywordList(cleanIdea, 6);
  const hashtags = keywords.slice(0, 5).map((keyword) => `#${keyword.replace(/-/g, "")}`);
  const tone = options.tone || "practical";
  const audience = options.audience || "creators and professionals";

  const opening =
    tone === "bold"
      ? `Most people are thinking about ${hook} the wrong way.`
      : tone === "story"
        ? `I used to overcomplicate ${hook.toLowerCase()}.`
        : `${hook} matters more than it looks.`;

  return {
    LinkedIn: `${opening}\n\nHere is the simple version:\n\n1. Start with the real user problem.\n2. Remove anything that adds friction.\n3. Package the result as a repeatable workflow.\n\nFor ${audience}, the win is not novelty. The win is getting from idea to useful output faster.\n\nQuestion: what would you simplify first?`,
    X: `${opening}\n\nA simple way to approach it:\n\n1/ Name the problem clearly\n2/ Build the smallest useful workflow\n3/ Add polish only after people use it\n4/ Keep the output easy to copy, export, or share\n\nUseful beats flashy.`,
    Instagram: `${hook}\n\nSave this simple framework:\n\n- Problem\n- Input\n- Transformation\n- Output\n- Next action\n\nMake the workflow obvious and people will actually use it.\n\n${hashtags.join(" ")}`,
    Facebook: `${hook}\n\nI think the most useful tools are not always the most complicated ones. They take something messy, like a voice note, transcript, or rough idea, and turn it into something ready to use.\n\nThat is the kind of workflow worth building: simple input, clear output, less busywork.`
  };
}

function renderPostResults(container, posts) {
  container.innerHTML = Object.entries(posts)
    .map(
      ([platform, post]) =>
        `<article class="result-card">
          <h4>${escapeHtml(platform)}</h4>
          <pre>${escapeHtml(post)}</pre>
        </article>`
    )
    .join("");
}

function renderViralPostGenerator(mount) {
  renderShell(
    mount,
    `<div class="tool-grid">
      <div class="panel">
        <h3>Idea</h3>
        <textarea id="viralIdea" placeholder="Describe your idea, lesson, offer, or insight..."></textarea>
        <div class="field-grid">
          <div class="field">
            <label for="viralTone">Tone</label>
            <select id="viralTone">
              <option value="practical">Practical</option>
              <option value="bold">Bold</option>
              <option value="story">Story-driven</option>
            </select>
          </div>
          <div class="field">
            <label for="viralAudience">Audience</label>
            <input id="viralAudience" value="creators and professionals">
          </div>
        </div>
        <div class="action-row">
          <button class="primary" id="viralGenerate">Generate posts</button>
          <button class="secondary" id="viralCopy">Copy all</button>
        </div>
        <p id="viralStatus" class="status"></p>
      </div>
      <div class="panel">
        <h3>Platform drafts</h3>
        <div id="viralResults" class="result-list"></div>
      </div>
    </div>`
  );

  const results = document.getElementById("viralResults");
  const status = document.getElementById("viralStatus");
  let latest = {};

  document.getElementById("viralGenerate").addEventListener("click", () => {
    const idea = document.getElementById("viralIdea").value;
    if (!idea.trim()) {
      status.textContent = "Enter an idea first.";
      return;
    }

    latest = createPosts(idea, {
      tone: document.getElementById("viralTone").value,
      audience: document.getElementById("viralAudience").value
    });
    renderPostResults(results, latest);
    status.textContent = "Posts generated with deterministic templates.";
  });

  document.getElementById("viralCopy").addEventListener("click", () => {
    const text = Object.entries(latest)
      .map(([platform, post]) => `${platform}\n${post}`)
      .join("\n\n---\n\n");
    copyText(text, status);
  });
}

function renderVoiceToLinkedin(mount) {
  renderSpeechToText(mount);
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.style.marginTop = "18px";
  panel.innerHTML = `<h3>LinkedIn post from transcript</h3>
    <div class="action-row">
      <button class="primary" id="voiceLinkedinGenerate">Create LinkedIn post</button>
      <button class="secondary" id="voiceLinkedinCopy">Copy post</button>
    </div>
    <div id="voiceLinkedinOutput" class="output"></div>`;
  mount.append(panel);

  const output = document.getElementById("voiceLinkedinOutput");
  const status = document.getElementById("sttStatus");
  let latest = "";

  document.getElementById("voiceLinkedinGenerate").addEventListener("click", () => {
    const transcript = document.getElementById("sttOutput").value;
    if (!transcript.trim()) {
      status.textContent = "Record or paste a transcript first.";
      return;
    }
    latest = createPosts(transcript, { tone: "story", audience: "LinkedIn readers" }).LinkedIn;
    output.textContent = latest;
    status.textContent = "LinkedIn draft created.";
  });

  document.getElementById("voiceLinkedinCopy").addEventListener("click", () => copyText(latest, status));
}

function repurposeContent(text) {
  const summary = firstMeaningfulSentence(text).replace(/[.!?]+$/, "");
  const keys = keywordList(text, 8);
  const usefulSentences = sentences(text).slice(0, 5);
  const bullets = usefulSentences.map((sentence) => `- ${sentence.replace(/[.!?]+$/, "")}`).join("\n");

  return {
    "LinkedIn Post": `${summary}\n\nWhat stands out:\n\n${bullets}\n\nThe takeaway: make the next step easier than the current habit.`,
    "X Thread": `1/ ${summary}\n\n2/ ${usefulSentences[1] || "The best workflows reduce repeated effort."}\n\n3/ ${usefulSentences[2] || "Simple inputs and clear outputs matter."}\n\n4/ Build for repeat use, not one-time novelty.`,
    "Instagram Caption": `${summary}\n\nQuick notes:\n${bullets}\n\n${keys.slice(0, 5).map((key) => `#${slugify(key)}`).join(" ")}`,
    "Newsletter Blurb": `This week, the useful idea is simple: ${summary.toLowerCase()}.\n\nThe practical lesson is to reduce friction, make the workflow repeatable, and turn raw material into something people can use immediately.`
  };
}

function renderContentRepurposer(mount) {
  renderShell(
    mount,
    `<div class="tool-grid">
      <div class="panel">
        <h3>Source content</h3>
        <textarea id="repurposeInput" placeholder="Paste a transcript, article, notes, or rough draft..."></textarea>
        <div class="action-row">
          <button class="primary" id="repurposeGenerate">Repurpose</button>
          <button class="secondary" id="repurposeCopy">Copy all</button>
        </div>
        <p id="repurposeStatus" class="status"></p>
      </div>
      <div class="panel">
        <h3>Outputs</h3>
        <div id="repurposeResults" class="result-list"></div>
      </div>
    </div>`
  );

  const results = document.getElementById("repurposeResults");
  const status = document.getElementById("repurposeStatus");
  let latest = {};

  document.getElementById("repurposeGenerate").addEventListener("click", () => {
    const text = document.getElementById("repurposeInput").value;
    if (!text.trim()) {
      status.textContent = "Paste source content first.";
      return;
    }
    latest = repurposeContent(text);
    renderPostResults(results, latest);
    status.textContent = "Content repurposed with templates and keyword extraction.";
  });

  document.getElementById("repurposeCopy").addEventListener("click", () => {
    const text = Object.entries(latest)
      .map(([format, value]) => `${format}\n${value}`)
      .join("\n\n---\n\n");
    copyText(text, status);
  });
}

function parseTimestampToSeconds(timestamp) {
  const parts = timestamp.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function formatSeconds(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = String(safe % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function parseTranscriptLines(text) {
  const lines = String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    const match = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(.*)$/);
    if (match) {
      return {
        time: parseTimestampToSeconds(match[1]),
        text: match[2],
        raw: line
      };
    }
    return {
      time: index * 15,
      text: line,
      raw: line
    };
  });
}

function scoreClip(text) {
  const lower = text.toLowerCase();
  let score = 0;
  if (/\?/.test(text)) score += 2;
  if (/\b(secret|mistake|simple|truth|lesson|framework|strategy|money|growth|failed|learned|stop|start)\b/.test(lower)) score += 3;
  if (/\b\d+/.test(text)) score += 2;
  if (text.length >= 180 && text.length <= 700) score += 2;
  if (/\bbut\b|\bhowever\b|\bthe problem\b|\bthe thing is\b/.test(lower)) score += 1;
  return score;
}

function findClips(text) {
  const lines = parseTranscriptLines(text);
  const windows = [];

  for (let index = 0; index < lines.length; index += 1) {
    const chunk = lines.slice(index, index + 4);
    const combined = chunk.map((line) => line.text).join(" ").trim();
    if (!combined) continue;
    const start = chunk[0].time;
    const end = chunk[chunk.length - 1].time + 18;
    windows.push({
      start,
      end,
      text: combined,
      score: scoreClip(combined)
    });
  }

  return windows
    .sort((a, b) => b.score - a.score || a.start - b.start)
    .slice(0, 6)
    .map((clip, index) => ({
      ...clip,
      title: `Clip ${index + 1}: ${firstMeaningfulSentence(clip.text).slice(0, 70)}`
    }));
}

function renderClipFinder(mount) {
  renderShell(
    mount,
    `<div class="tool-grid">
      <div class="panel">
        <h3>Transcript</h3>
        <textarea id="clipInput" placeholder="[0:12] Paste timestamped transcript lines here..."></textarea>
        <div class="action-row">
          <button class="primary" id="clipFind">Find clips</button>
          <button class="secondary" id="clipCopy">Copy clips</button>
        </div>
        <p id="clipStatus" class="status"></p>
      </div>
      <div class="panel">
        <h3>Clip candidates</h3>
        <div id="clipResults" class="result-list"></div>
      </div>
    </div>`
  );

  const results = document.getElementById("clipResults");
  const status = document.getElementById("clipStatus");
  let latest = [];

  document.getElementById("clipFind").addEventListener("click", () => {
    const text = document.getElementById("clipInput").value;
    if (!text.trim()) {
      status.textContent = "Paste a transcript first.";
      return;
    }

    latest = findClips(text);
    results.innerHTML = latest
      .map(
        (clip) =>
          `<article class="result-card">
            <h4>${escapeHtml(clip.title)}</h4>
            <div class="metric-row">
              <span class="metric">${formatSeconds(clip.start)}-${formatSeconds(clip.end)}</span>
              <span class="metric">Score ${clip.score}</span>
            </div>
            <pre>${escapeHtml(clip.text)}</pre>
          </article>`
      )
      .join("");
    status.textContent = "Clip candidates scored with deterministic rules.";
  });

  document.getElementById("clipCopy").addEventListener("click", () => {
    const text = latest
      .map((clip) => `${clip.title}\n${formatSeconds(clip.start)}-${formatSeconds(clip.end)}\n${clip.text}`)
      .join("\n\n---\n\n");
    copyText(text, status);
  });
}

// ---- LLM (bring-your-own-key) tools ----

// Gate: if the visitor hasn't set an API key, show a prompt to add one;
// otherwise render the actual tool body. (callLLM / hasLlmKey come from llm.js.)
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

const SUMMARY_SYSTEM =
  "You are a precise summarizer. Given a transcript or long text, produce a clear, faithful, well-structured summary in plain text (no markdown symbols like # or *). Do not invent facts that are not in the source.";

function summaryPrompt(text) {
  return `Summarize the transcript below. Return exactly these three sections, each starting with the heading in capitals followed by a colon on its own line:

TL;DR: one or two sentences.
KEY POINTS: 5-8 lines, each starting with "- ".
CHAPTERS: 4-8 lines. If the text has timestamps use "mm:ss - short title"; otherwise list logical sections as "- title".

Transcript:
"""
${text}
"""`;
}

async function runSummary(text, output, status) {
  status.textContent = "Summarizing with your AI model…";
  output.textContent = "";
  try {
    output.textContent = await callLLM({
      system: SUMMARY_SYSTEM,
      prompt: summaryPrompt(text),
      maxTokens: 1200
    });
    status.textContent = "Done.";
  } catch (error) {
    status.textContent = error.message;
  }
}

function renderTranscriptSummarizer(mount) {
  renderLlmGate(mount, (m) => {
    renderShell(
      m,
      `<div class="tool-grid">
        <div class="panel">
          <h3>Transcript or long text</h3>
          <div class="field">
            <textarea id="tsInput" placeholder="Paste a transcript, article, or notes…"></textarea>
          </div>
          <div class="action-row">
            <button class="primary" id="tsRun">Summarize</button>
            <button class="secondary" id="tsCopy">Copy</button>
            <button class="secondary" id="tsDownload">Download .txt</button>
          </div>
          <p id="tsStatus" class="status"></p>
        </div>
        <div class="panel">
          <h3>Summary</h3>
          <div id="tsOutput" class="output"></div>
        </div>
      </div>`
    );
    const status = document.getElementById("tsStatus");
    const output = document.getElementById("tsOutput");
    document.getElementById("tsRun").addEventListener("click", () => {
      const text = document.getElementById("tsInput").value.trim();
      if (!text) {
        status.textContent = "Paste some text first.";
        return;
      }
      runSummary(text, output, status);
    });
    document.getElementById("tsCopy").addEventListener("click", () => copyText(output.textContent, status));
    document.getElementById("tsDownload").addEventListener("click", () => downloadText("summary.txt", output.textContent));
  });
}

function renderYoutubeSummarizer(mount) {
  renderLlmGate(mount, (m) => {
    renderShell(
      m,
      `<div class="tool-grid">
        <div class="panel">
          <h3>YouTube URL</h3>
          <div class="field">
            <label for="ysUrl">Video URL or ID</label>
            <input id="ysUrl" placeholder="https://www.youtube.com/watch?v=…">
          </div>
          <div class="action-row">
            <button class="primary" id="ysRun">Summarize video</button>
            <button class="secondary" id="ysCopy">Copy</button>
            <button class="secondary" id="ysDownload">Download .txt</button>
          </div>
          <p id="ysStatus" class="status"></p>
          <div id="ysFallback"></div>
        </div>
        <div class="panel">
          <h3 id="ysTitle">Summary</h3>
          <div id="ysOutput" class="output"></div>
        </div>
      </div>`
    );
    const status = document.getElementById("ysStatus");
    const output = document.getElementById("ysOutput");
    const fallback = document.getElementById("ysFallback");

    document.getElementById("ysRun").addEventListener("click", async () => {
      const url = document.getElementById("ysUrl").value.trim();
      fallback.innerHTML = "";
      if (!url) {
        status.textContent = "Paste a YouTube URL first.";
        return;
      }
      status.textContent = "Fetching the transcript…";
      output.textContent = "";

      let data;
      try {
        const response = await fetch(`/api/youtube-transcript?url=${encodeURIComponent(url)}`);
        data = await response.json();
        if (!response.ok) {
          if (response.status === 402) {
            status.textContent = "";
            fallback.innerHTML = `<div class="tool-callout">
              <strong>Auto-transcript is out of free credits</strong>
              <p>The free monthly transcript quota ran out. Grab the transcript from a free site and paste it into the Transcript Summarizer instead.</p>
              <button class="secondary" id="ysToPaste">Open Transcript Summarizer →</button>
            </div>`;
            document
              .getElementById("ysToPaste")
              .addEventListener("click", () => window.activateToolById("transcript-summarizer"));
            return;
          }
          throw new Error(data.error || "Could not fetch the transcript.");
        }
      } catch (error) {
        status.textContent = error.message || "Could not fetch the transcript.";
        return;
      }

      document.getElementById("ysTitle").textContent = data.title || "Summary";
      runSummary(data.plainText || "", output, status);
    });

    document.getElementById("ysCopy").addEventListener("click", () => copyText(output.textContent, status));
    document.getElementById("ysDownload").addEventListener("click", () => downloadText("youtube-summary.txt", output.textContent));
  });
}

function renderAiPostGenerator(mount) {
  renderLlmGate(mount, (m) => {
    const platforms = ["LinkedIn", "X", "Instagram", "Facebook"];
    renderShell(
      m,
      `<div class="tool-grid">
        <div class="panel">
          <h3>Your idea</h3>
          <div class="field">
            <textarea id="apIdea" placeholder="What do you want to post about?"></textarea>
          </div>
          <div class="field">
            <label>Platforms</label>
            <div class="metric-row" id="apPlatforms">
              ${platforms
                .map(
                  (p, i) =>
                    `<label class="metric" style="cursor:pointer"><input type="checkbox" value="${p}" ${
                      i < 2 ? "checked" : ""
                    } style="width:auto;min-height:auto;margin-right:6px"> ${p}</label>`
                )
                .join("")}
            </div>
          </div>
          <div class="field">
            <label for="apTone">Tone</label>
            <select id="apTone">
              <option>practical</option>
              <option>bold</option>
              <option>story</option>
              <option>professional</option>
              <option>friendly</option>
            </select>
          </div>
          <div class="action-row">
            <button class="primary" id="apRun">Generate posts</button>
            <button class="secondary" id="apCopy">Copy</button>
            <button class="secondary" id="apDownload">Download .txt</button>
          </div>
          <p id="apStatus" class="status"></p>
        </div>
        <div class="panel">
          <h3>Posts</h3>
          <div id="apOutput" class="output"></div>
        </div>
      </div>`
    );
    const status = document.getElementById("apStatus");
    const output = document.getElementById("apOutput");

    document.getElementById("apRun").addEventListener("click", async () => {
      const idea = document.getElementById("apIdea").value.trim();
      const chosen = Array.from(document.querySelectorAll("#apPlatforms input:checked")).map((c) => c.value);
      const tone = document.getElementById("apTone").value;
      if (!idea) {
        status.textContent = "Describe your idea first.";
        return;
      }
      if (!chosen.length) {
        status.textContent = "Pick at least one platform.";
        return;
      }
      status.textContent = "Writing posts with your AI model…";
      output.textContent = "";

      const system =
        "You are a social media copywriter. Write platform-native posts that are specific and engaging, with no generic filler. Plain text only — no markdown headers.";
      const prompt = `Idea: ${idea}

Tone: ${tone}
Write one post for each of these platforms: ${chosen.join(", ")}.

For each platform, put the platform name in capitals on its own line, then the post, then a blank line. Tailor each: LinkedIn = strong hook + short paragraphs; X = punchy, under 280 characters; Instagram = caption plus a few fitting hashtags; Facebook = conversational. Use hashtags only where they fit.`;

      try {
        output.textContent = await callLLM({ system, prompt, maxTokens: 1500 });
        status.textContent = "Done.";
      } catch (error) {
        status.textContent = error.message;
      }
    });

    document.getElementById("apCopy").addEventListener("click", () => copyText(output.textContent, status));
    document.getElementById("apDownload").addEventListener("click", () => downloadText("ai-posts.txt", output.textContent));
  });
}
