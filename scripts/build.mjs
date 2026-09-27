import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sharedFiles = ["core.js", "content.js", "page-bridge.js", "styles.css", "README.md", "icons", "_locales"];

const firefoxManifest = (manifest) => ({
  ...manifest,
  browser_specific_settings: {
    gecko: {
      id: "youtube-transcript-download@example.local",
      strict_min_version: "128.0"
    }
  }
});

const safariInstructions = `# Safari packaging\n\nThis directory is ready for Apple's Safari Web Extension Packager.\n\nRun:\n\n\`\`\`sh\nxcrun safari-web-extension-packager . --app-name "YouTube Transcript Download" --bundle-identifier "com.example.youtube-transcript-download"\n\`\`\`\n\nReplace the example bundle identifier before distribution. Xcode is required for a locally packaged Safari app.\n`;

export async function buildAll(outputRoot = join(projectRoot, "dist")) {
  const manifest = JSON.parse(await readFile(join(projectRoot, "manifest.json"), "utf8"));
  await rm(outputRoot, { recursive: true, force: true });

  for (const browser of ["chromium", "opera", "firefox", "safari-source"]) {
    const directory = join(outputRoot, browser);
    await mkdir(directory, { recursive: true });
    for (const file of sharedFiles) {
      await cp(join(projectRoot, file), join(directory, file), { recursive: true });
    }
    const browserManifest = browser === "firefox" ? firefoxManifest(manifest) : manifest;
    await writeFile(join(directory, "manifest.json"), `${JSON.stringify(browserManifest, null, 2)}\n`);
    if (browser === "safari-source") await writeFile(join(directory, "SAFARI.md"), safariInstructions);
  }
  return outputRoot;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = await buildAll();
  process.stdout.write(`Built browser packages in ${output}\n`);
}
