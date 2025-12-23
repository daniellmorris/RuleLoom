import type { ComponentType } from 'react';
import Canvas from '../components/Canvas';
import ImportExport from '../components/ImportExport';
import Inspector from '../components/Inspector';
import Palette from '../components/Palette';
import PluginLibrary from '../components/PluginLibrary';
import ShellHeader from '../components/ShellHeader';
import DashboardEditor from '../components/PuckLayoutEditor';
import type { UiPluginBlockDescriptor, UiPluginManifest } from '../types/uiPlugin';

export interface RegisteredBlock {
  name: string;
  type?: string;
  pluginId?: string;
  component: ComponentType<any>;
  spec?: UiPluginBlockDescriptor['spec'];
}

export interface ComponentRegistry {
  registerBlock: (block: RegisteredBlock) => void;
  registerPluginBlocks: (plugin: UiPluginManifest, modules: Record<string, any>) => void;
  resolve: (name: string) => RegisteredBlock | undefined;
  entries: () => RegisteredBlock[];
}

const coreBlocks: RegisteredBlock[] = [
  { name: 'ShellHeader', type: 'header', pluginId: 'core', component: ShellHeader },
  { name: 'DashboardEditor', type: 'canvas', pluginId: 'core', component: DashboardEditor },
  { name: 'Palette', type: 'sidebar', pluginId: 'core', component: Palette },
  { name: 'PluginLibrary', type: 'sidebar', pluginId: 'core', component: PluginLibrary },
  { name: 'ImportExport', type: 'sidebar', pluginId: 'core', component: ImportExport },
  { name: 'Canvas', type: 'canvas', pluginId: 'core', component: Canvas },
  { name: 'Inspector', type: 'inspector', pluginId: 'core', component: Inspector }
];

export function createComponentRegistry(): ComponentRegistry {
  const registry = new Map<string, RegisteredBlock>();

  const registerBlock = (block: RegisteredBlock) => {
    registry.set(block.name, block);
  };

  const registerPluginBlocks = (plugin: UiPluginManifest, modules: Record<string, any>) => {
    for (const block of plugin.blocks ?? []) {
      const moduleExport = modules[block.module];
      if (!moduleExport) {
        console.error(`Plugin ${plugin.id} missing module export for ${block.module}`);
        continue;
      }
      const exportName = block.spec?.export ?? 'default';
      const component = moduleExport?.[exportName];
      if (!component || typeof component !== 'function') {
        console.error(`Plugin ${plugin.id} module ${block.module} missing export ${exportName}`);
        continue;
      }
      registerBlock({ name: block.name, type: block.type, component, pluginId: plugin.id, spec: block.spec });
    }
  };

  coreBlocks.forEach((b) => registerBlock(b));

  return {
    registerBlock,
    registerPluginBlocks,
    resolve: (name) => registry.get(name),
    entries: () => Array.from(registry.values())
  } satisfies ComponentRegistry;
}
