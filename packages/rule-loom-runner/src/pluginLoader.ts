import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import https from "node:https";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import yaml from "js-yaml";
import type { RuleLoomLogger } from "rule-loom-lib";
import { registerInputPlugin, resetInputPlugins } from "./pluginApi.js";
import type { ClosureDefinition } from "rule-loom-engine";
import { registerClosure } from "./closureRegistry.js";
import type { PluginSpec } from "./pluginSpecs.js";
import { parseClosureConfigs } from "./config.js";
import { buildClosures } from "./closures.js";

const execFileAsync = promisify(execFile);
const loadedPlugins = new Set<string>();
const loadedPluginInventory = new Map<string, LoadedPluginInfo>();

export interface RuleLoomPlugin {
  name?: string;
  version?: string;
  register?: (ctx: PluginRegistrationContext) => Promise<void> | void;
}

export interface LoadedPluginInfo {
  id: string;
  source: PluginSpec["source"] | "builtin";
  modulePath: string;
  name?: string;
  version?: string;
  manifestPath?: string;
  manifestRaw?: string;
}

export interface PluginRegistrationContext {
  registerInputPlugin: typeof registerInputPlugin;
  registerClosure: (closure: ClosureDefinition) => void;
  logger: RuleLoomLogger;
}

export interface PluginLoaderOptions {
  configDir: string;
  cacheDir?: string;
  logger: RuleLoomLogger;
}

const DEFAULT_CACHE_DIR = path.join(os.homedir(), ".rule-loom", "plugins");
const GITHUB_CACHE_META = ".ruleloom-github.json";

export async function loadRuleLoomPlugins(
  specs: PluginSpec[],
  options: PluginLoaderOptions,
) {
  const cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR;
  await fs.mkdir(cacheDir, { recursive: true }).catch(() => undefined);

  if (!specs.length) return;

  for (const spec of specs) {
    const modulePath = await resolvePluginModule(spec, {
      ...options,
      cacheDir,
    });
    if (loadedPlugins.has(modulePath)) {
      options.logger.debug?.(
        `Plugin at ${modulePath} already loaded; skipping.`,
      );
      continue;
    }

    if (spec.source !== "config") {
      await requireManifest(modulePath);
    }

    if (spec.source === "config") {
      const sourcePath = fileURLToPath(new URL(modulePath));
      const rawFile = await fs.readFile(sourcePath, "utf8");
      const parsed = (yaml.load(rawFile) ?? {}) as any;
      const closureEntries = Array.isArray(parsed)
        ? parsed
        : (parsed.closures ?? []);
      const closureConfigs = parseClosureConfigs(closureEntries);
      const closures = await buildClosures(
        closureConfigs,
        path.dirname(sourcePath),
        options.logger,
      );
      closures.forEach((c) => registerClosure(c));
      loadedPlugins.add(modulePath);
      await recordLoadedPlugin({
        id: inventoryIdForSpec(spec, modulePath),
        source: spec.source,
        modulePath,
        name: specName(spec),
      });
      continue;
    }
    const pluginModule = await import(modulePath);
    const plugin: RuleLoomPlugin | undefined =
      pluginModule.default ?? pluginModule.plugin ?? pluginModule;
    if (!plugin || typeof plugin.register !== "function") {
      throw new Error(
        `Plugin loaded from ${modulePath} does not export a { register } function.`,
      );
    }

    const name = plugin.name ?? specName(spec);
    options.logger.info?.(
      `Registering plugin ${name ?? "unknown"}${plugin.version ? `@${plugin.version}` : ""}`,
    );
    await plugin.register({
      registerInputPlugin,
      registerClosure,
      logger: options.logger,
    });
    loadedPlugins.add(modulePath);
    await recordLoadedPlugin({
      id: inventoryIdForSpec(spec, modulePath),
      source: spec.source,
      modulePath,
      name,
      version: plugin.version,
    });
  }
}

export function resetLoadedPlugins() {
  loadedPlugins.clear();
  loadedPluginInventory.clear();
  resetInputPlugins();
}

export function getLoadedPlugins(): LoadedPluginInfo[] {
  return Array.from(loadedPluginInventory.values());
}

