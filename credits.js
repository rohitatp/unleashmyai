// Paid credits: Stripe Checkout + Supabase balances + server-side owner LLM call.
//
// Zero dependencies: Stripe and Supabase are called over REST with fetch, and the
// Stripe webhook signature is verified with node:crypto. Secrets come from env:
//   STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   OWNER_LLM_API_KEY, OWNER_LLM_MODEL (default claude-haiku-4-5)
// The browser only ever sends an access code — never these secrets.

const crypto = require("node:crypto");

const STRIPE_API = "https://api.stripe.com/v1";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const CREDITS_PER_PACK = 1000;

function cfg() {
  return {
    stripeKey: process.env.STRIPE_SECRET_KEY || "",
    stripePrice: process.env.STRIPE_PRICE_ID || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    supabaseUrl: (process.env.SUPABASE_URL || "").replace(/\/$/, ""),
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    ownerLlmKey: process.env.OWNER_LLM_API_KEY || "",
    ownerModel: process.env.OWNER_LLM_MODEL || "claude-haiku-4-5"
  };
}

function creditsConfigured() {
  const c = cfg();
  return {
    checkout: Boolean(c.stripeKey && c.stripePrice),
    webhook: Boolean(c.webhookSecret && c.supabaseUrl && c.supabaseKey),
    store: Boolean(c.supabaseUrl && c.supabaseKey),
    llm: Boolean(c.ownerLlmKey && c.supabaseUrl && c.supabaseKey)
  };
}

function fail(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function generateCode() {
  const hex = crypto.randomBytes(16).toString("hex").toUpperCase();
  return `UMA-${hex.slice(0, 8)}-${hex.slice(8, 16)}`;
}

// ---- Supabase (PostgREST RPC) ----
async function supabaseRpc(fn, args) {
  const { supabaseUrl, supabaseKey } = cfg();
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      authorization: `Bearer ${supabaseKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(args || {})
  });
  const text = await response.text();
  if (!response.ok) {
    throw fail(`Credit store error (${fn}: ${response.status}).`, 502);
  }
  return text ? JSON.parse(text) : null;
}

// ---- Stripe (REST) ----
async function stripeForm(path, form) {
  const { stripeKey } = cfg();
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${stripeKey}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw fail((json.error && json.error.message) || `Stripe error ${response.status}.`, 502);
  }
  return json;
}

async function stripeGet(path) {
  const { stripeKey } = cfg();
  const response = await fetch(`${STRIPE_API}${path}`, {
    headers: { authorization: `Bearer ${stripeKey}` }
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw fail((json.error && json.error.message) || `Stripe error ${response.status}.`, 502);
  }
  return json;
}

function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader) return false;
  const items = sigHeader.split(",").map((p) => {
    const i = p.indexOf("=");
    return [p.slice(0, i), p.slice(i + 1)];
  });
  const timestamp = items.find(([k]) => k === "t");
  const signatures = items.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp[1])) > 300) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp[1]}.${rawBody}`)
    .digest("hex");
  return signatures.some((sig) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  });
}

// ---- Public API used by server.js routes ----

async function createCheckout(origin) {
  const { stripePrice } = cfg();
  if (!creditsConfigured().checkout) throw fail("Payments are not configured yet.", 503);

  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("line_items[0][price]", stripePrice);
  form.set("line_items[0][quantity]", "1");
  form.set("success_url", `${origin}/credits/success.html?session_id={CHECKOUT_SESSION_ID}`);
  form.set("cancel_url", `${origin}/`);

  const session = await stripeForm("/checkout/sessions", form);
  return { url: session.url };
}

async function grantForSession(sessionId, email) {
  const existing = await supabaseRpc("code_for_session", { p_session: sessionId });
  if (existing) return existing;
  const code = generateCode();
  await supabaseRpc("grant_credits", {
    p_code: code,
    p_credits: CREDITS_PER_PACK,
    p_session: sessionId,
    p_email: email || null
  });
  // Re-read so a race (webhook + success page) still returns the persisted winner.
  return supabaseRpc("code_for_session", { p_session: sessionId });
}

async function handleStripeWebhook(rawBody, sigHeader) {
  const { webhookSecret } = cfg();
  if (!creditsConfigured().webhook) throw fail("Webhook not configured.", 503);
  if (!verifyStripeSignature(rawBody, sigHeader, webhookSecret)) {
    throw fail("Invalid Stripe signature.", 400);
  }
  const event = JSON.parse(rawBody);
  if (event.type === "checkout.session.completed") {
    const session = event.data.object || {};
    if (session.payment_status === "paid") {
      const email = (session.customer_details && session.customer_details.email) || session.customer_email || null;
      await grantForSession(session.id, email);
    }
  }
  return { received: true };
}

async function getCodeForSession(sessionId) {
  if (!sessionId) throw fail("Missing session id.", 400);
  if (!creditsConfigured().store) throw fail("Credits are not configured yet.", 503);

  let code = await supabaseRpc("code_for_session", { p_session: sessionId });
  if (!code) {
    // Webhook may not have landed yet — verify the payment with Stripe and grant now.
    if (!creditsConfigured().checkout) throw fail("Payment confirmation is not available.", 503);
    const session = await stripeGet(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
    if (!session || session.payment_status !== "paid") {
      throw fail("Payment is not completed yet. If you just paid, wait a few seconds and refresh.", 402);
    }
    const email = (session.customer_details && session.customer_details.email) || session.customer_email || null;
    code = await grantForSession(sessionId, email);
  }
  const credits = await supabaseRpc("code_balance", { p_code: code });
  return { code, credits };
}

async function getBalance(code) {
  if (!code) throw fail("Missing code.", 400);
  if (!creditsConfigured().store) throw fail("Credits are not configured yet.", 503);
  const credits = await supabaseRpc("code_balance", { p_code: code });
  return { credits: credits === undefined ? null : credits };
}

async function ownerLlmComplete({ system, prompt, maxTokens }) {
  const { ownerLlmKey, ownerModel } = cfg();
  const response = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ownerLlmKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: ownerModel,
      max_tokens: maxTokens || 1024,
      system: system || "",
      messages: [{ role: "user", content: prompt || "" }]
    })
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw fail((json.error && json.error.message) || `Model error ${response.status}.`, 502);
  }
  const block = Array.isArray(json.content) ? json.content.find((b) => b.type === "text") : null;
  return block ? block.text : "";
}

async function spendAndComplete({ code, system, prompt, maxTokens }) {
  if (!creditsConfigured().llm) throw fail("Credits are not available right now.", 503);
  if (!code || typeof code !== "string") throw fail("Missing credit code.", 400);

  // Reserve a credit atomically (no oversell).
  const remaining = await supabaseRpc("spend_credit", { p_code: code });
  if (remaining === null || remaining === undefined) {
    throw fail("You're out of credits, or the code is invalid. Buy more to continue.", 402);
  }

  try {
    const text = await ownerLlmComplete({ system, prompt, maxTokens });
    if (!text || !text.trim()) throw fail("The model returned an empty response.", 502);
    return { text: text.trim(), creditsRemaining: remaining };
  } catch (error) {
    // Refund the reserved credit so failures aren't charged.
    try {
      await supabaseRpc("add_credit", { p_code: code });
    } catch {
      /* best effort */
    }
    throw fail(error.message || "The model call failed; your credit was refunded.", error.statusCode || 502);
  }
}

module.exports = {
  creditsConfigured,
  createCheckout,
  handleStripeWebhook,
  getCodeForSession,
  getBalance,
  spendAndComplete
};
