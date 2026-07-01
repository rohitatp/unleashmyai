// Optional "Sign in with Google" — verifies Google's ID token and issues a
// stateless, HMAC-signed session. Zero dependencies (node:crypto + fetch).
// Requires env: GOOGLE_CLIENT_ID (public) and SESSION_SECRET (secret).
// Dormant (clean 503 / empty config) until both are set.

const crypto = require("node:crypto");

function cfg() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    sessionSecret: process.env.SESSION_SECRET || ""
  };
}

function authConfigured() {
  const c = cfg();
  return Boolean(c.clientId && c.sessionSecret);
}

function fail(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", cfg().sessionSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

// Returns the session payload if valid and unexpired, else null.
function verifySession(token) {
  if (!token || !cfg().sessionSecret) return null;
  const [body, sig] = String(token).split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", cfg().sessionSecret).update(body).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
  return payload;
}

async function loginWithGoogle(credential) {
  if (!authConfigured()) throw fail("Login is not configured.", 503);
  if (!credential) throw fail("Missing Google credential.", 400);

  // Google validates the token's signature and expiry and returns its claims.
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  const info = await response.json().catch(() => ({}));
  if (!response.ok || !info.sub) throw fail("Google sign-in failed. Please try again.", 401);
  if (info.aud !== cfg().clientId) throw fail("This sign-in wasn't issued for this site.", 401);
  if (info.iss !== "accounts.google.com" && info.iss !== "https://accounts.google.com") {
    throw fail("Invalid token issuer.", 401);
  }
  if (info.email_verified !== "true" && info.email_verified !== true) {
    throw fail("Your Google email isn't verified.", 401);
  }

  const user = { email: info.email, name: info.name || info.email, picture: info.picture || "" };
  const token = signSession({ ...user, sub: info.sub, exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600 });
  return { token, user };
}

module.exports = {
  authConfigured,
  googleClientId: () => cfg().clientId,
  loginWithGoogle,
  verifySession
};