function specName(spec: PluginSpec): string | undefined {
  if (spec.source === "file") return spec.name ?? path.basename(spec.path);
  if (spec.source === "config") return spec.name ?? path.basename(spec.path);
  if (spec.source === "github") return spec.name ?? spec.repo;
  return spec.name;
}

interface ResolveOptions extends PluginLoaderOptions {
  cacheDir: string;
}

async function resolvePluginModule(
  spec: PluginSpec,
  options: ResolveOptions,
): Promise<string> {
  if (spec.source === "config") {
    const resolved = spec.path.startsWith("file:")
      ? spec.path.replace(/^file:/, "")
      : spec.path;
    const absolute = path.isAbsolute(resolved)
      ? resolved
      : path.resolve(options.configDir, resolved);
    return pathToFileURL(absolute).href;
  }

  if (spec.source === "file") {
    const p = spec.path.startsWith("file:")
      ? spec.path.replace(/^file:/, "")
      : spec.path;
    const primaryResolved = path.isAbsolute(p)
      ? p
      : path.resolve(options.configDir, p);
    const entry = await resolveEntryFile(primaryResolved);
    if (entry) {
      return pathToFileURL(entry).href;
    }

    // Fallback: resolve relative to current working directory for inline configs
    // whose temp directory does not mirror the plugin location.
    const fallbackResolved = path.isAbsolute(p)
      ? p
      : path.resolve(process.cwd(), p);
    const fallbackEntry = await resolveEntryFile(fallbackResolved);
    return pathToFileURL(fallbackEntry ?? fallbackResolved).href;
  }

  if (spec.source === "npm" || spec.source === "store") {
    // Attempt native resolution; external download would require package manager.
    return spec.name;
  }

  // github source
  const cacheKey = `${spec.repo.replace(/[\\/]/g, "_")}@${spec.ref}`;
  const targetDir = path.join(options.cacheDir, cacheKey);
  const entryFile = spec.path ? path.join(targetDir, spec.path) : targetDir;

  const exists = await fs
    .stat(entryFile)
    .then((s) => s.isDirectory() || s.isFile())
    .catch(() => false);
  const updatePlan = await planGithubUpdate(spec, targetDir, exists, options);
  if (updatePlan.shouldDownload) {
    await downloadGithubRepo(spec, targetDir, options);
    await writeGithubCacheMeta(targetDir, {
      repo: spec.repo,
      ref: spec.ref,
      commit: updatePlan.latestCommit,
      fetchedAt: new Date().toISOString(),
    });
  }

  const entry = (await resolveEntryFile(entryFile)) ?? entryFile;
  return pathToFileURL(entry).href;
}

async function resolveEntryFile(fsPath: string): Promise<string | undefined> {
  const stat = await fs.stat(fsPath).catch(() => undefined);
  if (!stat) return undefined;
  if (stat.isFile()) return fsPath;

  if (stat.isDirectory()) {
    const distIndex = path.join(fsPath, "dist", "index.js");
    const srcIndex = path.join(fsPath, "index.js");
    const tsSrcIndex = path.join(fsPath, "src", "index.ts");
    const pkgJsonPath = path.join(fsPath, "package.json");

    const distExists = await fs
      .stat(distIndex)
      .then((s) => s.isFile())
      .catch(() => false);
    if (distExists) return distIndex;

    const srcExists = await fs
      .stat(srcIndex)
      .then((s) => s.isFile())
      .catch(() => false);
    if (srcExists) return srcIndex;

    const tsExists = await fs
      .stat(tsSrcIndex)
      .then((s) => s.isFile())
      .catch(() => false);
    if (tsExists) return tsSrcIndex;

    const pkgJsonExists = await fs
      .stat(pkgJsonPath)
      .then((s) => s.isFile())
      .catch(() => false);

    if (pkgJsonExists) {
      try {
        const pkg = JSON.parse(await fs.readFile(pkgJsonPath, "utf8"));
        const exportEntry =
          typeof pkg.module === "string" ? pkg.module : pkg.main;
        if (exportEntry) {
          const resolved = path.join(fsPath, exportEntry);
          const resolvedExists = await fs
            .stat(resolved)
            .then((s) => s.isFile())
            .catch(() => false);
          if (resolvedExists) return resolved;
        }
      } catch {
        // ignore malformed package.json
      }
    }
  }

  return undefined;
}

