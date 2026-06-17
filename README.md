# Unleash My AI

Free AI tools for creators, founders, and busy professionals.

A growing toolbox of useful utilities. Today's tools run on browser APIs, deterministic templates, transcript parsing, and lightweight text heuristics; LLM-powered tools are being added over time. Any tool powered by a large language model is marked with an **LLM** badge in the UI.

## Tools included

- Speech to Text: browser-native speech recognition with transcript export.
- Text to Speech: browser-native speech synthesis with voice, rate, pitch, and download-friendly text.
- YouTube Transcript: server-side caption lookup via the Supadata API (set `SUPADATA_API_KEY`).
- YouTube Summarizer (LLM): fetches the transcript, then summarizes it with the visitor's own AI key.
- Transcript Summarizer (LLM): paste any transcript/long text and get a TL;DR, key points, and chapters.
- Viral Social Media Post Creator: deterministic post generation for LinkedIn, X, Instagram, and Facebook.
- AI Post Generator (LLM): one idea into platform-specific posts written by the visitor's chosen model.
- Voice to LinkedIn Post: speech capture plus rule-based LinkedIn post generation.
- Content Repurposer: turn long text into platform-specific content using templates.
- Clip Finder: find likely short-form clips from timestamped transcripts using scoring rules.

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

The frontend is static, but the YouTube transcript tool needs the Node server route:

```text
/api/youtube-transcript?url=https://www.youtube.com/watch?v=VIDEO_ID
```

For full functionality, deploy to a Node-capable host such as Render, Railway, Fly.io, or a VPS. GitHub Pages can host the static interface, but it cannot run the transcript API server.

## AI tools (bring your own key)

Tools can be code-based or LLM-powered. LLM tools are flagged with a slanted **LLM** badge.

LLM tools use **the visitor's own API key**, entered via the header "API key" button. Supported providers: **Claude (Anthropic), OpenAI, and Google Gemini**. The key is:

- stored **only in the visitor's browser** (`localStorage`), never on the server;
- sent **directly from the browser** to the chosen provider's API (Anthropic uses the `anthropic-dangerous-direct-browser-access` header; OpenAI uses a Bearer token; Gemini takes the key as a query param);
- removable any time with the **Clear key** button.

This means $0 inference cost for the host and no server-side key handling. To add a new LLM tool: write its `render` function and add a `TOOL_DEFINITIONS` entry with `llm: true` in `public/tools.js`; it reuses the shared `callLLM()` helper and settings panel in `public/llm.js`.
