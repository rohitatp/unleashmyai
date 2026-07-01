# Unleash My AI

Free AI tools for creators, founders, and busy professionals.

A growing toolbox of useful utilities. Today's tools run on browser APIs, deterministic templates, transcript parsing, and lightweight text heuristics; LLM-powered tools are being added over time. Any tool powered by a large language model is marked with an **LLM** badge in the UI.

Everyday, high-frequency tools. Most are LLM-powered (flagged with an **LLM** badge) and run through the shared `callLLM()` helper — either the visitor's own key or credits. Two are browser-native (no key needed).

**Writing:** Email Writer & Replier · Rewrite & Tone · Reply Generator · Proofread & Polish.
**Summaries:** Summarize Anything (paste or speak; optional translation and read-aloud) · Meeting Notes → Actions.
**Voice:** Voice Note → Notes & Tasks · Speech to Text (browser) · Text to Speech (browser).
**Social & content:** AI Post Generator · Repurpose Content · Headlines & Hooks.

Adding a tool is a compact config passed to `renderPromptTool()` in `public/tools.js` (input label, control selects/checkboxes, and a `build(input, values)` that returns the prompt).

## Run locally

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

You can change the port:

```bash
PORT=4000 npm start
```

## Deploy notes

The frontend is static, but the credits paywall needs the Node server routes (`/api/create-checkout`, `/api/stripe-webhook`, `/api/llm`, ...). Deploy to a Node-capable host such as Render, Railway, Fly.io, or a VPS. BYOK tools work anywhere; the credits routes stay dormant (clean 503s) until the Stripe/Supabase env vars are set.

## AI tools (bring your own key)

Tools can be code-based or LLM-powered. LLM tools are flagged with a slanted **LLM** badge.

LLM tools use **the visitor's own API key**, entered via the header "API key" button. Supported providers: **Claude (Anthropic), OpenAI, and Google Gemini**. The key is:

- stored **only in the visitor's browser** (`localStorage`), never on the server;
- sent **directly from the browser** to the chosen provider's API (Anthropic uses the `anthropic-dangerous-direct-browser-access` header; OpenAI uses a Bearer token; Gemini takes the key as a query param);
- removable any time with the **Clear key** button.

This means $0 inference cost for the host and no server-side key handling. To add a new LLM tool: write its `render` function and add a `TOOL_DEFINITIONS` entry with `llm: true` in `public/tools.js`; it reuses the shared `callLLM()` helper and settings panel in `public/llm.js`.

## Paid credits (Stripe + Supabase)

Visitors who don't want to bring a key can **buy credits** and run the AI tools with no key of their own — the server makes the call with the owner's key and deducts **1 credit per action**. Pay-as-you-go: **1000 credits for $20** (buy again to top up). BYOK stays the free path.

How it works:
- **Buy:** the "Buy credits" button creates a Stripe Checkout session (`POST /api/create-checkout`) and redirects to Stripe's hosted page — the site never touches card data.
- **Grant:** Stripe's `checkout.session.completed` webhook (`POST /api/stripe-webhook`, HMAC-verified) generates a one-time **access code** and stores a balance in Supabase. The success page (`/credits/success.html`) shows the code and saves it to the browser.
- **Spend:** with a code active, the tools POST to `POST /api/llm`, which atomically spends 1 credit in Supabase and calls the owner's Claude model. Failed calls refund the credit.

Setup (no npm deps — REST + `node:crypto`):
1. **Supabase** — create a project, run [`supabase.sql`](supabase.sql) in the SQL editor. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (server-only).
2. **Stripe** (test mode first) — create a $20 one-time Price (1000 credits) → `STRIPE_PRICE_ID`; copy the secret key → `STRIPE_SECRET_KEY`; add a webhook for `checkout.session.completed` pointing at `/api/stripe-webhook` → `STRIPE_WEBHOOK_SECRET`.
3. **Owner LLM** — the key that pays for credit users. Set `OWNER_LLM_API_KEY`, and optionally `OWNER_LLM_PROVIDER` (`anthropic` | `openai` | `gemini`, default `anthropic`) and `OWNER_LLM_MODEL`. Defaults per provider are the cheapest sensible model: `claude-haiku-4-5`, `gpt-4o-mini`, `gemini-2.0-flash` — e.g. set `OWNER_LLM_PROVIDER=gemini` for near-zero cost per call.
4. Set all as Render environment variables (`sync: false` in `render.yaml`). Access codes are bearer secrets; the Supabase/Stripe/owner keys never reach the browser.
