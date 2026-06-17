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

activateTool(findToolFromLocation(), false);
