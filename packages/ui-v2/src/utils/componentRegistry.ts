import type { ComponentType } from 'react';
import Canvas from '../components/Canvas';
import ImportExport from '../components/ImportExport';
import Inspector from '../components/Inspector';
import Palette from '../components/Palette';
import PluginLibrary from '../components/PluginLibrary';
import ShellHeader from '../components/ShellHeader';
import DashboardEditor from '../components/PuckLayoutEditor';
import DashboardList from '../components/DashboardList';
import type { UiPluginBlockDescriptor, UiPluginManifest } from '../types/uiPlugin';

export interface RegisteredBlock {
  name: string;
  type?: string;
  pluginId?: string;
  component: ComponentType<any>;
  spec?: UiPluginBlockDescriptor['spec'];
  fields?: Record<string, any>;
}

export interface RegisteredExtension {
  name: string;
  type: 'panel' | 'canvasOverlay' | 'paletteProvider' | 'validator' | 'transformer';
  pluginId?: string;
  value: any;
  spec?: UiPluginBlockDescriptor['spec'];
}

export interface ComponentRegistry {
  registerBlock: (block: RegisteredBlock) => void;
  registerExtension: (extension: RegisteredExtension) => void;
  registerPluginBlocks: (plugin: UiPluginManifest, modules: Record<string, any>) => void;
  resolve: (name: string) => RegisteredBlock | undefined;
  extensions: (type?: RegisteredExtension['type']) => RegisteredExtension[];
  entries: () => RegisteredBlock[];
}

const layoutBlockTypes = new Set(['header', 'canvas', 'sidebar', 'inspector']);
const extensionTypes = new Set(['panel', 'canvasOverlay', 'paletteProvider', 'validator', 'transformer']);

const coreBlocks: RegisteredBlock[] = [
  { name: 'ShellHeader', type: 'header', pluginId: 'core', component: ShellHeader },
  { name: 'DashboardEditor', type: 'canvas', pluginId: 'core', component: DashboardEditor },
  { name: 'Palette', type: 'sidebar', pluginId: 'core', component: Palette },
  { name: 'PluginLibrary', type: 'sidebar', pluginId: 'core', component: PluginLibrary },
  { name: 'ImportExport', type: 'sidebar', pluginId: 'core', component: ImportExport },
  { name: 'Canvas', type: 'canvas', pluginId: 'core', component: Canvas },
  { name: 'Inspector', type: 'inspector', pluginId: 'core', component: Inspector },
  { name: 'DashboardList', type: 'sidebar', pluginId: 'core', component: DashboardList },
];

export function createComponentRegistry(): ComponentRegistry {
  const registry = new Map<string, RegisteredBlock>();
  const extensions: RegisteredExtension[] = [];

  const registerBlock = (block: RegisteredBlock) => {
    registry.set(block.name, block);
  };

  const registerExtension = (extension: RegisteredExtension) => {
    extensions.push(extension);
  };

  const registerPluginBlocks = (plugin: UiPluginManifest, modules: Record<string, any>) => {
    for (const block of plugin.blocks ?? []) {
      if (!layoutBlockTypes.has(block.type) && !extensionTypes.has(block.type)) {
        throw new Error(`Plugin ${plugin.id} requested unknown UI slot "${block.type}".`);
      }
      const moduleExport = modules[block.module];
      if (!moduleExport) {
        console.error(`Plugin ${plugin.id} missing module export for ${block.module}`);
        continue;
      }
      const exportName = block.spec?.export ?? 'default';
      const value = moduleExport?.[exportName];
      if (!value) {
        console.error(`Plugin ${plugin.id} module ${block.module} missing export ${exportName}`);
        continue;
      }
      if (extensionTypes.has(block.type)) {
        registerExtension({
          name: block.name,
          type: block.type as RegisteredExtension['type'],
          value,
          pluginId: plugin.id,
          spec: block.spec,
        });
        continue;
      }
      if (typeof value !== 'function') {
        console.error(`Plugin ${plugin.id} module ${block.module} export ${exportName} is not a component`);
        continue;
      }
      registerBlock({ name: block.name, type: block.type, component: value, pluginId: plugin.id, spec: block.spec });
    }
  };

  coreBlocks.forEach((b) => registerBlock(b));

  return {
    registerBlock,
    registerExtension,
    registerPluginBlocks,
    resolve: (name) => registry.get(name),
    extensions: (type) => {
      const selected = type ? extensions.filter((entry) => entry.type === type) : extensions;
      return [...selected].sort((a, b) => (a.spec?.order ?? 0) - (b.spec?.order ?? 0));
    },
    entries: () => Array.from(registry.values())
  } satisfies ComponentRegistry;
}
