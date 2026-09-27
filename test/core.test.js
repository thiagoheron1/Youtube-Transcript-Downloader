const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../core.js");

test("normalizes segment timing and removes blank rows", () => {
  const result = Core.normalizeSegments([
    { startMs: 0, durationMs: 900, text: " Hello " },
    { startMs: 1200, durationMs: 500, text: " " },
    { startMs: 2000, durationMs: 750, text: "World" }
  ]);
  assert.deepEqual(result, [
    { startMs: 0, endMs: 1200, text: "Hello" },
    { startMs: 2000, endMs: 2750, text: "World" }
  ]);
});

test("finds the sentence spoken at playback timing boundaries", () => {
  const segments = Core.normalizeSegments([
    { startMs: 0, durationMs: 1000, text: "Hello" },
    { startMs: 2000, durationMs: 1000, text: "How are you doing" }
  ]);
  assert.equal(Core.findActiveSegmentIndex(segments, 0), 0);
  assert.equal(Core.findActiveSegmentIndex(segments, 1999), 0);
  assert.equal(Core.findActiveSegmentIndex(segments, 2000), 1);
  assert.equal(Core.findActiveSegmentIndex(segments, 2999), 1);
  assert.equal(Core.findActiveSegmentIndex(segments, 3000), -1);
});

test("parses YouTube json3 caption events", () => {
  const rows = Core.parseJson3({ events: [
    { tStartMs: 10, dDurationMs: 900, segs: [{ utf8: "Hello" }, { utf8: " world" }] },
    { tStartMs: 1000, segs: [{ utf8: "[Music]" }] }
  ] });
  assert.deepEqual(rows, [{ startMs: 10, durationMs: 900, text: "Hello world" }]);
});

test("detects supported UI locales", () => {
  assert.equal(Core.detectUiLanguage("pt-BR"), "pt-BR");
  assert.equal(Core.detectUiLanguage("pt-PT"), "pt-BR");
  assert.equal(Core.detectUiLanguage("fr-CA"), "fr");
  assert.equal(Core.detectUiLanguage("es-AR"), "en");
});

test("selects the original video language instead of YouTube's localized default audio", () => {
  const response = {
    captions: { playerCaptionsTracklistRenderer: { captionTracks: [
      { languageCode: "en-US" },
      { languageCode: "pt" }
    ] } },
    streamingData: { adaptiveFormats: [
      { audioTrack: { id: "en-US.10", displayName: "English (US)", audioIsDefault: true, isAutoDubbed: true } },
      { audioTrack: { id: "pt-BR.4", displayName: "Portuguese (BR) original", audioIsDefault: false } }
    ] }
  };
  assert.equal(Core.originalAudioLanguageCode(response), "pt-BR");
  assert.equal(Core.originalCaptionTrackIndex(response), 1);
});

test("falls back safely when YouTube omits original-language metadata", () => {
  assert.equal(Core.originalCaptionTrackIndex({
    captionTracks: [{ languageCode: "en" }, { languageCode: "es" }]
  }), 0);
  assert.equal(Core.originalCaptionTrackIndex({ captionTracks: [{ languageCode: "de" }] }), 0);
  assert.equal(Core.selectedCaptionTrackIndex([{ index: 3 }, { index: 7 }], 7), 7);
  assert.equal(Core.selectedCaptionTrackIndex([{ index: 3 }, { index: 7 }], 99), 3);
});

test("resolves explicit and system themes", () => {
  assert.equal(Core.resolveTheme("system", true), "dark");
  assert.equal(Core.resolveTheme("system", false), "light");
  assert.equal(Core.resolveTheme("dark", false), "dark");
  assert.equal(Core.resolveTheme("light", true), "light");
});

test("settings dropdown toggles and closes with accessible state", () => {
  assert.deepEqual(Core.settingsDropdownState(false, "toggle"), { open: true, hidden: false, expanded: "true" });
  assert.deepEqual(Core.settingsDropdownState(true, "toggle"), { open: false, hidden: true, expanded: "false" });
  assert.deepEqual(Core.settingsDropdownState(true, "close"), { open: false, hidden: true, expanded: "false" });
  assert.deepEqual(Core.settingsDropdownState(false, "open"), { open: true, hidden: false, expanded: "true" });
});

test("progress reflects discovery, measured downloads, completion, and idle states", () => {
  assert.deepEqual(Core.progressIndicatorState({ discovering: true }), { visible: true, determinate: false, value: null });
  assert.deepEqual(Core.progressIndicatorState({ loading: true }), { visible: true, determinate: false, value: null });
  assert.deepEqual(Core.progressIndicatorState({ loading: true, percent: 42 }), { visible: true, determinate: true, value: 42 });
  assert.deepEqual(Core.progressIndicatorState({ completed: true }), { visible: true, determinate: true, value: 100 });
  assert.deepEqual(Core.progressIndicatorState(), { visible: false, determinate: false, value: null });
});

test("regression: idle and failed requests never display fake 100 percent progress", () => {
  assert.deepEqual(Core.progressIndicatorState({ loading: false, percent: 100 }), {
    visible: false,
    determinate: false,
    value: null
  });
});

test("starts automatic loading when captions are available and no request is active", () => {
  const ready = { loading: false, segments: [], autoLoadRequested: false, tracks: [{ index: 0 }], hasCapturedPanel: false };
  assert.equal(Core.shouldAutoLoad(ready), true);
  assert.equal(Core.shouldAutoLoad({ ...ready, autoLoadRequested: true }), true);
  assert.equal(Core.shouldAutoLoad({ ...ready, loading: true }), false);
  assert.equal(Core.shouldAutoLoad({ ...ready, retryVisible: true }), false);
  assert.equal(Core.shouldAutoLoad({ ...ready, tracks: [], hasCapturedPanel: true }), true);
});

test("regression: a stale auto-load marker cannot strand an idle caption selector", () => {
  assert.equal(Core.shouldAutoLoad({
    loading: false,
    segments: [],
    autoLoadRequested: true,
    tracks: [{ index: 0, languageCode: "pt" }],
    hasCapturedPanel: false,
    retryVisible: false,
    statusMessage: "Procurando legendas disponíveis…"
  }), true);
});

test("regression: an error and Retry survive a panel rebuild", () => {
  const restored = Core.restoredPanelState({
    statusMessage: "Subtitle loading took too long. Please retry.",
    statusKind: "error",
    retryVisible: true,
    loading: false
  });
  assert.deepEqual(restored, {
    statusMessage: "Subtitle loading took too long. Please retry.",
    statusKind: "error",
    retryVisible: true
  });
  assert.equal(Core.restoredPanelState({ retryVisible: true, loading: true }).retryVisible, false);
});

test("WebExtensions adapter works with Promise-based browser APIs", async () => {
  const values = {};
  const api = Core.createExtensionApi({
    storage: { local: {
      async get(key) { return typeof key === "string" ? { [key]: values[key] } : values; },
      async set(update) { Object.assign(values, update); }
    } },
    runtime: { getURL: (path) => `moz-extension://test/${path}` }
  });
  await api.storageSet({ setting: "dark" });
  assert.deepEqual(await api.storageGet("setting"), { setting: "dark" });
  assert.equal(api.getURL("core.js"), "moz-extension://test/core.js");
});
