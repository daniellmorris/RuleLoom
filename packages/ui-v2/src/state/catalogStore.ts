import { create } from "zustand";
import yaml from "js-yaml";
import coreManifestRaw from "rule-loom-core/ruleloom.manifest.yaml?raw";

type Manifest = { closures?: any[]; inputs?: any[] };
type SourceTag = string;

interface CatalogState {
  closures: any[];
  inputs: any[];
  closuresMeta: Record<string, any>;
  inputsMeta: Record<string, any>;
  closureSources: Record<string, SourceTag>;
  inputSources: Record<string, SourceTag>;
  availableClosures: string[];
  availableInputs: string[];
  setCatalog: (closures: any[], inputs: any[]) => void;
  addManifest: (manifestRaw: string, source?: SourceTag) => void;
}

function parseManifest(raw: string): Manifest {
  try {
    return (yaml.load(raw) as Manifest) ?? { closures: [], inputs: [] };
  } catch (err) {
    console.error("Failed to parse manifest", err);
    return { closures: [], inputs: [] };
  }
}

const coreManifest = parseManifest(coreManifestRaw as string);

const initialClosures = Array.isArray(coreManifest?.closures) ? coreManifest.closures : [];
const initialInputs = Array.isArray(coreManifest?.inputs) ? coreManifest.inputs : [];

export const useCatalogStore = create<CatalogState>((set) => ({
  closures: initialClosures,
  inputs: initialInputs,
  closuresMeta: Object.fromEntries(initialClosures.map((c: any) => [c.name, c])),
  inputsMeta: Object.fromEntries(initialInputs.map((i: any) => [i.type, i])),
  closureSources: Object.fromEntries(initialClosures.map((c: any) => [c.name, "core"])),
  inputSources: Object.fromEntries(initialInputs.map((i: any) => [i.type, "core"])),
  availableClosures: initialClosures.map((c: any) => c.name).filter(Boolean),
  availableInputs: initialInputs.map((i: any) => i.type).filter(Boolean),
  setCatalog: (closures, inputs) =>
    set((state) => ({
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
      availableInputs: inputs.map((i: any) => i.type).filter(Boolean)
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
        closures: mergedClosures,
        inputs: mergedInputs,
        closuresMeta: Object.fromEntries(mergedClosures.map((c: any) => [c.name, c])),
        inputsMeta: Object.fromEntries(mergedInputs.map((i: any) => [i.type, i])),
        closureSources,
        inputSources,
        availableClosures: mergedClosures.map((c: any) => c.name).filter(Boolean),
        availableInputs: mergedInputs.map((i: any) => i.type).filter(Boolean),
        setCatalog: state.setCatalog,
        addManifest: state.addManifest
      } satisfies CatalogState;
    }),
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
