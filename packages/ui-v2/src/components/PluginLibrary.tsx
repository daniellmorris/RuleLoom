import React, { useEffect, useMemo, useState } from "react";
import { useCatalogStore } from "../state/catalogStore";
import { parseRepoManifest, type RepoManifest } from "../utils/pluginRepos";

const STORAGE_REPOS = "ruleloom.pluginRepos";
const STORAGE_RUNTIME = "ruleloom.runtimeUrl";

type RepoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; manifest: RepoManifest };

type RuntimePlugin = {
  id: string;
  name?: string;
  version?: string;
  source?: string;
  manifestRaw?: string;
};

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function repoId(url: string, manifest?: RepoManifest) {
  const explicit = manifest?.repoName?.trim();
  if (explicit) return explicit;
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.replace(/\/+$/, "");
  } catch {
    return url;
  }
}

const PluginLibrary: React.FC = () => {
  const addManifest = useCatalogStore((s) => s.addManifest);
  const [repoUrl, setRepoUrl] = useState("");
  const [repos, setRepos] = useState<string[]>(() => readLocalJson<string[]>(STORAGE_REPOS, []));
  const [repoStates, setRepoStates] = useState<Record<string, RepoState>>({});
  const [runtimeUrl, setRuntimeUrl] = useState(() => readLocalJson<string>(STORAGE_RUNTIME, "http://127.0.0.1:3000"));
  const [runtimePlugins, setRuntimePlugins] = useState<RuntimePlugin[]>([]);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  useEffect(() => {
    writeLocalJson(STORAGE_REPOS, repos);
  }, [repos]);

  useEffect(() => {
    writeLocalJson(STORAGE_RUNTIME, runtimeUrl);
  }, [runtimeUrl]);

  const refreshRepo = async (url: string) => {
    setRepoStates((s) => ({ ...s, [url]: { status: "loading" } }));
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const manifest = parseRepoManifest(text, url);
      setRepoStates((s) => ({ ...s, [url]: { status: "ready", manifest } }));
    } catch (err: any) {
      setRepoStates((s) => ({ ...s, [url]: { status: "error", error: err?.message ?? String(err) } }));
    }
  };

  const refreshAll = async () => {
    await Promise.all(repos.map((r) => refreshRepo(r)));
  };

  useEffect(() => {
    if (repos.length === 0) return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addRepo = () => {
    const next = repoUrl.trim();
    if (!next) return;
    if (repos.includes(next)) return;
    setRepos((r) => [...r, next]);
    setRepoUrl("");
    refreshRepo(next);
  };

  const removeRepo = (url: string) => {
    setRepos((r) => r.filter((x) => x !== url));
    setRepoStates((s) => {
      const { [url]: _ignored, ...rest } = s;
      return rest;
    });
  };

  const loadManifestFromUrl = async (manifestUrl: string, source: string) => {
    const res = await fetch(manifestUrl);
    if (!res.ok) throw new Error(`Failed to fetch manifest: HTTP ${res.status}`);
    const text = await res.text();
    addManifest(text, source);
  };

  const refreshRuntime = async () => {
    setRuntimeError(null);
    try {
      const base = normalizeBaseUrl(runtimeUrl);
      const res = await fetch(`${base}/__ruleloom/plugins`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { plugins?: RuntimePlugin[] };
      const plugins = Array.isArray(json.plugins) ? json.plugins : [];
      setRuntimePlugins(plugins);
      plugins.forEach((p) => {
        if (p?.manifestRaw) {
          addManifest(p.manifestRaw, `runtime:${p.id}`);
        }
      });
    } catch (err: any) {
      setRuntimeError(err?.message ?? String(err));
    }
  };

  const repoList = useMemo(() => {
    return repos.map((url) => ({ url, state: repoStates[url] ?? { status: "idle" as const } }));
  }, [repos, repoStates]);

  return (
    <div className="panel stack">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Plugins</h3>
        <button className="button tertiary" onClick={refreshAll} title="Refresh all repositories">
          Refresh repos
        </button>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>Repositories (`ruleloom.plugins.yaml` / `.json`)</div>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            placeholder="https://raw.githubusercontent.com/org/repo/main/ruleloom.plugins.yaml"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
          />
          <button className="button" onClick={addRepo}>
            Add
          </button>
        </div>

        {repoList.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--muted)" }}>No repositories configured.</div>
        )}

        {repoList.map(({ url, state }) => (
          <div key={url} className="stack" style={{ gap: 6, border: "1px solid var(--border)", padding: 8, borderRadius: 8 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div className="stack" style={{ gap: 2 }}>
                <div style={{ fontSize: 12 }}>{url}</div>
                {state.status === "ready" && (
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {(state.manifest.repoName ?? "Repo") + (state.manifest.repoDescription ? ` — ${state.manifest.repoDescription}` : "")}
                  </div>
                )}
                {state.status === "error" && <div style={{ fontSize: 12, color: "var(--danger)" }}>{state.error}</div>}
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="button tertiary" onClick={() => refreshRepo(url)} disabled={state.status === "loading"}>
                  Refresh
                </button>
                <button className="button tertiary" onClick={() => removeRepo(url)}>
                  Remove
                </button>
              </div>
            </div>

            {state.status === "loading" && <div style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</div>}

            {state.status === "ready" && (
              <div className="stack" style={{ gap: 6 }}>
                {(state.manifest.plugins ?? []).map((p) => {
                  const source = `repo:${repoId(url, state.manifest)}/${p.id}`;
                  return (
                    <div key={p.id} className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                      <div className="stack" style={{ gap: 2 }}>
                        <div>
                          <span style={{ fontSize: 12 }}>{p.name}</span> <span className="badge" title={source}>{p.id}</span>
                        </div>
                        {p.description && <div style={{ fontSize: 12, color: "var(--muted)" }}>{p.description}</div>}
                      </div>
                      <button
                        className="button secondary"
                        onClick={async () => {
                          try {
                            await loadManifestFromUrl(p.manifestUrl, source);
                          } catch (err: any) {
                            // eslint-disable-next-line no-console
                            console.error(err);
                            alert(err?.message ?? String(err));
                          }
                        }}
                        title={p.manifestUrl}
                      >
                        Load
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Runtime plugins (from runner)</div>
          <button className="button tertiary" onClick={refreshRuntime} title="Fetch /__ruleloom/plugins from runner">
            Refresh runtime
          </button>
        </div>
        <input
          className="input"
          placeholder="http://127.0.0.1:3000"
          value={runtimeUrl}
          onChange={(e) => setRuntimeUrl(e.target.value)}
        />
        {runtimeError && <div style={{ fontSize: 12, color: "var(--danger)" }}>{runtimeError}</div>}
        {runtimePlugins.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>No runtime plugins loaded.</div>}
        {runtimePlugins.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            {runtimePlugins.map((p) => (
              <div key={p.id} className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                <div className="stack" style={{ gap: 2 }}>
                  <div style={{ fontSize: 12 }}>
                    {p.name ?? p.id}{" "}
                    <span className="badge" title={`runtime:${p.id}`}>
                      {p.version ? `v${p.version}` : "runtime"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{p.id}</div>
                </div>
                <button
                  className="button secondary"
                  disabled={!p.manifestRaw}
                  onClick={() => {
                    if (!p.manifestRaw) return;
                    addManifest(p.manifestRaw, `runtime:${p.id}`);
                  }}
                  title={p.manifestRaw ? "Load manifest into palette" : "No manifest available"}
                >
                  Load
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PluginLibrary;
