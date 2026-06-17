const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { fetchYoutubeTranscript, inspectVideo } = require("./youtube");

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

// Lightweight per-IP rate limiting for the transcript endpoint. YouTube
// throttles caption requests by source IP, so we keep our own usage modest:
// at most TRANSCRIPT_RATE_MAX requests per IP within TRANSCRIPT_RATE_WINDOW_MS.
const TRANSCRIPT_RATE_WINDOW_MS = 60_000;
const TRANSCRIPT_RATE_MAX = 8;
const transcriptHits = new Map();

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function isRateLimited(ip, now) {
  const recent = (transcriptHits.get(ip) || []).filter((ts) => now - ts < TRANSCRIPT_RATE_WINDOW_MS);
  if (recent.length >= TRANSCRIPT_RATE_MAX) {
    transcriptHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  transcriptHits.set(ip, recent);
  return false;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (requestUrl.pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  // TEMPORARY diagnostic endpoint — remove after confirming the transcript path.
  if (requestUrl.pathname === "/api/youtube-debug") {
    try {
      const id = requestUrl.searchParams.get("id") || "jNQXAC9IVRw";
      const report = await inspectVideo(id);
      sendJson(res, 200, report);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (requestUrl.pathname === "/api/youtube-transcript") {
    const now = Date.now();
    if (isRateLimited(clientIp(req), now)) {
      sendJson(res, 429, {
        error: "You're requesting transcripts too quickly. Please wait a minute and try again."
      });
      return;
    }

    // Opportunistically forget IPs whose window has fully elapsed.
    if (transcriptHits.size > 5000) {
      for (const [ip, hits] of transcriptHits) {
        if (hits.every((ts) => now - ts >= TRANSCRIPT_RATE_WINDOW_MS)) transcriptHits.delete(ip);
      }
    }

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
