// YouTube transcript fetcher (via Supadata).
//
// Fetching captions straight from YouTube is blocked on datacenter IPs (e.g.
// Render), so we delegate to Supadata's hosted transcript API, which does the
// residential-proxy fetching on their side. We pass `mode=native` so only
// EXISTING captions are returned — a flat 1 credit per video — and the paid
// per-minute speech-to-text fallback (2 credits/min) is never triggered.
//
// Requires the SUPADATA_API_KEY environment variable, set as a secret in the
// host dashboard. The key must never be committed to the repo.

const SUPADATA_ENDPOINT = "https://api.supadata.ai/v1/youtube/transcript";

function extractVideoId(input) {
  try {
    const value = String(input || "").trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

    const parsed = new URL(value);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (parsed.searchParams.has("v")) {
      const id = parsed.searchParams.get("v");
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    const shortsMatch = parsed.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];

    const embedMatch = parsed.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];
  } catch {
    return null;
  }

  return null;
}

function formatTimestamp(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = Math.floor(safeSeconds % 60);
  const mm = String(minutes).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
}

function cleanText(value) {
  // Strip BOM and collapse the newlines/whitespace Supadata leaves in segments.
  return String(value || "").replace(/﻿/g, "").replace(/\s+/g, " ").trim();
}

async function fetchYoutubeTranscript(url) {
  const videoId = extractVideoId(url);
  if (!videoId) {
    const error = new Error("Enter a valid YouTube video URL or 11-character video ID.");
    error.statusCode = 400;
    throw error;
  }

  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) {
    const error = new Error("Transcript service is not configured.");
    error.statusCode = 500;
    throw error;
  }

  const requestUrl = new URL(SUPADATA_ENDPOINT);
  requestUrl.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`);
  // `native` = existing captions only → flat 1 credit, no per-minute AI billing.
  requestUrl.searchParams.set("mode", "native");
  // Prefer English — without this, Supadata sometimes returns an auto-translated
  // track (e.g. German) instead of the original for English videos.
  requestUrl.searchParams.set("lang", "en");

  let response;
  try {
    response = await fetch(requestUrl, { headers: { "x-api-key": apiKey } });
  } catch {
    const error = new Error("Could not reach the transcript service. Please try again.");
    error.statusCode = 502;
    throw error;
  }

  // 402 Payment Required = the shared Supadata free credits are exhausted.
  // Surface a distinct 402 so the UI can point users to the paste-transcript tool.
  if (response.status === 402) {
    const error = new Error("The auto-transcript service is out of free credits for this month.");
    error.statusCode = 402;
    throw error;
  }

  if (response.status === 401 || response.status === 403) {
    const error = new Error("The transcript service rejected the API key.");
    error.statusCode = 500;
    throw error;
  }

  if (response.status === 429) {
    const error = new Error("The transcript service is busy right now. Please wait a moment and try again.");
    error.statusCode = 429;
    throw error;
  }

  if (response.status === 404) {
    const error = new Error("No public captions were found for this video.");
    error.statusCode = 404;
    throw error;
  }

  if (!response.ok) {
    const error = new Error("The transcript service returned an error. Please try again.");
    error.statusCode = 502;
    throw error;
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    const error = new Error("The transcript service returned an unexpected response.");
    error.statusCode = 502;
    throw error;
  }

  const segments = Array.isArray(payload.content) ? payload.content : [];
  const lines = segments
    .map((segment) => {
      const start = Number(segment.offset || 0) / 1000;
      return {
        time: formatTimestamp(start),
        start,
        duration: Number(segment.duration || 0) / 1000,
        text: cleanText(segment.text)
      };
    })
    .filter((line) => line.text);

  if (!lines.length) {
    const error = new Error("No public captions were found for this video.");
    error.statusCode = 404;
    throw error;
  }

  return {
    videoId,
    // Supadata's transcript endpoint omits title/author; the UI falls back to "Transcript".
    title: "",
    author: "",
    language: payload.lang || "",
    trackName: "",
    lines,
    plainText: lines.map((line) => line.text).join(" "),
    timestampedText: lines.map((line) => `[${line.time}] ${line.text}`).join("\n")
  };
}

module.exports = { fetchYoutubeTranscript, extractVideoId };
