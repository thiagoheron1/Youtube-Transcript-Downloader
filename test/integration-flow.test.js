const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../core.js");
const { readFile } = require("node:fs/promises");
const { join } = require("node:path");

test("caption response flows through translation metadata, five-row preview, and full export", () => {
  const events = Array.from({ length: 8 }, (_, index) => ({
    tStartMs: index * 1000,
    dDurationMs: 1000,
    segs: [{ utf8: `Segment ${index + 1}` }]
  }));
  const state = {
    segments: Core.parseJson3({ events }),
    metadata: { videoId: "abc123", title: "Demo", author: "Channel" },
    track: { name: "English (translated)", languageCode: "en", sourceLanguageCode: "es", translated: true },
    advanced: { title: "AI Demo", contentType: "Interview", tags: "ai, demo", context: "Summarize accurately", includeMetadata: true }
  };

  const preview = Core.buildOutputs(state, 5);
  const full = Core.buildOutputs(state);
  assert.equal(JSON.parse(preview.json.content).segments.length, 5);
  assert.equal(JSON.parse(full.json.content).segments.length, 8);
  assert.match(preview.markdown.content, /\*\*Content type:\*\* Interview/);
  assert.match(full.structured.content, /AI context: Summarize accurately/);
  assert.match(full.srt.content, /8\n00:00:07,000 --> 00:00:08,000\nSegment 8/);
});

test("automatic load failure restores actionable UI after settings rebuild", () => {
  const state = {
    loading: false,
    segments: [],
    tracks: [{ index: 0 }],
    hasCapturedPanel: false,
    autoLoadRequested: false,
    statusMessage: "",
    statusKind: "",
    retryVisible: false
  };
  assert.equal(Core.shouldAutoLoad(state), true);
  state.autoLoadRequested = true;
  state.statusMessage = "Timed out";
  state.statusKind = "error";
  state.retryVisible = true;
  assert.deepEqual(Core.restoredPanelState(state), {
    statusMessage: "Timed out",
    statusKind: "error",
    retryVisible: true
  });
});

test("track discovery recovers an idle automatic load instead of leaving the UI searching forever", () => {
  const state = {
    loading: false,
    segments: [],
    tracks: [{ index: 1, languageCode: "pt" }],
    hasCapturedPanel: false,
    autoLoadRequested: true,
    retryVisible: false
  };
  assert.equal(Core.shouldAutoLoad(state), true);
  state.loading = true;
  assert.equal(Core.shouldAutoLoad(state), false);
});

test("subtitle lifecycle shows only progress supported by the current operation", () => {
  const discovery = Core.progressIndicatorState({ discovering: true });
  const responseWithoutLength = Core.progressIndicatorState({ loading: true, percent: null });
  const measuredDownload = Core.progressIndicatorState({ loading: true, percent: 68 });
  const failure = Core.progressIndicatorState({ loading: false, percent: 100 });
  const success = Core.progressIndicatorState({ completed: true });
  assert.equal(discovery.determinate, false);
  assert.equal(responseWithoutLength.determinate, false);
  assert.equal(measuredDownload.value, 68);
  assert.equal(failure.visible, false);
  assert.equal(success.value, 100);
});

test("loaded transcript follows the active sentence as playback advances", () => {
  const segments = Core.normalizeSegments([
    { startMs: 0, durationMs: 1000, text: "Hello" },
    { startMs: 1000, durationMs: 1000, text: "How are you doing" },
    { startMs: 2000, durationMs: 1000, text: "Goodbye" }
  ]);
  assert.equal(segments[Core.findActiveSegmentIndex(segments, 500)].text, "Hello");
  assert.equal(segments[Core.findActiveSegmentIndex(segments, 1500)].text, "How are you doing");
  assert.equal(segments[Core.findActiveSegmentIndex(segments, 2500)].text, "Goodbye");
});

test("original video language becomes the transcript request selection even when YouTube defaults to a dub", () => {
  const response = {
    captions: { playerCaptionsTracklistRenderer: { captionTracks: [
      { languageCode: "en-US", name: "English" },
      { languageCode: "pt", name: "Portuguese" }
    ] } },
    streamingData: { adaptiveFormats: [
      { audioTrack: { id: "en-US.10", audioIsDefault: true, isAutoDubbed: true } },
      { audioTrack: { id: "pt-BR.4", displayName: "Portuguese original", audioIsDefault: false } }
    ] }
  };
  const tracks = response.captions.playerCaptionsTracklistRenderer.captionTracks.map((track, index) => ({ ...track, index }));
  const videoOriginal = Core.originalCaptionTrackIndex(response);
  const requestedTrack = Core.selectedCaptionTrackIndex(tracks, videoOriginal);
  assert.equal(tracks[requestedTrack].languageCode, "pt");
});

test("settings render as an anchored accessible dropdown instead of expanding the panel", async () => {
  const [content, styles] = await Promise.all([
    readFile(join(__dirname, "..", "content.js"), "utf8"),
    readFile(join(__dirname, "..", "styles.css"), "utf8")
  ]);
  assert.match(content, /aria-haspopup="dialog"/);
  assert.match(content, /aria-expanded="false"/);
  assert.match(content, /event\.key === "Escape"/);
  assert.match(content, /pointerdown/);
  assert.match(styles, /\.ytdl-settings \{ position: absolute;/);
});
