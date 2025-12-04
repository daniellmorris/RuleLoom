import { create } from "zustand";
import coreManifest from "../data/coreManifest.json";

interface CatalogState {
  closures: any[];
  inputs: any[];
  closuresMeta: Record<string, any>;
  inputsMeta: Record<string, any>;
  availableClosures: string[];
  availableInputs: string[];
  setCatalog: (closures: any[], inputs: any[]) => void;
}

const initialClosures = Array.isArray((coreManifest as any)?.closures) ? (coreManifest as any).closures : [];
const initialInputs = Array.isArray((coreManifest as any)?.inputs) ? (coreManifest as any).inputs : [];

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
}));
