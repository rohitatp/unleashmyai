# Unleash My AI

Free code-powered tools for creators, founders, and busy professionals.

This first version intentionally does **not** use AI APIs, LLMs, or paid model providers. The tools are implemented with browser APIs, deterministic templates, transcript parsing, and lightweight text heuristics.

## Tools included

- Speech to Text: browser-native speech recognition with transcript export.
- Text to Speech: browser-native speech synthesis with voice, rate, pitch, and download-friendly text.
- YouTube Transcript: server-side caption lookup and transcript extraction from public caption tracks.
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

## No LLM policy

Current tools must remain deterministic/code-powered. Future tools that use locally hosted models should be added behind clear server-side routes and documented separately.
