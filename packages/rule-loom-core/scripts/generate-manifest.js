#!/usr/bin/env node
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { generateManifest } from "../../rule-loom-runner/dist/manifest.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import yaml from "js-yaml";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginDir = path.resolve(dirname, "..");

async function loadInputSchemas() {
  const http = await import(path.join(pluginDir, "dist/inputs/http.js"));
  const scheduler = await import(
    path.join(pluginDir, "dist/inputs/scheduler.js")
  );
  const init = await import(path.join(pluginDir, "dist/inputs/init.js"));
  return {
    http: http.httpInputSchema,
    scheduler: scheduler.schedulerInputSchema,
    init: init.initInputSchema,
  };
}

(async () => {
  const { manifest, manifestPath } = await generateManifest({ pluginDir });

  // augment input schemas using zod-to-json-schema
  // const schemas = await loadInputSchemas();
  // manifest.inputs = (manifest.inputs || []).map((input) => {
  //   const zodSchema = schemas[input.type];
  //   if (zodSchema) {
  //     try {
  //       input.schema = zodToJsonSchema(zodSchema, { target: "openApi3" });
  //     } catch (err) {
  //       console.warn(`Could not convert schema for input ${input.type}:`, err.message);
  //     }
  //   }
  //   return input;
  // });

  fs.writeFileSync(manifestPath, yaml.dump(manifest, { lineWidth: 120 }));
  console.log(`Generated manifest with schemas at ${manifestPath}`);
})().catch((err) => {
  console.error("Failed to generate manifest", err);
  process.exit(1);
});
