import type { ClosureDefinition } from 'rule-loom-engine';
export interface HttpClosureOptions {
    name?: string;
    description?: string;
    baseUrl?: string;
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    timeoutMs?: number | string;
    body?: unknown;
}
export declare function createHttpClosures(options?: HttpClosureOptions): ClosureDefinition[];
//# sourceMappingURL=http.d.ts.map