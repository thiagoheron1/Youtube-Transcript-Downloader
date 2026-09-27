(() => {
  if (window.__ytdTranscriptBridgeInstalled) return;
  window.__ytdTranscriptBridgeInstalled = true;

  const CHANNEL = "youtube-transcript-download";
  const Core = globalThis.YTDLCore;
  let capturedPanelSegments = [];

  const send = (type, payload = {}) => {
    window.postMessage({ source: CHANNEL, type, ...payload }, window.location.origin);
  };

  const textFromRuns = (value) => {
    if (!value) return "";
    if (typeof value.simpleText === "string") return value.simpleText;
    if (Array.isArray(value.runs)) return value.runs.map((run) => run.text || "").join("");
    return "";
  };

  const parseClock = (clock) => {
    const parts = String(clock || "0").split(":").map(Number);
    if (parts.some(Number.isNaN)) return 0;
    return parts.reduce((seconds, part) => seconds * 60 + part, 0) * 1000;
  };

  const collectPanelSegments = (root) => {
    const found = [];
    const seen = new Set();

    const visit = (value) => {
      if (!value || typeof value !== "object") return;
      if (value.transcriptSegmentViewModel) {
        const row = value.transcriptSegmentViewModel;
        const startMs = parseClock(row.timestamp);
        const text = (row.simpleText || textFromRuns(row.content)).replace(/\s+/g, " ").trim();
        const key = `${startMs}:${text}`;
        if (text && !seen.has(key)) {
          seen.add(key);
          found.push({ startMs, durationMs: 0, text });
        }
      }
      for (const child of Object.values(value)) visit(child);
    };

    visit(root);
    found.sort((a, b) => a.startMs - b.startMs);
    return found.map((segment, index) => ({
      ...segment,
      durationMs: Math.max(
        1,
        found[index + 1] ? found[index + 1].startMs - segment.startMs : 5000
      )
    }));
  };

  const playerResponse = () => {
    const player = document.querySelector("#movie_player");
    if (player && typeof player.getPlayerResponse === "function") {
      try {
        const response = player.getPlayerResponse();
        if (response) return response;
      } catch (_) {}
    }
    return window.ytInitialPlayerResponse || null;
  };

  const captionRenderer = () => {
    const response = playerResponse();
    return response?.captions?.playerCaptionsTracklistRenderer || {};
  };

  const captionTracks = () => {
    const tracks = captionRenderer().captionTracks || [];
    return tracks.map((track, index) => ({
      index,
      name: textFromRuns(track.name) || track.languageCode || `Track ${index + 1}`,
      languageCode: track.languageCode || "",
      kind: track.kind || "",
      isTranslatable: Boolean(track.isTranslatable),
      baseUrl: track.baseUrl
    }));
  };

  const videoMetadata = () => {
    const response = playerResponse();
    const details = response?.videoDetails || {};
    return {
      videoId: details.videoId || new URL(location.href).searchParams.get("v") || "video",
      title: details.title || document.querySelector("meta[name='title']")?.content || document.title.replace(/\s*-\s*YouTube\s*$/, ""),
      author: details.author || ""
    };
  };

  const parseXml = (xmlText) => {
    const documentXml = new DOMParser().parseFromString(xmlText, "text/xml");
    return [...documentXml.querySelectorAll("text")].map((node) => ({
      startMs: Math.round((Number(node.getAttribute("start")) || 0) * 1000),
      durationMs: Math.max(1, Math.round((Number(node.getAttribute("dur")) || 0) * 1000)),
      text: (node.textContent || "").replace(/\s+/g, " ").trim()
    })).filter((segment) => segment.text);
  };

  const readCaptionResponse = async (response) => {
    const total = Number(response.headers.get("content-length")) || 0;
    if (!response.body?.getReader) {
      send("TRANSCRIPT_PROGRESS", { percent: null });
      return response.text();
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let received = 0;
    let body = "";
    send("TRANSCRIPT_PROGRESS", { percent: total ? 5 : null });
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      body += decoder.decode(value, { stream: true });
      send("TRANSCRIPT_PROGRESS", { percent: total ? Math.min(94, 5 + received / total * 89) : null });
    }
    body += decoder.decode();
    send("TRANSCRIPT_PROGRESS", { percent: 96 });
    return body;
  };

  const loadTrack = async (trackIndex, targetLanguage = "") => {
    const tracks = captionTracks();
    const track = tracks.find((item) => item.index === Number(trackIndex)) || tracks[0];
    if (!track?.baseUrl) {
      if (capturedPanelSegments.length) {
        send("TRANSCRIPT_RESULT", { segments: capturedPanelSegments, track: { name: "YouTube transcript panel" }, metadata: videoMetadata() });
        return;
      }
      throw new Error("No transcript is available for this video.");
    }

    try {
      const url = new URL(track.baseUrl);
      url.searchParams.set("fmt", "json3");
      // YouTube exposes Google-translated caption tracks through `tlang`.
      const requestedTarget = String(targetLanguage || "").trim();
      if (requestedTarget && !track.isTranslatable && requestedTarget !== track.languageCode) {
        throw new Error("Google Translate is not available for this caption track.");
      }
      const shouldTranslate = Boolean(requestedTarget) && track.isTranslatable && requestedTarget !== track.languageCode;
      if (shouldTranslate) url.searchParams.set("tlang", requestedTarget);
      const response = await fetch(url.toString(), { credentials: "include" });
      if (!response.ok) throw new Error(`YouTube returned ${response.status} while loading captions.`);
      const body = await readCaptionResponse(response);
      let segments;
      try {
        segments = Core.parseJson3(JSON.parse(body));
      } catch (_) {
        segments = parseXml(body);
      }
      if (!segments.length) throw new Error("The transcript track was empty.");
      send("TRANSCRIPT_PROGRESS", { percent: 100 });
      send("TRANSCRIPT_RESULT", {
        segments,
        track: {
          name: shouldTranslate ? `${requestedTarget} (translated from ${track.name})` : track.name,
          languageCode: shouldTranslate ? requestedTarget : track.languageCode,
          sourceLanguageCode: shouldTranslate ? track.languageCode : undefined,
          translated: shouldTranslate,
          targetLanguage: shouldTranslate ? requestedTarget : undefined,
          kind: track.kind
        },
        metadata: videoMetadata()
      });
    } catch (error) {
      if (targetLanguage) throw error;
      if (!capturedPanelSegments.length) throw error;
      send("TRANSCRIPT_RESULT", {
        segments: capturedPanelSegments,
        track: { name: track.name || "YouTube transcript panel", languageCode: track.languageCode, kind: track.kind },
        metadata: videoMetadata()
      });
    }
  };

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const requestUrl = typeof args[0] === "string" ? args[0] : args[0]?.url;
      if (requestUrl && requestUrl.includes("/youtubei/v1/get_panel")) {
        response.clone().json().then((data) => {
          const segments = collectPanelSegments(data);
          if (segments.length) {
            capturedPanelSegments = segments;
            send("PANEL_TRANSCRIPT_CAPTURED", { segments, metadata: videoMetadata() });
          }
        }).catch(() => {});
      }
    } catch (_) {}
    return response;
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== CHANNEL) return;
    if (event.data.type === "REQUEST_TRACKS") {
      const response = playerResponse() || {};
      const originalTrackIndex = Core.originalCaptionTrackIndex(response);
      send("TRACKS_RESULT", {
        tracks: captionTracks().map(({ baseUrl, ...track }) => ({
          ...track,
          isOriginal: track.index === originalTrackIndex
        })),
        originalTrackIndex,
        hasCapturedPanel: capturedPanelSegments.length > 0,
        metadata: videoMetadata()
      });
    }
    if (event.data.type === "REQUEST_TRANSCRIPT") {
      loadTrack(event.data.trackIndex, event.data.targetLanguage).catch((error) => {
        send("TRANSCRIPT_ERROR", { message: error?.message || "Could not load the transcript." });
      });
    }
  });
})();
