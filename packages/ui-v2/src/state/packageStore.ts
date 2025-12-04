import { create } from "zustand";
import { Flow } from "../types";
import coreManifest from "../data/coreManifest.json";
import { importFlowFromYaml, exportFlowToYaml } from "../utils/yaml";
import { useFlowStore } from "./flowStore";
import yaml from "js-yaml";
import { nanoid } from "../utils/id";

export interface PackageState {
  name: string;
  catalogClosures: any[]; // core + custom (for palette/catalog)
  catalogInputs: any[];
  customClosures: any[]; // user/package-defined only
  customInputs: any[];
  importPackage: (yamlText: string) => void;
  exportPackage: () => string;
}

export const usePackageStore = create<PackageState>((set, get) => ({
  name: "Untitled package",
  catalogClosures: (coreManifest as any).closures ?? [],
  catalogInputs: (coreManifest as any).inputs ?? [],
  customClosures: [],
  customInputs: [],
  importPackage: (yamlText: string) => {
    const pkg = importPackageYaml(yamlText);
    const version = pkg.version ?? 1;
    const flowStore = useFlowStore.getState();
    const mergedClosures = mergeUniqueByName((coreManifest as any).closures ?? [], pkg.closures ?? []);
    const mergedInputs = mergeUniqueByType((coreManifest as any).inputs ?? [], pkg.inputs ?? []);
    flowStore.setCatalog(mergedClosures, mergedInputs);
    flowStore.setFlows(pkg.flows ?? []);
    const closureFlows =
      pkg.closures?.map((c: any) => {
        const text = yaml.dump({
          version,
          inputs: pkg?.inputs ?? [],
          flows: [
            {
              name: c.name,
              steps: c.steps ?? []
            }
          ]
        });
        const imported = importFlowFromYaml(text, pkg.inputs, true);
        return {
          ...imported,
          id: nanoid(),
          name: c.name,
          kind: "closure" as const
        };
      }) ?? [];
    flowStore.setClosures(closureFlows);
    set({
      name: pkg.name ?? "Imported package",
      catalogClosures: mergedClosures,
      catalogInputs: mergedInputs,
      customClosures: pkg.closures ?? [],
      customInputs: pkg.inputs ?? []
    });
  },
  exportPackage: () => {
    const { customClosures } = get();
    const flowStore = useFlowStore.getState();
    const flows = flowStore.flows;
    const closuresFlows = flowStore.closures;

    const serializeFlowOnly = (f: any) => {
      const parsed = yaml.load(exportFlowToYaml(f)) as any;
      return parsed?.flows?.[0] ?? {};
    };

    // derive current inputs from flow graphs (unique by type/label)
    // Prefer preserved inputs from imported flows; otherwise empty (UI doesn't model triggers yet)
    const derivedInputs: any[] = [];
    flows.forEach((f: any) => {
      if (Array.isArray(f._inputs)) {
        f._inputs.forEach((inp: any) => {
          if (!derivedInputs.find((i) => JSON.stringify(i) === JSON.stringify(inp))) {
            derivedInputs.push(inp);
          }
        });
      }
    });

    const serializedFlows = flows.map(serializeFlowOnly);

    const serializedClosures =
      closuresFlows.map((cf) => {
        const flow = serializeFlowOnly(cf);
        return { type: "flow", name: cf.name, steps: flow.steps ?? [] };
      }) ?? customClosures;

    const pkg = {
      version: 1,
      inputs: derivedInputs,
      closures: serializedClosures,
      flows: serializedFlows
    };
    return pkgToYaml(pkg);
  }
}));

function importPackageYaml(text: string): { name?: string; inputs?: any[]; closures?: any[]; flows: Flow[]; version?: number } {
  const pkg = yaml.load(text) as any;
  const flows = (pkg?.flows ?? []).map((f: any) =>
    importFlowFromYaml(
      yaml.dump({
        version: pkg?.version ?? 1,
        inputs: pkg?.inputs ?? [],
        flows: [f]
      }),
      pkg.inputs
    )
  );
  return { name: pkg?.name, inputs: pkg?.inputs, closures: pkg?.closures, flows, version: pkg?.version };
}

function pkgToYaml(pkg: any): string {
  return yaml.dump(pkg, { lineWidth: 120 });
}

function mergeUniqueByName(base: any[], extra: any[]) {
  const map = new Map<string, any>();
  [...base, ...extra].forEach((c) => {
    if (!c?.name) return;
    map.set(c.name, c);
  });
  return Array.from(map.values());
}

function mergeUniqueByType(base: any[], extra: any[]) {
  const map = new Map<string, any>();
  [...base, ...extra].forEach((i) => {
    if (!i?.type) return;
    map.set(i.type, i);
  });
  return Array.from(map.values());
}
