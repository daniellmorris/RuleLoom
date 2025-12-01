import { create } from "zustand";
import { Flow } from "../types";
import coreManifest from "../data/coreManifest.json";
import { importFlowFromYaml, exportFlowToYaml } from "../utils/yaml";
import { useFlowStore } from "./flowStore";
import yaml from "js-yaml";

export interface PackageState {
  name: string;
  closures: any[];
  inputs: any[];
  importPackage: (yamlText: string) => void;
  exportPackage: () => string;
}

export const usePackageStore = create<PackageState>((set, get) => ({
  name: "Untitled package",
  closures: (coreManifest as any).closures ?? [],
  inputs: (coreManifest as any).inputs ?? [],
  importPackage: (yamlText: string) => {
    const pkg = importPackageYaml(yamlText);
    const flowStore = useFlowStore.getState();
    const mergedClosures = mergeUniqueByName((coreManifest as any).closures ?? [], pkg.closures ?? []);
    const mergedInputs = mergeUniqueByType((coreManifest as any).inputs ?? [], pkg.inputs ?? []);
    flowStore.setCatalog(mergedClosures, mergedInputs);
    flowStore.setFlows(pkg.flows ?? []);
    set({
      name: pkg.name ?? "Imported package",
      closures: mergedClosures,
      inputs: mergedInputs
    });
  },
  exportPackage: () => {
    const { closures, inputs } = get();
    const flows = useFlowStore.getState().flows;
    const pkg = {
      version: 1,
      inputs,
      closures,
      flows: flows.map((f) => JSON.parse(exportFlowToYaml(f)))
    };
    return pkgToYaml(pkg);
  }
}));

function importPackageYaml(text: string): { name?: string; inputs?: any[]; closures?: any[]; flows: Flow[] } {
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
  return { name: pkg?.name, inputs: pkg?.inputs, closures: pkg?.closures, flows };
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
