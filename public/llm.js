// Bring-your-own-key (BYOK) layer for LLM-powered tools.
//
// The visitor pastes their own provider API key; it is stored ONLY in their
// browser (localStorage) and used to call the provider's API directly from the
// browser. The key never touches unleashmyai.com's server.

const LLM_STORAGE_KEY = "uma_llm";

// Provider adapters. Each builds a request for the browser to send directly to
// the provider and parses the assistant text out of the response.
const PROVIDERS = {
  anthropic: {
    label: "Claude (Anthropic)",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyHint: "Starts with sk-ant-",
    models: [
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 — cheapest ($1 / $5 per 1M)" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 — balanced ($3 / $15)" },
      { id: "claude-opus-4-8", label: "Claude Opus 4.8 — best ($5 / $25)" }
    ],
    buildRequest({ system, prompt, maxTokens, model, key }) {
      return {
        url: "https://api.anthropic.com/v1/messages",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: {
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: prompt }]
        }
      };
    },
    parseResponse(json) {
      const block = Array.isArray(json.content)
        ? json.content.find((b) => b.type === "text")
        : null;
      return block ? block.text : "";
    }
  },

  openai: {
    label: "OpenAI",
    keyUrl: "https://platform.openai.com/api-keys",
    keyHint: "Starts with sk-",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini — cheapest" },
      { id: "gpt-4o", label: "GPT-4o — higher quality" }
    ],
    buildRequest({ system, prompt, maxTokens, model, key }) {
      return {
        url: "https://api.openai.com/v1/chat/completions",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`
        },
        body: {
          model,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt }
          ]
        }
      };
    },
    parseResponse(json) {
      return json.choices && json.choices[0] && json.choices[0].message
        ? json.choices[0].message.content || ""
        : "";
    }
  },

  gemini: {
    label: "Google Gemini",
    keyUrl: "https://aistudio.google.com/apikey",
    keyHint: "From Google AI Studio",
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash — cheapest" },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash — fast" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro — higher quality" }
    ],
    buildRequest({ system, prompt, maxTokens, model, key }) {
      // Key travels as a query param (standard for the Generative Language API).
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
        headers: { "content-type": "application/json" },
        body: {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens }
        }
      };
    },
    parseResponse(json) {
      const cand = json.candidates && json.candidates[0];
      if (!cand || !cand.content || !Array.isArray(cand.content.parts)) return "";
      return cand.content.parts.map((p) => p.text || "").join("");
    }
  }
};

const PROVIDER_ORDER = ["anthropic", "openai", "gemini"];

function defaultModelFor(provider) {
  return PROVIDERS[provider].models[0].id;
}

function getLlmSettings() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(LLM_STORAGE_KEY) || "{}") || {};
  } catch {
    stored = {};
  }

  const provider = PROVIDERS[stored.provider] ? stored.provider : "anthropic";
  const keys = {
    anthropic: (stored.keys && stored.keys.anthropic) || "",
    openai: (stored.keys && stored.keys.openai) || "",
    gemini: (stored.keys && stored.keys.gemini) || ""
  };
  const models = stored.models || {};
  const validModel = PROVIDERS[provider].models.some((m) => m.id === models[provider]);
  const creditCode = stored.creditCode || "";
  const mode = stored.mode === "credits" || stored.mode === "byok" ? stored.mode : creditCode ? "credits" : "byok";

  return {
    provider,
    keys,
    models,
    model: validModel ? models[provider] : defaultModelFor(provider),
    creditCode,
    mode
  };
}

function saveLlmSettings(partial) {
  const current = getLlmSettings();
  const next = {
    provider: partial.provider || current.provider,
    keys: Object.assign({}, current.keys, partial.keys || {}),
    models: Object.assign({}, current.models, partial.models || {}),
    creditCode: partial.creditCode !== undefined ? partial.creditCode : current.creditCode,
    mode: partial.mode || current.mode
  };
  localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(next));
  return getLlmSettings();
}

function hasLlmKey() {
  const s = getLlmSettings();
  return Boolean(s.keys[s.provider]);
}

function hasCredits() {
  return Boolean(getLlmSettings().creditCode);
}

// True when the visitor can run an LLM tool by either route.
function canUseLlm() {
  const s = getLlmSettings();
  return s.mode === "credits" ? Boolean(s.creditCode) : Boolean(s.keys[s.provider]);
}

async function callLLM({ system, prompt, maxTokens = 1024 }) {
  const settings = getLlmSettings();

  // Credits mode: the server spends a credit and calls the LLM with the owner's key.
  if (settings.mode === "credits" && settings.creditCode) {
    let response;
    try {
      response = await fetch("/api/llm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: settings.creditCode, system: system || "", prompt: prompt || "", maxTokens })
      });
    } catch {
      throw new Error("Could not reach the server. Check your connection and try again.");
    }
    const data = await response.json().catch(() => ({}));
    if (response.status === 402) {
      const error = new Error(data.error || "You're out of credits. Buy more in the “API key” panel.");
      error.code = "out-of-credits";
      throw error;
    }
    if (!response.ok) throw new Error(data.error || "The credit service returned an error.");
    return (data.text || "").trim();
  }

  const provider = PROVIDERS[settings.provider];
  const key = settings.keys[settings.provider];

  if (!key) {
    const error = new Error("Add your API key first (top-right “API key” button).");
    error.code = "no-key";
    throw error;
  }

  const req = provider.buildRequest({
    system: system || "",
    prompt: prompt || "",
    maxTokens,
    model: settings.model,
    key
  });

  let response;
  try {
    response = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body)
    });
  } catch {
    throw new Error(`Could not reach ${provider.label}. Check your connection and try again.`);
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(`Your ${provider.label} API key was rejected. Check it in “API key” settings.`);
  }
  if (response.status === 429) {
    throw new Error(`${provider.label} is rate-limiting you. Wait a moment and try again.`);
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error(`${provider.label} returned an unexpected response.`);
  }

  if (!response.ok) {
    const message =
      (json && json.error && (json.error.message || json.error)) ||
      `${provider.label} returned an error (HTTP ${response.status}).`;
    throw new Error(typeof message === "string" ? message : `${provider.label} error.`);
  }

  const text = provider.parseResponse(json);
  if (!text || !text.trim()) {
    throw new Error(`${provider.label} returned an empty response. Try again or pick another model.`);
  }
  return text.trim();
}
