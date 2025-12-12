import { create } from "zustand";
import yaml from "js-yaml";
import coreManifestRaw from "rule-loom-core/ruleloom.manifest.yaml?raw";

type Manifest = { closures?: any[]; inputs?: any[] };

interface CatalogState {
  closures: any[];
  inputs: any[];
  closuresMeta: Record<string, any>;
  inputsMeta: Record<string, any>;
  availableClosures: string[];
  availableInputs: string[];
  setCatalog: (closures: any[], inputs: any[]) => void;
  addManifest: (manifestRaw: string) => void;
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
  availableClosures: initialClosures.map((c: any) => c.name).filter(Boolean),
  availableInputs: initialInputs.map((i: any) => i.type).filter(Boolean),
  setCatalog: (closures, inputs) =>
    set(() => ({
      closures,
      inputs,
      closuresMeta: Object.fromEntries(closures.map((c: any) => [c.name, c])),
      inputsMeta: Object.fromEntries(inputs.map((i: any) => [i.type, i])),
      availableClosures: closures.map((c: any) => c.name).filter(Boolean),
      availableInputs: inputs.map((i: any) => i.type).filter(Boolean)
    })),
  addManifest: (manifestRaw: string) =>
    set((state) => {
      const manifest = parseManifest(manifestRaw);
      const mergedClosures = dedupeByKey([...state.closures, ...(manifest.closures ?? [])], (c: any) => c.name);
      const mergedInputs = dedupeByKey([...state.inputs, ...(manifest.inputs ?? [])], (i: any) => i.type);
      return {
        closures: mergedClosures,
        inputs: mergedInputs,
        closuresMeta: Object.fromEntries(mergedClosures.map((c: any) => [c.name, c])),
        inputsMeta: Object.fromEntries(mergedInputs.map((i: any) => [i.type, i])),
        availableClosures: mergedClosures.map((c: any) => c.name).filter(Boolean),
        availableInputs: mergedInputs.map((i: any) => i.type).filter(Boolean)
      } satisfies CatalogState;
    }),
}));

function dedupeByKey<T>(items: T[], key: (t: T) => string | undefined): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  items.forEach((item) => {
    const k = key(item);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(item);
  });
  return out;
}
