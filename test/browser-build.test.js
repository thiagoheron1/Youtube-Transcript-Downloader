const test = require("node:test");
const assert = require("node:assert/strict");
const { access, mkdtemp, readFile, rm } = require("node:fs/promises");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

test("build creates Chromium, Opera, Firefox, and Safari-source packages", async () => {
  const root = await mkdtemp(join(tmpdir(), "ytdl-build-"));
  try {
    const { buildAll } = await import("../scripts/build.mjs");
    await buildAll(root);
    const chromium = JSON.parse(await readFile(join(root, "chromium", "manifest.json"), "utf8"));
    const opera = JSON.parse(await readFile(join(root, "opera", "manifest.json"), "utf8"));
    const firefox = JSON.parse(await readFile(join(root, "firefox", "manifest.json"), "utf8"));
    const safari = JSON.parse(await readFile(join(root, "safari-source", "manifest.json"), "utf8"));
    assert.deepEqual(chromium.content_scripts[0].js, ["core.js", "page-bridge.js"]);
    assert.equal(chromium.icons[16], "icons/icon-16.png");
    await access(join(root, "chromium", "icons", "favicon.png"));
    await access(join(root, "firefox", "icons", "icon-128.png"));
    await access(join(root, "safari-source", "icons", "icon-256.png"));
    assert.deepEqual(opera.content_scripts, chromium.content_scripts);
    assert.equal(firefox.browser_specific_settings.gecko.strict_min_version, "128.0");
    assert.equal(safari.manifest_version, 3);
    assert.match(await readFile(join(root, "safari-source", "SAFARI.md"), "utf8"), /safari-web-extension-packager/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
