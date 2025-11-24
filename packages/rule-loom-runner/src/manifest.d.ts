import { type ClosureSignature } from 'rule-loom-engine';
export interface RuleLoomManifestClosure {
    name: string;
    description?: string;
    signature?: ClosureSignature;
}
export interface RuleLoomManifestInputPlugin {
    type: string;
    description?: string;
}
export interface RuleLoomManifest {
    version: 1;
    name: string;
    pluginVersion?: string;
    description?: string;
    entry: string;
    closures: RuleLoomManifestClosure[];
    inputs?: RuleLoomManifestInputPlugin[];
    metadata?: Record<string, unknown>;
}
interface GenerateOptions {
    pluginDir: string;
    outputPath?: string;
}
export declare function generateManifest(options: GenerateOptions): Promise<{
    manifest: RuleLoomManifest;
    manifestPath: string;
}>;
export declare function readManifest(manifestPath: string): Promise<RuleLoomManifest>;
export {};
//# sourceMappingURL=manifest.d.ts.map