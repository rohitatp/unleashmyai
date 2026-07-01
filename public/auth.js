// Optional "Sign in with Google" UI. Shows a sign-in button when the server has
// a Google Client ID configured; otherwise stays hidden. Session (a signed
// token + basic profile) lives in localStorage. BYOK/guest usage is unaffected.
(function () {
  const AUTH_KEY = "uma_auth";
  const area = document.getElementById("authArea");
  if (!area) return;
  let clientId = "";

  function esc(s) {
    return String(s || "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
  }
  function getSession() {
    try {
      const s = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
      if (s && s.exp && s.exp * 1000 > Date.now()) return s;
    } catch {
      /* ignore */
    }
    return null;
  }
  function signOut() {
    localStorage.removeItem(AUTH_KEY);
    if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
    render();
  }
  // Exposed so other modules (e.g. account-tied credits later) can read the login.
  window.umaGetAuth = getSession;
  window.umaSignOut = signOut;

  function render() {
    const session = getSession();
    if (!clientId && !session) {
      area.hidden = true;
      return;
    }
    area.hidden = false;
    if (session) {
      area.innerHTML =
        `<span class="auth-user">${session.picture ? `<img src="${esc(session.picture)}" alt="" referrerpolicy="no-referrer">` : ""}${esc(session.name || session.email)}</span>` +
        `<button type="button" class="nav-button" id="authSignOut">Sign out</button>`;
      document.getElementById("authSignOut").addEventListener("click", signOut);
      return;
    }
    area.innerHTML = `<div id="gBtn"></div>`;
    if (clientId && window.google && google.accounts && google.accounts.id) {
      google.accounts.id.initialize({ client_id: clientId, callback: onCredential });
      google.accounts.id.renderButton(document.getElementById("gBtn"), { type: "standard", size: "medium", text: "signin_with", shape: "pill" });
    }
  }

  async function onCredential(response) {
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) throw new Error(data.error || "Sign-in failed.");
      localStorage.setItem(AUTH_KEY, JSON.stringify({ token: data.token, ...data.user, exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600 }));
      render();
    } catch (error) {
      area.innerHTML = `<span class="auth-user">${esc(error.message)}</span>`;
    }
  }

  // GIS calls this when its library finishes loading.
  window.onGoogleLibraryLoad = render;

  // Show a signed-in session immediately, then ask the server if login is enabled.
  render();
  fetch("/api/config")
    .then((r) => r.json())
    .then((cfg) => {
      clientId = cfg.googleClientId || "";
      render();
    })
    .catch(() => render());
})();
