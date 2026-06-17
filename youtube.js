// YouTube transcript fetcher.
//
// YouTube's public `timedtext` endpoint no longer returns caption text from a
// plain HTTP scrape — it now requires a "proof-of-origin" (PO) token generated
// by Google's BotGuard. We mint one locally with youtubei.js + bgutils-js, then
// fetch the caption track with a video-bound PO token attached. No API key, no
// LLM — just the same handshake a real browser performs.

const REQUEST_KEY = "O43z0dpjhgX20SCx4KAo";

let sessionPromise = null;
let sessionExpiresAt = 0;

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

function pickCaptionTrack(tracks) {
  const list = Array.isArray(tracks) ? tracks : [];
  const isEnglish = (track) => String(track.language_code || "").startsWith("en");
  const isManual = (track) => track.kind !== "asr";
  return (
    list.find((track) => isEnglish(track) && isManual(track)) ||
    list.find(isEnglish) ||
    list.find(isManual) ||
    list[0] ||
    null
  );
}

function parseJson3Transcript(payload) {
  const events = Array.isArray(payload && payload.events) ? payload.events : [];

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

async function buildSession() {
  const { Innertube } = await import("youtubei.js");
  const { BG, buildURL, GOOG_API_KEY } = await import("bgutils-js");
  const { JSDOM } = await import("jsdom");

  const bootstrap = await Innertube.create({ retrieve_player: false });
  const visitorData = bootstrap.session.context.client.visitorData;

  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
    url: "https://www.youtube.com/"
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  const bgConfig = {
    fetch: (input, init) => fetch(input, init),
    globalObj: globalThis,
    identifier: visitorData,
    requestKey: REQUEST_KEY
  };

  const challenge = await BG.Challenge.create(bgConfig);
  if (!challenge) throw new Error("Could not create a BotGuard challenge.");

  const interpreterJavascript =
    challenge.interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue;
  if (!interpreterJavascript) throw new Error("Could not load the BotGuard interpreter.");
  new Function(interpreterJavascript)();

  const botguard = await BG.BotGuardClient.create({
    program: challenge.program,
    globalName: challenge.globalName,
    globalObj: globalThis
  });

  const webPoSignalOutput = [];
  const botguardResponse = await botguard.snapshot({ webPoSignalOutput });

  const integrityResponse = await fetch(buildURL("GenerateIT", true), {
    method: "POST",
    headers: {
      "Content-Type": "application/json+protobuf",
      "x-goog-api-key": GOOG_API_KEY,
      "x-user-agent": "grpc-web-javascript/0.1"
    },
    body: JSON.stringify([REQUEST_KEY, botguardResponse])
  });

  if (!integrityResponse.ok) {
    throw new Error("Could not obtain a BotGuard integrity token.");
  }

  const integrity = await integrityResponse.json();
  const integrityToken = integrity[0];
  const ttlSeconds = Number(integrity[1]) || 3600;

  const minter = await BG.WebPoMinter.create({ integrityToken }, webPoSignalOutput);
  const sessionPoToken = await minter.mintAsWebsafeString(visitorData);
  const innertube = await Innertube.create({
    po_token: sessionPoToken,
    visitor_data: visitorData
  });

  sessionExpiresAt = Date.now() + Math.min(ttlSeconds, 3 * 3600) * 1000 - 60000;

  return { innertube, minter };
}

async function getSession() {
  if (!sessionPromise || Date.now() >= sessionExpiresAt) {
    sessionPromise = buildSession().catch((error) => {
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise;
}

async function fetchYoutubeTranscript(url) {
  const videoId = extractVideoId(url);
  if (!videoId) {
    const error = new Error("Enter a valid YouTube video URL or 11-character video ID.");
    error.statusCode = 400;
    throw error;
  }

  let session;
  try {
    session = await getSession();
  } catch {
    const error = new Error("Could not establish a YouTube session. Please try again.");
    error.statusCode = 502;
    throw error;
  }

  const { innertube, minter } = session;

  let info;
  try {
    info = await innertube.getInfo(videoId);
  } catch {
    const error = new Error("Could not load this video from YouTube. Check the link and try again.");
    error.statusCode = 502;
    throw error;
  }

  const tracks = info.captions && info.captions.caption_tracks;
  const track = pickCaptionTrack(tracks);
  if (!track || !track.base_url) {
    const error = new Error("No public captions were found for this video.");
    error.statusCode = 404;
    throw error;
  }

  const videoPoToken = await minter.mintAsWebsafeString(videoId);
  const captionUrl = new URL(track.base_url);
  captionUrl.searchParams.set("fmt", "json3");
  captionUrl.searchParams.set("pot", videoPoToken);
  captionUrl.searchParams.set("c", "WEB");

  const captionResponse = await fetch(captionUrl, {
    headers: { "accept-language": "en-US,en;q=0.9" }
  });

  if (captionResponse.status === 429) {
    const error = new Error("YouTube is rate-limiting transcript requests right now. Please wait a minute and try again.");
    error.statusCode = 429;
    throw error;
  }

  if (!captionResponse.ok) {
    const error = new Error("Could not load the caption track.");
    error.statusCode = 502;
    throw error;
  }

  const captionText = await captionResponse.text();
  let transcript = [];
  try {
    transcript = parseJson3Transcript(JSON.parse(captionText));
  } catch {
    transcript = [];
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

  const trackName =
    (track.name && (track.name.text || (typeof track.name.toString === "function" && track.name.toString()))) || "";

  return {
    videoId,
    title: info.basic_info.title || "YouTube video",
    author: info.basic_info.author || "",
    language: track.language_code || "",
    trackName,
    lines,
    plainText: lines.map((line) => line.text).join(" "),
    timestampedText: lines.map((line) => `[${line.time}] ${line.text}`).join("\n")
  };
}

module.exports = { fetchYoutubeTranscript, extractVideoId };
