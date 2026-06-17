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
  toolList.innerHTML = TOOL_DEFINITIONS.map(
    (tool) =>
      `<button class="tool-tab ${tool.id === activeId ? "active" : ""}" data-tool-id="${tool.id}">
        <strong>${escapeHtml(tool.title)}${tool.llm ? '<span class="llm-badge">LLM</span>' : ""}</strong>
        <span>${escapeHtml(tool.summary)}</span>
      </button>`
  ).join("");
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

// ---- BYOK settings modal ----
const settingsOverlay = document.getElementById("settingsOverlay");
const providerSelect = document.getElementById("settingsProvider");
const keyInput = document.getElementById("settingsKey");
const keyHint = document.getElementById("settingsKeyHint");
const modelSelect = document.getElementById("settingsModel");
const settingsStatus = document.getElementById("settingsStatus");

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

function openLlmSettings() {
  const settings = getLlmSettings();
  providerSelect.innerHTML = PROVIDER_ORDER.map(
    (id) => `<option value="${id}">${escapeHtml(PROVIDERS[id].label)}</option>`
  ).join("");
  providerSelect.value = settings.provider;
  syncModalToProvider(settings.provider, settings);
  settingsStatus.textContent = "";
  settingsOverlay.hidden = false;
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

providerSelect.addEventListener("change", () => {
  syncModalToProvider(providerSelect.value, getLlmSettings());
});

document.getElementById("saveSettings").addEventListener("click", () => {
  const provider = providerSelect.value;
  const key = keyInput.value.trim();
  saveLlmSettings({
    provider,
    keys: { [provider]: key },
    models: { [provider]: modelSelect.value }
  });
  settingsStatus.textContent = key
    ? "Saved. You can close this and use the AI tools."
    : "Saved provider/model (no key set yet).";
  activateTool(findToolFromLocation(), false); // refresh so LLM-tool gates update
});

document.getElementById("clearSettings").addEventListener("click", () => {
  const provider = providerSelect.value;
  saveLlmSettings({ keys: { [provider]: "" } });
  keyInput.value = "";
  settingsStatus.textContent = `Cleared your ${PROVIDERS[provider].label} key.`;
  activateTool(findToolFromLocation(), false);
});

activateTool(findToolFromLocation(), false);
