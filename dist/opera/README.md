<p align="center">
  <img src="icons/logo.png" width="180" alt="YouTube Transcript Downloader logo">
</p>

<h1 align="center">YouTube Transcript Downloader</h1>

<p align="center">
  Export YouTube captions as clean text, Markdown, SRT, or JSON — with timestamps, translations, and AI-ready context.
</p>

<p align="center">
  <strong>Chrome · Edge · Brave · Opera · Vivaldi · Firefox · Safari source</strong>
</p>

## What it does

YouTube Transcript Downloader adds a focused transcript panel beside supported YouTube videos and a compact **Transcript** button below the player. It discovers captions automatically, selects the video’s original language when available, and lets you export the complete transcript in the format you need.

| Automatic discovery | Original-language first |
| --- | --- |
| Finds caption tracks as soon as a video opens, with honest loading progress and a Retry action when needed. | Uses the video’s source audio language instead of a browser-localized dub whenever YouTube exposes that metadata. |
| **Five export formats** | **Translation on demand** |
| Structured text, Markdown, plain text, SRT subtitles, and JSON with timestamps and video metadata. | Optionally requests a selected target language through YouTube’s Google-powered caption translation. |
| **Playback-following preview** | **Ready for AI workflows** |
| Highlights the sentence being spoken and keeps it in view as the video plays. | Add export title, content type, tags, and AI instructions. Saved preferences are restored automatically. |

## Install

### Chrome, Edge, Brave, Opera, Vivaldi, and other Chromium browsers

1. Download or clone this repository.
2. Open your browser’s extension management page:
   - Chrome / Brave / Vivaldi: `chrome://extensions`
   - Edge: `edge://extensions`
   - Opera: `opera://extensions`
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the project folder, or select `dist/chromium` after running the build.
6. Open a YouTube watch page and refresh it once.

### Firefox

1. Run `npm run build`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on**.
4. Choose `dist/firefox/manifest.json`.

Temporary add-ons are removed when Firefox restarts. Permanent Firefox distribution requires signing through Mozilla.

### Safari

Safari requires Apple’s Safari Web Extension Packager and Xcode. First run `npm run build`, then follow [Safari packaging instructions](dist/safari-source/SAFARI.md).

## Use it

1. Open a YouTube video with captions.
2. Wait while the extension searches for tracks. The progress bar is indeterminate while discovery is underway, then becomes a real percentage only when YouTube provides measurable download progress.
3. Check **Video language**. The original video language is selected automatically; choose another available track if you prefer.
4. Optional: enable **Translate before downloading** and choose a target language.
5. Review the interactive transcript. Clicking a row seeks the video to that sentence.
6. Choose an export format. A preview shows the first five transcript entries exactly as they will be exported.
7. Open **Advanced export** if you want to include AI context, tags, content type, or a custom title. These values are saved locally for next time.
8. Click the export button to download the complete transcript.

## Export formats

| Format | Best for | Includes |
| --- | --- | --- |
| Structured text | Reading or quoting | Start and end timestamps |
| Markdown | Notes and documentation | Timestamped Markdown list and metadata |
| Plain text | Clean copy/paste | Transcript text only, or optional metadata |
| SRT | Video editing and players | Standard subtitle timing |
| JSON | Apps, automations, and AI | Segments, metadata, timestamps, and export context |

## Preferences and privacy

- Interface language: English, Brazilian Portuguese, or French, with browser-language detection.
- Appearance: follow system, light, or dark.
- Advanced export options and UI preferences are saved only in the browser’s local extension storage.
- The extension reads caption data exposed by the active YouTube watch page. It does not store account cookies, authorization headers, visitor IDs, or captured network requests.

## Develop

```sh
npm test
npm run build
```

`npm test` runs unit, integration, regression, storage compatibility, and package-build checks. Every bug fix should include a regression test.

`npm run build` creates browser-ready folders in `dist/`:

- `dist/chromium`
- `dist/opera`
- `dist/firefox`
- `dist/safari-source`

## Troubleshooting

| Problem | What to try |
| --- | --- |
| “Looking for available subtitles…” | Wait briefly. If discovery takes eight seconds, use **Retry**. Confirm the video has captions. |
| No caption track is found | Open YouTube’s native transcript panel once, then try Retry. Some videos have no captions. |
| The extension does not appear | Reload the unpacked extension and refresh the YouTube watch page. |
| Translation is unavailable | The selected YouTube caption track may not support translated tracks. Choose another source track or export the original. |

## Project structure

```text
content.js       Extension panel UI and export flow
page-bridge.js   YouTube caption discovery and loading bridge
core.js          Shared, browser-neutral transcript and export logic
styles.css       Panel styling and themes
icons/           Logo, favicon, and extension icons
test/            Unit, integration, regression, and build tests
scripts/         Cross-browser package builder
```

YouTube is a frequently evolving site. If YouTube changes its internal caption structures, update the extension, reload it in your browser, and refresh the watch page.
