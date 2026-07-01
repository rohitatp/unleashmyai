const toolList = document.getElementById("toolList");
const toolMount = document.getElementById("toolMount");
const toolTitle = document.getElementById("toolTitle");
const toolCategory = document.getElementById("toolCategory");
const toolPermalink = document.getElementById("toolPermalink");
const toolLlmBadge = document.getElementById("toolLlmBadge");

function toolPath(toolId) {
  return `/tools/${toolId}`;
}

function findToolFromLocation() {
  const pathMatch = window.location.pathname.match(/^\/tools\/([^/]+)/);
  if (!pathMatch) return TOOL_DEFINITIONS[0];
  return TOOL_DEFINITIONS.find((tool) => tool.id === pathMatch[1]) || TOOL_DEFINITIONS[0];
}

function renderToolList(activeId) {
  const order = [];
  const byCategory = new Map();
  for (const tool of TOOL_DEFINITIONS) {
    if (!byCategory.has(tool.category)) {
      byCategory.set(tool.category, []);
      order.push(tool.category);
    }
    byCategory.get(tool.category).push(tool);
  }
  // Preserve which dropdowns the user had open across re-renders.
  const openCats = new Set(
    Array.from(document.querySelectorAll(".tool-cat[open]")).map((d) => d.dataset.cat)
  );

  toolList.innerHTML = order
    .map((category) => {
      const tools = byCategory.get(category);
      const llm = tools.filter((t) => t.llm).length;
      const free = tools.length - llm;
      const hasActive = tools.some((t) => t.id === activeId);
      const open = openCats.has(category) || hasActive;
      return `<details class="tool-cat" data-cat="${escapeHtml(category)}" ${open ? "open" : ""}>
        <summary>
          <span class="tool-cat-name">${escapeHtml(category)}</span>
          <span class="tool-cat-count">${llm} LLM · ${free} free</span>
        </summary>
        ${tools
          .map(
            (tool) =>
              `<button class="tool-tab ${tool.id === activeId ? "active" : ""}" data-tool-id="${tool.id}">
                <strong>${escapeHtml(tool.title)}${tool.llm ? '<span class="llm-badge">LLM</span>' : ""}</strong>
                <span>${escapeHtml(tool.summary)}</span>
              </button>`
          )
          .join("")}
      </details>`;
    })
    .join("");
}

function activateTool(tool, updateHistory = true) {
  if (!tool) return;

  toolTitle.textContent = tool.title;
  toolCategory.textContent = tool.category;
  if (toolLlmBadge) toolLlmBadge.hidden = !tool.llm;
  toolPermalink.href = toolPath(tool.id);
  toolMount.innerHTML = "";
  renderToolList(tool.id);
  tool.render(toolMount);

  if (updateHistory && window.location.pathname !== toolPath(tool.id)) {
    window.history.pushState({ toolId: tool.id }, "", toolPath(tool.id));
  }
}

toolList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tool-id]");
  if (!button) return;
  const tool = TOOL_DEFINITIONS.find((item) => item.id === button.dataset.toolId);
  activateTool(tool);
});

window.addEventListener("popstate", () => {
  activateTool(findToolFromLocation(), false);
});

// Let other modules (e.g. a tool's fallback button) switch tools by id.
window.activateToolById = (id) => {
  const tool = TOOL_DEFINITIONS.find((item) => item.id === id);
  if (tool) activateTool(tool);
};

// ---- Settings modal (bring your own key OR buy credits) ----
const settingsOverlay = document.getElementById("settingsOverlay");
const providerSelect = document.getElementById("settingsProvider");
const keyInput = document.getElementById("settingsKey");
const keyHint = document.getElementById("settingsKeyHint");
const modelSelect = document.getElementById("settingsModel");
const settingsStatus = document.getElementById("settingsStatus");
const byokSection = document.getElementById("byokSection");
const creditsSection = document.getElementById("creditsSection");
const modeByokBtn = document.getElementById("modeByok");
const modeCreditsBtn = document.getElementById("modeCredits");
const creditCodeInput = document.getElementById("creditCodeInput");
const creditBalanceHint = document.getElementById("creditBalanceHint");

let currentMode = "byok";

function syncModalToProvider(provider, settings) {
  const def = PROVIDERS[provider];
  keyInput.value = settings.keys[provider] || "";
  keyInput.placeholder = `Paste your ${def.label} key`;
  keyHint.innerHTML = `${escapeHtml(def.keyHint)} · <a href="${def.keyUrl}" target="_blank" rel="noreferrer">Get a key</a>`;
  const chosenModel = settings.models[provider] || def.models[0].id;
  modelSelect.innerHTML = def.models
    .map(
      (m) =>
        `<option value="${escapeHtml(m.id)}" ${m.id === chosenModel ? "selected" : ""}>${escapeHtml(m.label)}</option>`
    )
    .join("");
}