async function requireManifest(modulePath: string) {
  const manifestPath = await locateManifest(modulePath);
  const exists = manifestPath
    ? await fs
        .stat(manifestPath)
        .then((s) => s.isFile())
        .catch(() => false)
    : false;

  if (!exists) {
    throw new Error(
      `Missing ruleloom.manifest.yaml for plugin (${modulePath}). Generate one with "ruleloom-runner manifest <plugin-dir>".`,
    );
  }
}

async function locateManifest(
  resolvedModulePath: string,
): Promise<string | undefined> {
  const require = createRequire(import.meta.url);

  if (resolvedModulePath.startsWith("file:")) {
    const fsPath = fileURLToPath(resolvedModulePath);
    let current = path.extname(fsPath) ? path.dirname(fsPath) : fsPath;
    while (true) {
      const candidate = path.join(current, "ruleloom.manifest.yaml");
      // eslint-disable-next-line no-await-in-loop
      const exists = await fs
        .stat(candidate)
        .then((s) => s.isFile())
        .catch(() => false);
      if (exists) return candidate;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return undefined;
  }

  // Attempt to resolve relative to module name (npm/store/github).
  try {
    return require.resolve(
      path.join(resolvedModulePath, "ruleloom.manifest.yaml"),
    );
  } catch (error) {
    // ignore
  }

  try {
    return require.resolve("ruleloom.manifest.yaml", {
      paths: [resolvedModulePath],
    });
  } catch (error) {
    return undefined;
  }
}

function inventoryIdForSpec(spec: PluginSpec, modulePath: string): string {
  if (spec.source === "file") return `file:${modulePath}`;
  if (spec.source === "config") return `config:${modulePath}`;
  if (spec.source === "github")
    return `github:${spec.repo}@${spec.ref}${spec.path ? `:${spec.path}` : ""}`;
  if (spec.source === "npm")
    return `npm:${spec.name}${spec.version ? `@${spec.version}` : ""}`;
  return `store:${spec.name}${spec.version ? `@${spec.version}` : ""}`;
}

async function recordLoadedPlugin(
  info: Omit<LoadedPluginInfo, "manifestPath" | "manifestRaw">,
) {
  if (loadedPluginInventory.has(info.id)) return;

  const { manifestPath, manifestRaw } = await readManifestForInventory(
    info.modulePath,
  );
  loadedPluginInventory.set(info.id, {
    ...info,
    manifestPath,
    manifestRaw,
  });
}

async function readManifestForInventory(
  modulePath: string,
): Promise<{ manifestPath?: string; manifestRaw?: string }> {
  const manifestPath = await locateManifest(modulePath);
  if (!manifestPath) return {};
  const exists = await fs
    .stat(manifestPath)
    .then((s) => s.isFile())
    .catch(() => false);
  if (!exists) return {};
  const manifestRaw = await fs
    .readFile(manifestPath, "utf8")
    .catch(() => undefined);
  return { manifestPath, manifestRaw };
}

async function downloadGithubRepo(
  spec: Extract<PluginSpec, { source: "github" }>,
  targetDir: string,
  options: ResolveOptions,
) {
  await fs.mkdir(targetDir, { recursive: true });
  const tarballUrl = `https://codeload.github.com/${spec.repo}/tar.gz/${spec.ref}`;
  const tarFile = path.join(targetDir, "plugin.tgz");

  options.logger.info?.(`Downloading GitHub plugin ${spec.repo}@${spec.ref}`);
  await new Promise<void>((resolve, reject) => {
    const file = createWriteStream(tarFile);
    https
      .get(tarballUrl, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(
            new Error(`Failed to download plugin tarball: ${res.statusCode}`),
          );
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
      })
      .on("error", (err) => reject(err));
  });

  if (spec.integrity) {
    const hash = createHash("sha256");
    const data = await fs.readFile(tarFile);
    hash.update(data);
    const digest = `sha256-${hash.digest("hex")}`;
    if (digest !== spec.integrity) {
      throw new Error(
        `Integrity mismatch for ${spec.repo}@${spec.ref}. Expected ${spec.integrity} got ${digest}`,
      );
    }
  }

  // Extract tarball (requires system tar).
  await execFileAsync("tar", [
    "-xzf",
    tarFile,
    "--strip-components=1",
    "-C",
    targetDir,
  ]);

  await runGithubPluginSetup(spec, targetDir, options.logger);
}

