import React, { createContext, useContext } from 'react';
import type { AppState, FlowWithMeta } from './appStore';
import { useAppStore } from './appStore';
import { useCatalogStore } from './catalogStore';
import { useFlowStore } from './flowStore';

export interface PluginSelectors {
  useAppState: () => AppState;
  useFlows: () => FlowWithMeta[];
  useClosures: () => FlowWithMeta[];
  useCatalog: () => {
    availableClosures: string[];
    availableInputs: string[];
    closureSources: Record<string, string>;
    inputSources: Record<string, string>;
    closuresMeta: Record<string, any>;
    inputsMeta: Record<string, any>;
  };
  useSelection: () => {
    mode: 'flow' | 'closure';
    flowIndex: number;
    closureIndex: number;
    selectedNodeId: string | null;
  };
}

export interface PluginActions {
  addFlow: (name?: string) => void;
  addClosure: (name?: string) => void;
  renameFlow: (idx: number, name: string) => void;
  renameClosure: (idx: number, name: string) => void;
  removeFlow: (idx: number) => void;
  removeClosure: (idx: number) => void;
  setActiveFlow: (idx: number) => void;
  setActiveClosure: (idx: number) => void;
  setActiveMode: (mode: 'flow' | 'closure') => void;
  selectNode: (nodeId: string | null) => void;
  addTrigger: (type: string, flowName: string) => void;
  addClosureStep: (collection: 'flows' | 'closures', idx: number, closureName: string) => void;
  updateStepParam: (flowName: string, nodeId: string, key: string, value: any) => void;
  updateNodeUi: (flowName: string, nodeId: string, ui: any) => void;
  importYaml: (text: string) => void;
  exportYaml: () => string;
}

export interface PluginApi {
  selectors: PluginSelectors;
  actions: PluginActions;
}

const PluginApiContext = createContext<PluginApi | null>(null);

export const PluginApiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const selectors: PluginSelectors = {
    useAppState: () => useAppStore((s) => s.app),
    useFlows: () => useAppStore((s) => s.app.flows),
    useClosures: () => useAppStore((s) => s.app.closures),
    useCatalog: () =>
      useCatalogStore((s) => ({
        availableClosures: s.availableClosures,
        availableInputs: s.availableInputs,
        closureSources: s.closureSources,
        inputSources: s.inputSources,
        closuresMeta: s.closuresMeta,
        inputsMeta: s.inputsMeta,
      })),
    useSelection: () =>
      useFlowStore((s) => ({
        mode: s.activeMode,
        flowIndex: s.activeFlowId,
        closureIndex: s.activeClosureId,
        selectedNodeId: s.selection.nodeId,
      })),
  };

  const actions: PluginActions = {
    addFlow: useAppStore.getState().addFlow,
    addClosure: useAppStore.getState().addClosure,
    renameFlow: useAppStore.getState().renameFlow,
    renameClosure: useAppStore.getState().renameClosure,
    removeFlow: useAppStore.getState().removeFlow,
    removeClosure: useAppStore.getState().removeClosure,
    setActiveFlow: useFlowStore.getState().setActiveFlow,
    setActiveClosure: useFlowStore.getState().setActiveClosure,
    setActiveMode: useFlowStore.getState().setActiveMode,
    selectNode: useFlowStore.getState().selectNode,
    addTrigger: useAppStore.getState().addTrigger,
    addClosureStep: useAppStore.getState().addClosureStep,
    updateStepParam: useAppStore.getState().updateStepParam,
    updateNodeUi: useAppStore.getState().updateNodeUi,
    importYaml: useAppStore.getState().loadYaml,
    exportYaml: () => useAppStore.getState().toYaml(),
  };

  return (
    <PluginApiContext.Provider value={{ selectors, actions }}>
      {children}
    </PluginApiContext.Provider>
  );
};

export function usePluginApi(): PluginApi {
  const ctx = useContext(PluginApiContext);
  if (!ctx) throw new Error('PluginApiProvider missing in tree');
  return ctx;
}

(globalThis as any).RuleLoomPluginApi = (globalThis as any).RuleLoomPluginApi ?? { usePluginApi };