function applyMode(mode) {
  currentMode = mode === "credits" ? "credits" : "byok";
  byokSection.hidden = currentMode !== "byok";
  creditsSection.hidden = currentMode !== "credits";
  modeByokBtn.classList.toggle("active", currentMode === "byok");
  modeCreditsBtn.classList.toggle("active", currentMode === "credits");
}

async function refreshBalance() {
  const code = creditCodeInput.value.trim();
  if (!code) {
    creditBalanceHint.textContent = "After paying, your code appears on the success page. Already have one? Paste it here.";
    return;
  }
  creditBalanceHint.textContent = "Checking balance…";
  try {
    const res = await fetch(`/api/credit-balance?code=${encodeURIComponent(code)}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.credits !== null && data.credits !== undefined) {
      creditBalanceHint.textContent = `${data.credits} credits remaining.`;
    } else {
      creditBalanceHint.textContent = "Code not found — double-check it.";
    }
  } catch {
    creditBalanceHint.textContent = "Couldn't check the balance right now.";
  }
}

function openLlmSettings() {
  const settings = getLlmSettings();
  providerSelect.innerHTML = PROVIDER_ORDER.map(
    (id) => `<option value="${id}">${escapeHtml(PROVIDERS[id].label)}</option>`
  ).join("");
  providerSelect.value = settings.provider;
  syncModalToProvider(settings.provider, settings);
  creditCodeInput.value = settings.creditCode || "";
  applyMode(settings.mode);
  settingsStatus.textContent = "";
  settingsOverlay.hidden = false;
  if (settings.creditCode) refreshBalance();
}
window.openLlmSettings = openLlmSettings;

function closeLlmSettings() {
  settingsOverlay.hidden = true;
}

document.getElementById("openSettings").addEventListener("click", openLlmSettings);
document.getElementById("closeSettings").addEventListener("click", closeLlmSettings);
settingsOverlay.addEventListener("click", (event) => {
  if (event.target === settingsOverlay) closeLlmSettings();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !settingsOverlay.hidden) closeLlmSettings();
});

modeByokBtn.addEventListener("click", () => applyMode("byok"));
modeCreditsBtn.addEventListener("click", () => applyMode("credits"));
providerSelect.addEventListener("change", () => syncModalToProvider(providerSelect.value, getLlmSettings()));
creditCodeInput.addEventListener("change", refreshBalance);

document.getElementById("buyCredits").addEventListener("click", async () => {
  settingsStatus.textContent = "Opening secure checkout…";
  try {
    const res = await fetch("/api/create-checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      settingsStatus.textContent = data.error || "Checkout isn't available yet.";
      return;
    }
    window.location.href = data.url;
  } catch {
    settingsStatus.textContent = "Couldn't start checkout. Please try again.";
  }
});

document.getElementById("saveSettings").addEventListener("click", () => {
  if (currentMode === "credits") {
    const code = creditCodeInput.value.trim();
    saveLlmSettings({ creditCode: code, mode: "credits" });
    settingsStatus.textContent = code ? "Saved — credits will power the AI tools." : "Saved (no code entered yet).";
    if (code) refreshBalance();
  } else {
    const provider = providerSelect.value;
    const key = keyInput.value.trim();
    saveLlmSettings({ provider, keys: { [provider]: key }, models: { [provider]: modelSelect.value }, mode: "byok" });
    settingsStatus.textContent = key ? "Saved — your key will power the AI tools." : "Saved provider/model (no key set yet).";
  }
  activateTool(findToolFromLocation(), false); // refresh so LLM-tool gates update
});

document.getElementById("clearSettings").addEventListener("click", () => {
  if (currentMode === "credits") {
    saveLlmSettings({ creditCode: "" });
    creditCodeInput.value = "";
    creditBalanceHint.textContent = "Cleared your access code.";
    settingsStatus.textContent = "Cleared your access code.";
  } else {
    const provider = providerSelect.value;
    saveLlmSettings({ keys: { [provider]: "" } });
    keyInput.value = "";
    settingsStatus.textContent = `Cleared your ${PROVIDERS[provider].label} key.`;
  }
  activateTool(findToolFromLocation(), false);
});

activateTool(findToolFromLocation(), false);
