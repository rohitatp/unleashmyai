const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const credits = require("./credits");
const auth = require("./auth");

// Read a request body as a raw string (used for JSON parsing and Stripe HMAC).
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) req.destroy(); // ~1MB guard
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

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

// Serve a file with revalidation caching: browsers must check with the server
// (Cache-Control: no-cache), and we return 304 when unchanged (via Last-Modified)
// so a deploy shows up immediately without a manual hard-refresh, cheaply.
function sendFile(filePath, req, res) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      sendText(res, 404, "Not found");
      return;
    }
    const extension = path.extname(filePath).toLowerCase();
    const lastModified = stat.mtime.toUTCString();
    const ims = req.headers["if-modified-since"];
    if (ims && Math.floor(new Date(ims).getTime() / 1000) >= Math.floor(stat.mtime.getTime() / 1000)) {
      res.writeHead(304, { "Cache-Control": "no-cache", "Last-Modified": lastModified });
      res.end();
      return;
    }
    fs.readFile(filePath, (readError, data) => {
      if (readError) {
        sendText(res, 404, "Not found");
        return;
      }
      res.writeHead(200, {
        "content-type": MIME_TYPES[extension] || "application/octet-stream",
        "Cache-Control": "no-cache",
        "Last-Modified": lastModified
      });
      res.end(data);
    });
  });
}

function serveStatic(req, res) {
  const requestedPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const normalizedPath = requestedPath === "/" ? "/index.html" : requestedPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, normalizedPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      sendFile(filePath, req, res);
    } else {
      sendFile(path.join(PUBLIC_DIR, "index.html"), req, res); // SPA fallback
    }
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

  // ---- Paid credits (Stripe + Supabase) ----

  if (requestUrl.pathname === "/api/create-checkout" && req.method === "POST") {
    try {
      const proto = req.headers["x-forwarded-proto"] || "https";
      const origin = `${proto}://${req.headers.host}`;
      sendJson(res, 200, await credits.createCheckout(origin));
    } catch (error) {
      sendJson(res, error.statusCode || 500, { error: error.message });
    }
    return;
  }

  if (requestUrl.pathname === "/api/stripe-webhook" && req.method === "POST") {
    try {
      const raw = await readRawBody(req);
      sendJson(res, 200, await credits.handleStripeWebhook(raw, req.headers["stripe-signature"] || ""));
    } catch (error) {
      sendJson(res, error.statusCode || 400, { error: error.message });
    }
    return;
  }

  if (requestUrl.pathname === "/api/credit-code") {
    try {
      sendJson(res, 200, await credits.getCodeForSession(requestUrl.searchParams.get("session_id")));
    } catch (error) {
      sendJson(res, error.statusCode || 500, { error: error.message });
    }
    return;
  }

  if (requestUrl.pathname === "/api/credit-balance") {
    try {
      sendJson(res, 200, await credits.getBalance(requestUrl.searchParams.get("code")));
    } catch (error) {
      sendJson(res, error.statusCode || 500, { error: error.message });
    }
    return;
  }

  if (requestUrl.pathname === "/api/llm" && req.method === "POST") {
    if (isRateLimited(clientIp(req), Date.now())) {
      sendJson(res, 429, { error: "Too many requests. Please slow down and try again." });
      return;
    }
    try {
      const body = JSON.parse((await readRawBody(req)) || "{}");
      sendJson(res, 200, await credits.spendAndComplete(body));
    } catch (error) {
      sendJson(res, error.statusCode || 500, { error: error.message || "Request failed." });
    }
    return;
  }

  // ---- Optional Google login ----

  if (requestUrl.pathname === "/api/config") {
    sendJson(res, 200, { googleClientId: auth.googleClientId() });
    return;
  }

  if (requestUrl.pathname === "/api/auth/google" && req.method === "POST") {
    try {
      const body = JSON.parse((await readRawBody(req)) || "{}");
      sendJson(res, 200, await auth.loginWithGoogle(body.credential));
    } catch (error) {
      sendJson(res, error.statusCode || 500, { error: error.message || "Sign-in failed." });
    }
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Unleash My AI running at http://localhost:${PORT}`);
});
