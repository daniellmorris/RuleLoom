export interface TemplateContext {
    state: Record<string, unknown>;
    runtime: Record<string, unknown>;
    parameters?: Record<string, unknown>;
}
export declare function resolveDynamicValues<T>(value: T, context: TemplateContext): T;
//# sourceMappingURL=utils.d.ts.map