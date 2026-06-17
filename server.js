const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml"
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
  res.end(message);
}

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

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

function findBalancedJson(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return null;

  const start = source.indexOf("{", markerIndex);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
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

function pickCaptionTrack(captionTracks) {
  const tracks = Array.isArray(captionTracks) ? captionTracks : [];
  return (
    tracks.find((track) => track.languageCode === "en" && !track.kind) ||
    tracks.find((track) => track.languageCode === "en") ||
    tracks.find((track) => String(track.languageCode || "").startsWith("en")) ||
    tracks[0] ||
    null
  );
}

function parseJson3Transcript(payload) {
  const events = Array.isArray(payload.events) ? payload.events : [];

  return events
    .map((event) => {
      const text = Array.isArray(event.segs)
        ? event.segs.map((segment) => segment.utf8 || "").join("")
        : "";

      return {
        start: Number(event.tStartMs || 0) / 1000,
        duration: Number(event.dDurationMs || 0) / 1000,
        text: text.replace(/\s+/g, " ").trim()
      };
    })
    .filter((item) => item.text);
}

function parseXmlTranscript(xml) {
  const matches = [...String(xml || "").matchAll(/<text[^>]*start="([^"]+)"[^>]*(?:dur="([^"]+)")?[^>]*>([\s\S]*?)<\/text>/g)];

  return matches
    .map((match) => ({
      start: Number(match[1] || 0),
      duration: Number(match[2] || 0),
      text: decodeHtml(match[3]).replace(/\s+/g, " ").trim()
    }))
    .filter((item) => item.text);
}

async function fetchYoutubeTranscript(url) {
  const videoId = extractVideoId(url);
  if (!videoId) {
    const error = new Error("Enter a valid YouTube video URL or 11-character video ID.");
    error.statusCode = 400;
    throw error;
  }

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}&hl=en`;
  const watchResponse = await fetch(watchUrl, {
    headers: {
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "Mozilla/5.0 UnleashMyAI/0.1"
    }
  });

  if (!watchResponse.ok) {
    const error = new Error("Could not load the YouTube watch page.");
    error.statusCode = 502;
    throw error;
  }

  const html = await watchResponse.text();
  const rawPlayerResponse = findBalancedJson(html, "ytInitialPlayerResponse");

  if (!rawPlayerResponse) {
    const error = new Error("Could not find YouTube player metadata.");
    error.statusCode = 502;
    throw error;
  }

  const playerResponse = JSON.parse(rawPlayerResponse);
  const details = playerResponse.videoDetails || {};
  const captionTracks =
    playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const selectedTrack = pickCaptionTrack(captionTracks);

  if (!selectedTrack?.baseUrl) {
    const error = new Error("No public captions were found for this video.");
    error.statusCode = 404;
    throw error;
  }

  const captionUrl = new URL(selectedTrack.baseUrl);
  captionUrl.searchParams.set("fmt", "json3");

  const transcriptResponse = await fetch(captionUrl, {
    headers: {
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "Mozilla/5.0 UnleashMyAI/0.1"
    }
  });

  if (!transcriptResponse.ok) {
    const error = new Error("Could not load the caption track.");
    error.statusCode = 502;
    throw error;
  }

  const captionText = await transcriptResponse.text();
  let transcript = [];

  try {
    transcript = parseJson3Transcript(JSON.parse(captionText));
  } catch {
    transcript = parseXmlTranscript(captionText);
  }

  if (!transcript.length) {
    const error = new Error("The caption track was found, but no transcript text could be parsed.");
    error.statusCode = 502;
    throw error;
  }

  const lines = transcript.map((item) => ({
    time: formatTimestamp(item.start),
    start: item.start,
    duration: item.duration,
    text: item.text
  }));

  return {
    videoId,
    title: details.title || "YouTube video",
    author: details.author || "",
    language: selectedTrack.languageCode || "",
    trackName: selectedTrack.name?.simpleText || selectedTrack.name?.runs?.map((run) => run.text).join("") || "",
    lines,
    plainText: lines.map((line) => line.text).join(" "),
    timestampedText: lines.map((line) => `[${line.time}] ${line.text}`).join("\n")
  };
}

function serveStatic(req, res) {
  const requestedPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const normalizedPath = requestedPath === "/" ? "/index.html" : requestedPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, normalizedPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackError, fallbackData) => {
        if (fallbackError) {
          sendText(res, 404, "Not found");
          return;
        }

        res.writeHead(200, { "content-type": MIME_TYPES[".html"] });
        res.end(fallbackData);
      });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "content-type": MIME_TYPES[extension] || "application/octet-stream",
      "cache-control": extension === ".html" ? "no-store" : "public, max-age=3600"
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (requestUrl.pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (requestUrl.pathname === "/api/youtube-transcript") {
    try {
      const transcript = await fetchYoutubeTranscript(requestUrl.searchParams.get("url"));
      sendJson(res, 200, transcript);
    } catch (error) {
      sendJson(res, error.statusCode || 500, {
        error: error.message || "Something went wrong while loading the transcript."
      });
    }
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Unleash My AI running at http://localhost:${PORT}`);
});