function isPinnedCommit(ref: string) {
  return /^[0-9a-f]{40}$/i.test(ref);
}

interface GithubCacheMeta {
  repo: string;
  ref: string;
  commit?: string;
  fetchedAt?: string;
}

async function readGithubCacheMeta(
  targetDir: string,
): Promise<GithubCacheMeta | undefined> {
  const metaPath = path.join(targetDir, GITHUB_CACHE_META);
  const raw = await fs.readFile(metaPath, "utf8").catch(() => undefined);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as GithubCacheMeta;
  } catch {
    // ignore invalid cache metadata
  }
  return undefined;
}

async function writeGithubCacheMeta(targetDir: string, meta: GithubCacheMeta) {
  const metaPath = path.join(targetDir, GITHUB_CACHE_META);
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
}

async function planGithubUpdate(
  spec: Extract<PluginSpec, { source: "github" }>,
  targetDir: string,
  cacheExists: boolean,
  options: ResolveOptions,
): Promise<{ shouldDownload: boolean; latestCommit?: string }> {
  if (!cacheExists) {
    return { shouldDownload: true };
  }

  if (isPinnedCommit(spec.ref)) {
    return { shouldDownload: false, latestCommit: spec.ref };
  }

  const latestCommit = await fetchGithubCommitSha(
    spec.repo,
    spec.ref,
    options.logger,
  );
  if (!latestCommit) {
    options.logger.warn?.(
      `Unable to validate latest commit for ${spec.repo}@${spec.ref}; using cached plugin.`,
    );
    return { shouldDownload: false };
  }

  const cached = await readGithubCacheMeta(targetDir);
  if (cached?.commit && cached.commit === latestCommit) {
    return { shouldDownload: false, latestCommit };
  }

  return { shouldDownload: true, latestCommit };
}

async function fetchGithubCommitSha(
  repo: string,
  ref: string,
  logger: RuleLoomLogger,
): Promise<string | undefined> {
  const url = `https://api.github.com/repos/${repo}/commits/${encodeURIComponent(ref)}`;
  try {
    const raw = await httpGetJson(url, {
      "User-Agent": "rule-loom-runner",
      Accept: "application/vnd.github+json",
    });
    if (raw && typeof raw.sha === "string") {
      return raw.sha;
    }
  } catch (error) {
    logger.debug?.(
      `Failed to fetch latest commit for ${repo}@${ref}: ${(error as Error).message}`,
    );
  }
  return undefined;
}

function httpGetJson(
  url: string,
  headers: Record<string, string>,
): Promise<any> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          try {
            const raw = Buffer.concat(chunks).toString("utf8");
            resolve(JSON.parse(raw));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

async function installGithubPluginDeps(
  targetDir: string,
  logger: RuleLoomLogger,
) {
  const pkgJsonPath = path.join(targetDir, "package.json");
  const hasPackageJson = await fs
    .stat(pkgJsonPath)
    .then((s) => s.isFile())
    .catch(() => false);
  if (!hasPackageJson) return;

  logger.info?.(`Installing npm dependencies for plugin at ${targetDir}`);
  await execFileAsync(
    "npm",
    ["install", "--omit=dev", "--no-fund", "--no-audit"],
    { cwd: targetDir, env: process.env },
  );
  logger.info?.(
    `Finished installing npm dependencies for plugin at ${targetDir}`,
  );
}

async function runGithubPluginSetup(
  spec: Extract<PluginSpec, { source: "github" }>,
  targetDir: string,
  logger: RuleLoomLogger,
) {
  const commands = normalizeGithubBuildCommands(spec);
  if (!commands.length) {
    await installGithubPluginDeps(targetDir, logger);
    return;
  }

  logger.info?.(`Running build commands for GitHub plugin at ${targetDir}`);
  for (const command of commands) {
    logger.info?.(`Running plugin command: ${command}`);
    await execFileAsync(command, [], {
      cwd: targetDir,
      env: process.env,
      shell: true,
    });
  }
  logger.info?.(`Finished build commands for GitHub plugin at ${targetDir}`);
}

function normalizeGithubBuildCommands(
  spec: Extract<PluginSpec, { source: "github" }>,
): string[] {
  if (!spec.build) return [];
  if (typeof spec.build === "string") return [spec.build];
  return spec.build;
}
