export interface UiPluginBlockSpec {
  slot?: string;
  order?: number;
  export?: string;
}

export interface UiPluginBlockDescriptor {
  type: string;
  name: string;
  module: string;
  spec?: UiPluginBlockSpec;
}

export type UiPluginSource = GitHubPluginSource | NpmPluginSource;

export interface GitHubPluginSource {
  kind?: 'github';
  repo: string;
  ref: string;
  manifest: string;
  baseUrl?: string;
}

export interface NpmPluginSource {
  kind: 'npm';
  package: string;
  manifest: string;
  /**
   * Optional base path inside the package for resolving block modules.
   * If not provided, block.module is resolved relative to the package root.
   */
  moduleBase?: string;
}

export interface UiPluginManifest {
  id: string;
  version: string;
  blocks: UiPluginBlockDescriptor[];
  config?: Record<string, unknown>;
  source?: {
    repo: string;
    ref: string;
    entry?: string;
  };
}
