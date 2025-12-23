import type { GitHubPluginSource, NpmPluginSource, UiPluginManifest, UiPluginSource } from '../types/uiPlugin';

export interface LoadedPlugin {
  source: UiPluginSource;
  manifest: UiPluginManifest;
  modules: Record<string, any>;
}

interface LoaderOptions {
  fetchImpl?: typeof fetch;
  rawBaseUrl?: string;
  moduleLoader?: (url: string) => Promise<any>;
}

const DEFAULT_RAW_BASE = 'https://raw.githubusercontent.com';

type Maybe<T> = T | null;

type ManifestResult = {
  manifest: Maybe<UiPluginManifest>;
  error?: string;
};

export async function fetchPluginManifest(source: UiPluginSource, options?: LoaderOptions): Promise<ManifestResult> {
  if (isNpmSource(source)) {
    const manifestSpec = buildNpmModuleSpec(source.package, source.manifest);
    try {
      const manifestModule = await (options?.moduleLoader ?? ((u: string) => import(/* @vite-ignore */ u)))(manifestSpec);
      const parsed = manifestModule?.default ?? manifestModule;
      const manifest = parseManifestObject(parsed, source);
      return { manifest };
    } catch (err: any) {
      const message = err?.message ?? 'Unknown manifest error';
      console.error(`Failed to load UI plugin manifest from ${manifestSpec}:`, err);
      return { manifest: null, error: message };
    }
  }

  const fetcher = options?.fetchImpl ?? fetch;
  const rawBaseUrl = source.baseUrl ?? options?.rawBaseUrl ?? DEFAULT_RAW_BASE;
  const manifestUrl = buildRawUrl(rawBaseUrl, source.repo, source.ref, source.manifest);

  try {
    const res = await fetcher(manifestUrl);
    if (!res.ok) {
      throw new Error(`Received ${res.status} when fetching manifest`);
    }
    const raw = await res.text();
    const manifest = parseManifest(raw, source, manifestUrl);
    return { manifest };
  } catch (err: any) {
    const message = err?.message ?? 'Unknown manifest error';
    console.error(`Failed to load UI plugin manifest from ${manifestUrl}:`, err);
    return { manifest: null, error: message };
  }
}

export async function loadPlugins(sources: UiPluginSource[], options?: LoaderOptions): Promise<{ plugins: LoadedPlugin[]; errors: string[] }> {
  const plugins: LoadedPlugin[] = [];
  const errors: string[] = [];

  for (const source of sources) {
    const manifestResult = await fetchPluginManifest(source, options);
    if (!manifestResult.manifest) {
      const label = isNpmSource(source) ? `${source.package}@npm` : `${source.repo}@${source.ref}`;
      errors.push(manifestResult.error ?? `Manifest load failed for ${label}`);
      continue;
    }

    const modules = await loadPluginModules(source, manifestResult.manifest, options);
    plugins.push({ source, manifest: manifestResult.manifest, modules });
  }

  return { plugins, errors };
}

async function loadPluginModules(source: UiPluginSource, manifest: UiPluginManifest, options?: LoaderOptions): Promise<Record<string, any>> {
  const seenModules = new Map<string, Promise<any>>();
  const rawBaseUrl = source.baseUrl ?? options?.rawBaseUrl ?? DEFAULT_RAW_BASE;

  const importModule = (resolvedPath: string) => {
    if (!seenModules.has(resolvedPath)) {
      const importer = options?.moduleLoader ?? ((u: string) => import(/* @vite-ignore */ u));
      const imported = importer(resolvedPath).catch((err) => {
        console.error(`Failed to import plugin module ${resolvedPath}:`, err);
        return null;
      });
      seenModules.set(resolvedPath, imported);
    }
    return seenModules.get(resolvedPath) as Promise<any>;
  };

  const modules: Record<string, any> = {};
  for (const block of manifest.blocks ?? []) {
    if (!block?.module) continue;
    if (modules[block.module]) continue;
    const modPath = isNpmSource(source)
      ? buildNpmModuleSpec(source.package, block.module, source.moduleBase)
      : buildRawUrl(rawBaseUrl, (source as GitHubPluginSource).repo, (source as GitHubPluginSource).ref, block.module);
    const mod = await importModule(modPath);
    if (mod) modules[block.module] = mod;
  }

  return modules;
}

function parseManifest(raw: string, source: UiPluginSource, manifestUrl: string): UiPluginManifest {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Manifest at ${manifestUrl} is not valid JSON`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Plugin manifest must be an object');
  }

  const blocks = Array.isArray(parsed.blocks)
    ? parsed.blocks
        .map((b: any) => sanitizeBlock(b))
        .filter(Boolean)
    : [];

  if (!parsed.id || typeof parsed.id !== 'string') {
    throw new Error('Plugin manifest requires an id');
  }

  if (!parsed.version || typeof parsed.version !== 'string') {
    throw new Error('Plugin manifest requires a version string');
  }

  return {
    id: parsed.id,
    version: parsed.version,
    blocks,
    config: isRecord(parsed.config) ? parsed.config : undefined,
    source: {
      repo: source.repo,
      ref: source.ref,
      entry: source.manifest
    }
  } satisfies UiPluginManifest;
}

function parseManifestObject(parsed: unknown, source: UiPluginSource): UiPluginManifest {
  if (!isRecord(parsed)) {
    throw new Error('Plugin manifest must be an object');
  }
  const blocks = Array.isArray(parsed.blocks)
    ? parsed.blocks
        .map((b: any) => sanitizeBlock(b))
        .filter(Boolean)
    : [];
  if (!parsed.id || typeof parsed.id !== 'string') {
    throw new Error('Plugin manifest requires an id');
  }
  if (!parsed.version || typeof parsed.version !== 'string') {
    throw new Error('Plugin manifest requires a version string');
  }
  return {
    id: parsed.id,
    version: parsed.version,
    blocks,
    config: isRecord(parsed.config) ? parsed.config : undefined,
    source: isNpmSource(source)
      ? {
          repo: source.package,
          ref: 'npm',
          entry: source.manifest
        }
      : {
          repo: source.repo,
          ref: source.ref,
          entry: source.manifest
        }
  };
}

function sanitizeBlock(raw: any) {
  if (!isRecord(raw)) return null;
  const type = typeof raw.type === 'string' ? raw.type : '';
  const name = typeof raw.name === 'string' ? raw.name : '';
  const module = typeof raw.module === 'string' ? raw.module : '';
  const spec = isRecord(raw.spec)
    ? {
        slot: typeof raw.spec.slot === 'string' ? raw.spec.slot : undefined,
        order: typeof raw.spec.order === 'number' ? raw.spec.order : undefined,
        export: typeof raw.spec.export === 'string' ? raw.spec.export : undefined,
      }
    : undefined;
  if (!type || !name || !module) return null;
  return { type, name, module, spec };
}

function buildRawUrl(base: string, repo: string, ref: string, path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalizedBase = base.replace(/\/$/, '');
  const normalizedPath = path.replace(/^\//, '');
  return `${normalizedBase}/${repo}/${ref}/${normalizedPath}`;
}

function buildNpmModuleSpec(pkg: string, path: string, moduleBase?: string): string {
  const normalizedPath = path.replace(/^\//, '');
  if (moduleBase) {
    return `${pkg}/${moduleBase.replace(/\/$/, '')}/${normalizedPath}`;
  }
  return `${pkg}/${normalizedPath}`;
}

function isNpmSource(source: UiPluginSource): source is NpmPluginSource {
  return (source as NpmPluginSource).kind === 'npm' || !!(source as NpmPluginSource).package;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
