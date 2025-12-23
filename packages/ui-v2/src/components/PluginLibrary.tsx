import React, { useEffect, useMemo, useState, useRef } from "react";
import { useCatalogStore, type RepoState } from "../state/catalogStore";
import { parseRepoManifest, type RepoManifest } from "../utils/pluginRepos";
import { useAppStore } from "../state/appStore";

// Default to hosted core catalog (not a local file path) so the UI works in browser deployments.
const CORE_REPO_URL =
  "https://raw.githubusercontent.com/daniellmorris/RuleLoom/main/ruleloom.plugins.yaml";

type RuntimePlugin = {
  id: string;
  name?: string;
  version?: string;
  source?: string;
  manifestRaw?: string;
};

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function deriveGithubSpec(manifestUrl: string, name?: string) {
  try {
    const u = new URL(manifestUrl);
    if (u.hostname !== "raw.githubusercontent.com") return null;
    const parts = u.pathname.split("/").filter(Boolean); // owner/repo/ref/...
    if (parts.length < 3) return null;
    const [owner, repo, ref, ...rest] = parts;
    const pathParts = rest.slice(0, rest.length - 1); // drop ruleloom.manifest.yaml
    const path = pathParts.join("/") || undefined;
    return { source: "github", repo: `${owner}/${repo}`, ref, path, name };
  } catch {
    return null;
  }
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
  const removeSources = useCatalogStore((s) => s.removeSources);
  const repos = useCatalogStore((s) => s.repos);
  const repoStates = useCatalogStore((s) => s.repoStates);
  const setRepos = useCatalogStore((s) => s.setRepos);
  const setRepoState = useCatalogStore((s) => s.setRepoState);
  const removeRepoInStore = useCatalogStore((s) => s.removeRepo);
  const selectedPlugins = useCatalogStore((s) => s.selectedPlugins);
  const setSelectedPlugins = useCatalogStore((s) => s.setSelectedPlugins);
  const addPlugin = useAppStore((s) => s.addPlugin);
  const setPlugins = useAppStore((s) => s.setPlugins);
  const appPlugins = useAppStore((s) => s.app.plugins);
  const [openRepo, setOpenRepo] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (!openRepo) return;
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) return;
      setOpenRepo(null);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [openRepo]);
  const [repoUrl, setRepoUrl] = useState("");

  useEffect(() => {
    if (!repos.includes(CORE_REPO_URL)) {
      setRepos([CORE_REPO_URL, ...repos]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos]);

  const handleSelectPlugins = async (
    repoUrlSel: string,
    manifest: RepoManifest,
    selectedIds: Set<string>,
  ) => {
    const prefix = `repo:${repoId(repoUrlSel, manifest)}/`;
    const selectedEntries = (manifest.plugins ?? []).filter((p) =>
      selectedIds.has(p.id),
    );

    const prevSelected = new Set<string>(selectedPlugins[repoUrlSel] ?? []);
    const removedSources = [...prevSelected].filter((id) => !selectedIds.has(id)).map((id) => `${prefix}${id}`);
    setSelectedPlugins(repoUrlSel, Array.from(selectedIds));

    if (removedSources.length) removeSources(removedSources);

    const newOnes = selectedEntries.filter((p) => !prevSelected.has(p.id));
    await Promise.all(
      newOnes.map((p) =>
        loadManifestFromUrl({
          id: p.id,
          name: p.name,
          manifestUrl: p.manifestUrl,
          catalogSource: `${prefix}${p.id}`,
        }),
      ),
    );

    // rebuild app plugins list as github specs from all selected plugin ids
    const allSpecs: any[] = [];
    const selections = { ...selectedPlugins, [repoUrlSel]: Array.from(selectedIds) };
    Object.entries(selections).forEach(([url, ids]) => {
      const idList = Array.isArray(ids) ? (ids as string[]) : [];
      const state = repoStates[url];
      if (state?.status !== "ready") return;
      const manifest = state.manifest;
      const specs = (manifest.plugins ?? [])
        .filter((p) => idList.includes(p.id))
        .map((p) => deriveGithubSpec(p.manifestUrl, p.name))
        .filter(Boolean) as any[];
      allSpecs.push(...specs);
    });
    setPlugins(allSpecs);
  };

  const refreshRepo = async (url: string) => {
    setRepoState(url, { status: "loading" });
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const manifest = parseRepoManifest(text, url);
      setRepoState(url, { status: "ready", manifest });

      // Auto-select core plugin on first load if nothing is active for this repo
      const prefix = `repo:${repoId(url, manifest)}/`;
      const existingIds = new Set(selectedPlugins[url] ?? []);
      if (existingIds.size === 0) {
        const coreEntry = (manifest.plugins ?? []).find((p) => p.id === "core");
        if (coreEntry) {
          const selected = new Set<string>(["core"]);
          await handleSelectPlugins(url, manifest, selected);
        }
      }
    } catch (err: any) {
      setRepoState(url, { status: "error", error: err?.message ?? String(err) });
    }
  };

  const refreshAll = async () => {
    await Promise.all(repos.map((r) => refreshRepo(r)));
  };

  useEffect(() => {
    if (repos.length === 0) return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos]);

  const addRepo = () => {
    const next = repoUrl.trim();
    if (!next) return;
    if (repos.includes(next)) return;
    setRepos([...repos, next]);
    setRepoUrl("");
    refreshRepo(next);
  };

  const removeRepo = (url: string) => {
    if (url === CORE_REPO_URL) return; // core repo is always present
    const manifest =
      repoStates[url]?.status === "ready" ? (repoStates[url] as any).manifest : undefined;
    const prefix = `repo:${repoId(url, manifest)}/`;
    const removedIds = selectedPlugins[url] ?? [];
    if (removedIds.length) {
      removeSources(removedIds.map((id) => `${prefix}${id}`));
    }
    setSelectedPlugins(url, []);
    // rebuild app plugins from remaining selections
    const selections = { ...selectedPlugins };
    delete selections[url];
    const allSpecs: any[] = [];
    Object.entries(selections).forEach(([repoUrl, ids]) => {
      const state = repoStates[repoUrl];
      if (state?.status !== "ready") return;
      const specs = (state.manifest.plugins ?? [])
        .filter((p) => ids.includes(p.id))
        .map((p) => deriveGithubSpec(p.manifestUrl, p.name))
        .filter(Boolean) as any[];
      allSpecs.push(...specs);
    });
    setPlugins(allSpecs);
    removeRepoInStore(url);
  };

  const loadManifestFromUrl = async (plugin: {
    id: string;
    name?: string;
    manifestUrl: string;
    catalogSource: string;
  }) => {
    const res = await fetch(plugin.manifestUrl);
    if (!res.ok)
      throw new Error(`Failed to fetch manifest: HTTP ${res.status}`);
    const text = await res.text();
    addManifest(text, plugin.catalogSource);
  };

  const repoList = useMemo(() => {
    return repos.map((url) => ({
      url,
      state: repoStates[url] ?? { status: "idle" as const },
    }));
  }, [repos, repoStates]);

  return (
    <div className="panel stack">
      <div
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <h3 style={{ margin: 0 }}>Plugins</h3>
        <button
          className="button tertiary"
          onClick={refreshAll}
          title="Refresh all repositories"
        >
          Refresh repos
        </button>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          Repositories (`ruleloom.plugins.yaml` / `.json`)
        </div>
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
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            No repositories configured.
          </div>
        )}

        {repoList.map(({ url, state }) => (
          <div
            key={url}
            className="stack"
            style={{
              gap: 6,
              border: "1px solid var(--border)",
              padding: 8,
              borderRadius: 8,
            }}
          >
            <div
              className="row"
              style={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <div className="stack" style={{ gap: 2 }}>
                <div style={{ fontSize: 12 }}>{url}</div>
                {state.status === "ready" && (
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {(state.manifest.repoName ?? "Repo") +
                      (state.manifest.repoDescription
                        ? ` — ${state.manifest.repoDescription}`
                        : "")}
                  </div>
                )}
                {state.status === "error" && (
                  <div style={{ fontSize: 12, color: "var(--danger)" }}>
                    {state.error}
                  </div>
                )}
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button
                  className="button tertiary"
                  onClick={() => refreshRepo(url)}
                  disabled={state.status === "loading"}
                >
                  Refresh
                </button>
                <button
                  className="button tertiary"
                  onClick={() => removeRepo(url)}
                >
                  Remove
                </button>
              </div>
            </div>

            {state.status === "loading" && (
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Loading…
              </div>
            )}

            {state.status === "ready" && (
              <div className="stack" style={{ gap: 6 }}>
                <div className="stack" style={{ gap: 4 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    Select plugins to include
                  </div>
                  <div style={{ position: "relative" }}>
                    <button
                      className="button secondary"
                      onClick={() =>
                        setOpenRepo((curr) => (curr === url ? null : url))
                      }
                    >
                      {(selectedPlugins[url]?.length ?? 0) || "Choose"}{" "}
                      selected ▾
                    </button>
                    {openRepo === url && (
                      <div
                        ref={dropdownRef}
                        style={{
                          position: "absolute",
                          zIndex: 10,
                          marginTop: 6,
                          minWidth: 260,
                          background: "var(--panel, rgba(16,17,26,0.96))",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
                          padding: 8,
                          maxHeight: 220,
                          overflow: "auto",
                        }}
                      >
                        {(state.manifest.plugins ?? []).map((p) => {
                          const prefix = `repo:${repoId(url, state.manifest)}/`;
                          const checked = (selectedPlugins[url] ?? []).includes(p.id);
                          return (
                            <label
                              key={p.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 12,
                                padding: "4px 2px",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={async (e) => {
                                  const currentSelected = new Set(selectedPlugins[url] ?? []);
                                  if (e.target.checked) currentSelected.add(p.id);
                                  else currentSelected.delete(p.id);
                                  await handleSelectPlugins(
                                    url,
                                    state.manifest,
                                    currentSelected,
                                  );
                                }}
                              />
                              <span>{p.name ?? p.id}</span>
                              <span className="badge">{p.id}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
};

export default PluginLibrary;
