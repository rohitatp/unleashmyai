# Unleash My AI

Free AI tools for creators, founders, and busy professionals.

A growing toolbox of useful utilities. Today's tools run on browser APIs, deterministic templates, transcript parsing, and lightweight text heuristics; LLM-powered tools are being added over time. Any tool powered by a large language model is marked with an **LLM** badge in the UI.

## Tools included

- Speech to Text: browser-native speech recognition with transcript export.
- Text to Speech: browser-native speech synthesis with voice, rate, pitch, and download-friendly text.
- YouTube Transcript: server-side caption lookup via the Supadata API (set `SUPADATA_API_KEY`).
- Viral Social Media Post Creator: deterministic post generation for LinkedIn, X, Instagram, and Facebook.
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

## AI tools

Tools can be code-based or LLM-powered. Any tool that calls a large language model is flagged with an **LLM** badge in the UI — set `llm: true` on its entry in `public/tools.js` to enable the badge.
