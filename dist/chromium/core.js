(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.YTDLCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const pad = (number, width = 2) => String(Math.floor(number)).padStart(width, "0");

  const clock = (milliseconds) => {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remaining = seconds % 60;
    return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(remaining)}` : `${pad(minutes)}:${pad(remaining)}`;
  };

  const srtClock = (milliseconds) => {
    const value = Math.max(0, Math.floor(milliseconds));
    const hours = Math.floor(value / 3600000);
    const minutes = Math.floor((value % 3600000) / 60000);
    const seconds = Math.floor((value % 60000) / 1000);
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(value % 1000, 3)}`;
  };

  const safeName = (value) => (value || "youtube-transcript")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "youtube-transcript";

  const normalizeSegments = (input = []) => input.map((segment, index, all) => {
    const startMs = Number(segment.startMs) || 0;
    const nextStart = Number(all[index + 1]?.startMs);
    const endMs = Number.isFinite(nextStart) && nextStart > startMs
      ? nextStart
      : startMs + Math.max(1, Number(segment.durationMs) || 5000);
    return { startMs, endMs, text: String(segment.text || "").trim() };
  }).filter((segment) => segment.text);

  const findActiveSegmentIndex = (segments, milliseconds) => {
    if (!segments.length || !Number.isFinite(milliseconds) || milliseconds < segments[0].startMs) return -1;
    let low = 0;
    let high = segments.length - 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const segment = segments[middle];
      if (milliseconds < segment.startMs) {
        high = middle - 1;
      } else if (milliseconds >= segment.endMs) {
        low = middle + 1;
      } else {
        return middle;
      }
    }
    return -1;
  };

  const originalAudioLanguageCode = (response = {}) => {
    const formats = [
      ...(Array.isArray(response?.streamingData?.formats) ? response.streamingData.formats : []),
      ...(Array.isArray(response?.streamingData?.adaptiveFormats) ? response.streamingData.adaptiveFormats : [])
    ];
    const audioTracks = [];
    const seen = new Set();
    for (const format of formats) {
      const track = format?.audioTrack;
      if (!track?.id || seen.has(track.id)) continue;
      seen.add(track.id);
      audioTracks.push(track);
    }
    if (!audioTracks.length) return "";

    const originalLabel = /\boriginal\b|d['’]origine|оригинал|原始|オリジナル|원본/i;
    const labeledOriginal = audioTracks.find((track) => originalLabel.test(String(track.displayName || "")));
    const explicitlyNotDubbed = audioTracks.find((track) => track.isAutoDubbed === false);
    const inferredOriginal = audioTracks.some((track) => track.isAutoDubbed === true)
      ? audioTracks.find((track) => track.isAutoDubbed !== true)
      : audioTracks[0];
    const originalTrack = labeledOriginal || explicitlyNotDubbed || inferredOriginal;
    return String(originalTrack?.id || "").replace(/\.\d+$/, "");
  };

  const originalCaptionTrackIndex = (response = {}) => {
    const renderer = response?.captions?.playerCaptionsTracklistRenderer || response;
    const tracks = Array.isArray(renderer.captionTracks) ? renderer.captionTracks : [];
    if (!tracks.length) return 0;
    const originalLanguage = originalAudioLanguageCode(response).toLowerCase();
    if (!originalLanguage) return 0;
    const exactMatch = tracks.findIndex((track) => String(track?.languageCode || "").toLowerCase() === originalLanguage);
    if (exactMatch >= 0) return exactMatch;
    const baseLanguage = originalLanguage.split("-")[0];
    const baseMatch = tracks.findIndex((track) => String(track?.languageCode || "").toLowerCase().split("-")[0] === baseLanguage);
    return baseMatch >= 0 ? baseMatch : 0;
  };

  const selectedCaptionTrackIndex = (tracks = [], preferredIndex = 0) => {
    const preferred = Number(preferredIndex);
    const match = tracks.find((track) => Number(track.index) === preferred);
    return match ? Number(match.index) : Number(tracks[0]?.index) || 0;
  };

  const exportMetadata = ({ metadata = {}, track = {}, advanced = {} }, locationHref = "") => {
    const tags = String(advanced.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
    return {
      title: String(advanced.title || "").trim() || metadata.title || "YouTube transcript",
      channel: metadata.author || "",
      sourceUrl: metadata.videoId ? `https://www.youtube.com/watch?v=${metadata.videoId}` : locationHref,
      videoId: metadata.videoId || "",
      language: track.languageCode || "",
      languageName: track.name || "Default",
      sourceLanguage: track.sourceLanguageCode || "",
      translated: Boolean(track.translated),
      contentType: String(advanced.contentType || "").trim(),
      tags,
      aiContext: String(advanced.context || "").trim()
    };
  };

  const textMetadataBlock = (metadata, includeMetadata) => {
    if (!includeMetadata) return "";
    const rows = [
      `Title: ${metadata.title}`,
      metadata.channel && `Channel: ${metadata.channel}`,
      metadata.sourceUrl && `Source: ${metadata.sourceUrl}`,
      metadata.languageName && `Language: ${metadata.languageName}`,
      metadata.contentType && `Content type: ${metadata.contentType}`,
      metadata.tags.length && `Tags: ${metadata.tags.join(", ")}`,
      metadata.aiContext && `AI context: ${metadata.aiContext}`
    ].filter(Boolean);
    return `${rows.join("\n")}\n\n---\n\n`;
  };

  const buildOutputs = (state, segmentLimit = null, locationHref = "") => {
    const allSegments = normalizeSegments(state.segments);
    const segments = Number.isInteger(segmentLimit) ? allSegments.slice(0, segmentLimit) : allSegments;
    const metadata = exportMetadata(state, locationHref);
    const markdownMetadata = [
      metadata.channel && `**Channel:** ${metadata.channel}`,
      metadata.sourceUrl && `**Source:** ${metadata.sourceUrl}`,
      `**Language:** ${metadata.languageName}`,
      metadata.contentType && `**Content type:** ${metadata.contentType}`,
      metadata.tags.length && `**Tags:** ${metadata.tags.join(", ")}`,
      metadata.aiContext && `> **AI context:** ${metadata.aiContext.replace(/\n/g, "\n> ")}`
    ].filter(Boolean).join("\n\n");
    const prefix = textMetadataBlock(metadata, state.advanced?.includeMetadata);

    return {
      original: { extension: "txt", mime: "text/plain", content: prefix + segments.map(({ text }) => text).join("\n") },
      structured: { extension: "txt", mime: "text/plain", content: prefix + segments.map(({ startMs, endMs, text }) => `(${clock(startMs)} - ${clock(endMs)}) ${text}`).join("\n\n") },
      markdown: { extension: "md", mime: "text/markdown", content: `# ${metadata.title}\n\n${markdownMetadata}\n\n## Transcript\n\n${segments.map(({ startMs, endMs, text }) => `- **${clock(startMs)}–${clock(endMs)}** ${text}`).join("\n")}` },
      srt: { extension: "srt", mime: "application/x-subrip", content: segments.map(({ startMs, endMs, text }, index) => `${index + 1}\n${srtClock(startMs)} --> ${srtClock(endMs)}\n${text}`).join("\n\n") },
      json: { extension: "json", mime: "application/json", content: JSON.stringify({ metadata, video: state.metadata, track: state.track, segments }, null, 2) }
    };
  };

  const parseJson3 = (data) => {
    const rows = [];
    for (const event of data?.events || []) {
      const text = (event.segs || []).map((segment) => segment.utf8 || "").join("").replace(/\s+/g, " ").trim();
      if (!text || text === "[Music]" && !event.dDurationMs) continue;
      rows.push({ startMs: Number(event.tStartMs) || 0, durationMs: Math.max(1, Number(event.dDurationMs) || 0), text });
    }
    return rows;
  };

  const detectUiLanguage = (language = "en") => {
    const normalized = String(language).toLowerCase();
    if (normalized.startsWith("pt")) return "pt-BR";
    if (normalized.startsWith("fr")) return "fr";
    return "en";
  };

  const resolveTheme = (setting, prefersDark) => setting === "system"
    ? (prefersDark ? "dark" : "light")
    : (setting === "dark" ? "dark" : "light");

  const shouldAutoLoad = ({ loading, segments = [], tracks = [], hasCapturedPanel, retryVisible = false }) =>
    !loading && !segments.length && !retryVisible && Boolean(tracks.length || hasCapturedPanel);

  const restoredPanelState = ({ statusMessage = "", statusKind = "", retryVisible = false, loading = false }) => ({
    statusMessage,
    statusKind,
    retryVisible: Boolean(retryVisible && !loading)
  });

  const settingsDropdownState = (open = false, action = "toggle") => {
    const nextOpen = action === "open" ? true : action === "close" ? false : !open;
    return { open: nextOpen, hidden: !nextOpen, expanded: String(nextOpen) };
  };

  const progressIndicatorState = ({ discovering = false, loading = false, completed = false, percent = null } = {}) => {
    const measured = loading && Number.isFinite(percent);
    const value = completed ? 100 : measured ? Math.max(0, Math.min(100, Number(percent))) : null;
    return {
      visible: Boolean(discovering || loading || completed),
      determinate: value !== null,
      value
    };
  };

  const createExtensionApi = (api) => ({
    async storageGet(keys) {
      return api.storage.local.get(keys);
    },
    async storageSet(value) {
      return api.storage.local.set(value);
    },
    getURL(path) {
      return api.runtime.getURL(path);
    }
  });

  return {
    buildOutputs,
    clock,
    createExtensionApi,
    detectUiLanguage,
    exportMetadata,
    findActiveSegmentIndex,
    normalizeSegments,
    originalAudioLanguageCode,
    originalCaptionTrackIndex,
    parseJson3,
    progressIndicatorState,
    resolveTheme,
    restoredPanelState,
    safeName,
    selectedCaptionTrackIndex,
    settingsDropdownState,
    shouldAutoLoad,
    srtClock
  };
});
