import { z } from 'zod';
export declare const filePluginSpecSchema: z.ZodObject<{
    source: z.ZodLiteral<"file">;
    path: z.ZodString;
    integrity: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    path: string;
    source: "file";
    name?: string | undefined;
    integrity?: string | undefined;
}, {
    path: string;
    source: "file";
    name?: string | undefined;
    integrity?: string | undefined;
}>;
export declare const npmPluginSpecSchema: z.ZodObject<{
    source: z.ZodLiteral<"npm">;
    name: z.ZodString;
    version: z.ZodOptional<z.ZodString>;
    registry: z.ZodOptional<z.ZodString>;
    integrity: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    source: "npm";
    integrity?: string | undefined;
    version?: string | undefined;
    registry?: string | undefined;
}, {
    name: string;
    source: "npm";
    integrity?: string | undefined;
    version?: string | undefined;
    registry?: string | undefined;
}>;
export declare const storePluginSpecSchema: z.ZodObject<{
    source: z.ZodLiteral<"store">;
    name: z.ZodString;
    version: z.ZodOptional<z.ZodString>;
    registry: z.ZodOptional<z.ZodString>;
    integrity: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    source: "store";
    integrity?: string | undefined;
    version?: string | undefined;
    registry?: string | undefined;
}, {
    name: string;
    source: "store";
    integrity?: string | undefined;
    version?: string | undefined;
    registry?: string | undefined;
}>;
export declare const githubPluginSpecSchema: z.ZodObject<{
    source: z.ZodLiteral<"github">;
    repo: z.ZodString;
    ref: z.ZodString;
    path: z.ZodOptional<z.ZodString>;
    integrity: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    source: "github";
    repo: string;
    ref: string;
    path?: string | undefined;
    name?: string | undefined;
    integrity?: string | undefined;
}, {
    source: "github";
    repo: string;
    ref: string;
    path?: string | undefined;
    name?: string | undefined;
    integrity?: string | undefined;
}>;
export declare const configPluginSpecSchema: z.ZodObject<{
    source: z.ZodLiteral<"config">;
    path: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    path: string;
    source: "config";
    name?: string | undefined;
}, {
    path: string;
    source: "config";
    name?: string | undefined;
}>;
export declare const pluginSpecSchema: z.ZodUnion<[z.ZodObject<{
    source: z.ZodLiteral<"file">;
    path: z.ZodString;
    integrity: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    path: string;
    source: "file";
    name?: string | undefined;
    integrity?: string | undefined;
}, {
    path: string;
    source: "file";
    name?: string | undefined;
    integrity?: string | undefined;
}>, z.ZodObject<{
    source: z.ZodLiteral<"npm">;
    name: z.ZodString;
    version: z.ZodOptional<z.ZodString>;
    registry: z.ZodOptional<z.ZodString>;
    integrity: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    source: "npm";
    integrity?: string | undefined;
    version?: string | undefined;
    registry?: string | undefined;
}, {
    name: string;
    source: "npm";
    integrity?: string | undefined;
    version?: string | undefined;
    registry?: string | undefined;
}>, z.ZodObject<{
    source: z.ZodLiteral<"store">;
    name: z.ZodString;
    version: z.ZodOptional<z.ZodString>;
    registry: z.ZodOptional<z.ZodString>;
    integrity: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    source: "store";
    integrity?: string | undefined;
    version?: string | undefined;
    registry?: string | undefined;
}, {
    name: string;
    source: "store";
    integrity?: string | undefined;
    version?: string | undefined;
    registry?: string | undefined;
}>, z.ZodObject<{
    source: z.ZodLiteral<"github">;
    repo: z.ZodString;
    ref: z.ZodString;
    path: z.ZodOptional<z.ZodString>;
    integrity: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    source: "github";
    repo: string;
    ref: string;
    path?: string | undefined;
    name?: string | undefined;
    integrity?: string | undefined;
}, {
    source: "github";
    repo: string;
    ref: string;
    path?: string | undefined;
    name?: string | undefined;
    integrity?: string | undefined;
}>, z.ZodObject<{
    source: z.ZodLiteral<"config">;
    path: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    path: string;
    source: "config";
    name?: string | undefined;
}, {
    path: string;
    source: "config";
    name?: string | undefined;
}>]>;
export type PluginSpec = z.infer<typeof pluginSpecSchema>;
export declare function parsePluginSpecs(raw: unknown): PluginSpec[];
//# sourceMappingURL=pluginSpecs.d.ts.map