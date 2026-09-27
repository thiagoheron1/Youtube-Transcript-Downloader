# Development rules

- Every bug fix must include a regression test that fails before the fix and passes afterward.
- New behavior must include unit tests for its pure logic and an integration test for the user-visible workflow it affects.
- Run `npm test` and `npm run build` before packaging or handing off a release.
- Keep the shared runtime browser-neutral. Use the WebExtensions compatibility adapter instead of calling `chrome.*` or `browser.*` directly.
- Keep Chromium, Firefox, and Safari-source manifests valid whenever permissions, scripts, or packaged assets change.
