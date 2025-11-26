#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateManifest } from "../../rule-loom-runner/src/manifest.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginDir = path.resolve(dirname, "..");

(async () => {
  const { manifestPath } = await generateManifest({ pluginDir });
  console.log(`Generated manifest at ${manifestPath}`);
})().catch((err) => {
  console.error("Failed to generate manifest", err);
  process.exit(1);
});
