import yaml from "js-yaml";

export type RepoPluginEntry = {
  id: string;
  name: string;
  description?: string;
  manifestUrl: string;
};

export type RepoManifest = {
  version: number;
  repoName?: string;
  repoDescription?: string;
  plugins: RepoPluginEntry[];
};

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseRepoManifest(raw: string, repoUrl: string): RepoManifest {
  const parsed = parseJsonOrYaml(raw);
  if (!isRecord(parsed)) {
    throw new Error("Repository manifest must be an object");
  }
  const version = Number(parsed.version ?? 1);
  const repo = isRecord(parsed.repo) ? parsed.repo : undefined;
  const pluginsRaw = Array.isArray(parsed.plugins) ? parsed.plugins : [];

  const plugins: RepoPluginEntry[] = pluginsRaw
    .map((p: any) => {
      if (!isRecord(p)) return null;
      const id = typeof p.id === "string" ? p.id : "";
      const name = typeof p.name === "string" ? p.name : id;
      const description = typeof p.description === "string" ? p.description : undefined;
      const manifest = typeof p.manifest === "string" ? p.manifest : "";
      if (!id || !manifest) return null;
      const manifestUrl = new URL(manifest, repoUrl).href;
      return { id, name, description, manifestUrl };
    })
    .filter(Boolean) as RepoPluginEntry[];

  return {
    version,
    repoName: typeof repo?.name === "string" ? repo.name : undefined,
    repoDescription: typeof repo?.description === "string" ? repo.description : undefined,
    plugins,
  };
}

function parseJsonOrYaml(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  return yaml.load(trimmed);
}

