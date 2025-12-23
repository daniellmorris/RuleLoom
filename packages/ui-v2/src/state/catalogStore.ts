import { create } from "zustand";
import yaml from "js-yaml";
import type { RepoManifest } from "../utils/pluginRepos";

type Manifest = { closures?: any[]; inputs?: any[] };
type SourceTag = string;

export type RepoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; manifest: RepoManifest };

interface CatalogState {
  closures: any[];
  inputs: any[];
  closuresMeta: Record<string, any>;
  inputsMeta: Record<string, any>;
  closureSources: Record<string, SourceTag>;
  inputSources: Record<string, SourceTag>;
  availableClosures: string[];
  availableInputs: string[];
  repos: string[];
  repoStates: Record<string, RepoState>;
  selectedPlugins: Record<string, string[]>; // repoUrl -> plugin ids
  setRepos: (repos: string[]) => void;
  setRepoState: (url: string, state: RepoState) => void;
  removeRepo: (url: string) => void;
  setSelectedPlugins: (repoUrl: string, ids: string[]) => void;
  setCatalog: (closures: any[], inputs: any[]) => void;
  addManifest: (manifestRaw: string, source?: SourceTag) => void;
  removeSources: (sources: SourceTag[]) => void;
}

function parseManifest(raw: string): Manifest {
  try {
    return (yaml.load(raw) as Manifest) ?? { closures: [], inputs: [] };
  } catch (err) {
    console.error("Failed to parse manifest", err);
    return { closures: [], inputs: [] };
  }
}

const initialClosures: any[] = [];
const initialInputs: any[] = [];

export const useCatalogStore = create<CatalogState>((set) => ({
  closures: initialClosures,
  inputs: initialInputs,
  closuresMeta: {},
  inputsMeta: {},
  closureSources: {},
  inputSources: {},
  availableClosures: [],
  availableInputs: [],
  repos: [],
  repoStates: {},
  selectedPlugins: {},
  setRepos: (repos) => set((state) => ({ ...state, repos })),
  setRepoState: (url, stateVal) =>
    set((state) => ({
      ...state,
      repoStates: { ...state.repoStates, [url]: stateVal }
    })),
  removeRepo: (url) =>
    set((state) => {
      const { [url]: _ignored, ...rest } = state.repoStates;
      const repos = state.repos.filter((r) => r !== url);
      const { [url]: _selIgnored, ...restSel } = state.selectedPlugins;
      return { ...state, repoStates: rest, repos, selectedPlugins: restSel };
    }),
  setSelectedPlugins: (repoUrl, ids) =>
    set((state) => ({
      ...state,
      selectedPlugins: { ...state.selectedPlugins, [repoUrl]: ids },
    })),
  setCatalog: (closures, inputs) =>
    set((state) => ({
      repos: state.repos,
      repoStates: state.repoStates,
      selectedPlugins: state.selectedPlugins,
      closures,
      inputs,
      closuresMeta: Object.fromEntries(closures.map((c: any) => [c.name, c])),
      inputsMeta: Object.fromEntries(inputs.map((i: any) => [i.type, i])),
      closureSources: Object.fromEntries(
        closures.map((c: any) => [c.name, state.closureSources[c.name] ?? "unknown"])
      ),
      inputSources: Object.fromEntries(
        inputs.map((i: any) => [i.type, state.inputSources[i.type] ?? "unknown"])
      ),
      availableClosures: closures.map((c: any) => c.name).filter(Boolean),
      availableInputs: inputs.map((i: any) => i.type).filter(Boolean),
      removeSources: state.removeSources,
      addManifest: state.addManifest,
      setCatalog: state.setCatalog,
      setRepos: state.setRepos,
      setRepoState: state.setRepoState,
      removeRepo: state.removeRepo,
      setSelectedPlugins: state.setSelectedPlugins
    })),
  addManifest: (manifestRaw: string, source?: SourceTag) =>
    set((state) => {
      const manifest = parseManifest(manifestRaw);
      const nextClosures = [...state.closures, ...(manifest.closures ?? [])];
      const nextInputs = [...state.inputs, ...(manifest.inputs ?? [])];
      const mergedClosures = mergeByKeyPreferLast(nextClosures, (c: any) => c.name);
      const mergedInputs = mergeByKeyPreferLast(nextInputs, (i: any) => i.type);
      const closureSources = { ...state.closureSources };
      const inputSources = { ...state.inputSources };
      if (source) {
        (manifest.closures ?? []).forEach((c: any) => {
          if (c?.name) closureSources[c.name] = source;
        });
        (manifest.inputs ?? []).forEach((i: any) => {
          if (i?.type) inputSources[i.type] = source;
        });
      }
      return {
        repos: state.repos,
        repoStates: state.repoStates,
        closures: mergedClosures,
        inputs: mergedInputs,
        closuresMeta: Object.fromEntries(mergedClosures.map((c: any) => [c.name, c])),
        inputsMeta: Object.fromEntries(mergedInputs.map((i: any) => [i.type, i])),
        closureSources,
        inputSources,
        availableClosures: mergedClosures.map((c: any) => c.name).filter(Boolean),
        availableInputs: mergedInputs.map((i: any) => i.type).filter(Boolean),
        setRepos: state.setRepos,
        setRepoState: state.setRepoState,
        removeRepo: state.removeRepo,
        setCatalog: state.setCatalog,
        addManifest: state.addManifest,
        removeSources: state.removeSources,
        selectedPlugins: state.selectedPlugins,
        setSelectedPlugins: state.setSelectedPlugins
      } satisfies CatalogState;
    }),
  removeSources: (sources: SourceTag[]) =>
    set((state) => {
      const sourceSet = new Set(sources);
      const closures = state.closures.filter((c: any) => !sourceSet.has(state.closureSources[c.name]));
      const inputs = state.inputs.filter((i: any) => !sourceSet.has(state.inputSources[i.type]));
      return {
        repos: state.repos,
        repoStates: state.repoStates,
        closures,
        inputs,
        closuresMeta: Object.fromEntries(closures.map((c: any) => [c.name, c])),
        inputsMeta: Object.fromEntries(inputs.map((i: any) => [i.type, i])),
        closureSources: Object.fromEntries(
          Object.entries(state.closureSources).filter(([, src]) => !sourceSet.has(src))
        ),
        inputSources: Object.fromEntries(
          Object.entries(state.inputSources).filter(([, src]) => !sourceSet.has(src))
        ),
        availableClosures: closures.map((c: any) => c.name).filter(Boolean),
        availableInputs: inputs.map((i: any) => i.type).filter(Boolean),
        setRepos: state.setRepos,
        setRepoState: state.setRepoState,
        removeRepo: state.removeRepo,
        setCatalog: state.setCatalog,
        addManifest: state.addManifest,
        removeSources: state.removeSources,
        selectedPlugins: state.selectedPlugins,
        setSelectedPlugins: state.setSelectedPlugins
      } satisfies CatalogState;
    })
}));

function mergeByKeyPreferLast<T>(items: T[], key: (t: T) => string | undefined): T[] {
  const map = new Map<string, T>();
  items.forEach((item) => {
    const k = key(item);
    if (!k) return;
    map.set(k, item);
  });
  return Array.from(map.values());
}
