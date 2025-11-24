import { z } from 'zod';
import type { RuleLoomEngine } from 'rule-loom-engine';
import type { RuleLoomLogger } from 'rule-loom-lib';
import type { HttpInputConfig, HttpInputApp, InputPlugin } from './types.js';
export interface CreateHttpInputOptions {
    logger: RuleLoomLogger;
    metadata?: Record<string, unknown>;
}
export declare const httpInputSchema: z.ZodObject<{
    type: z.ZodLiteral<"http">;
    id: z.ZodOptional<z.ZodString>;
    basePath: z.ZodOptional<z.ZodString>;
    bodyLimit: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    routes: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        method: z.ZodOptional<z.ZodEnum<["get", "post", "put", "patch", "delete"]>>;
        path: z.ZodString;
        flow: z.ZodString;
        respondWith: z.ZodOptional<z.ZodObject<{
            status: z.ZodOptional<z.ZodNumber>;
            headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            body: z.ZodOptional<z.ZodAny>;
        }, "strip", z.ZodTypeAny, {
            status?: number | undefined;
            headers?: Record<string, string> | undefined;
            body?: any;
        }, {
            status?: number | undefined;
            headers?: Record<string, string> | undefined;
            body?: any;
        }>>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        flow: string;
        id?: string | undefined;
        method?: "get" | "post" | "put" | "patch" | "delete" | undefined;
        respondWith?: {
            status?: number | undefined;
            headers?: Record<string, string> | undefined;
            body?: any;
        } | undefined;
    }, {
        path: string;
        flow: string;
        id?: string | undefined;
        method?: "get" | "post" | "put" | "patch" | "delete" | undefined;
        respondWith?: {
            status?: number | undefined;
            headers?: Record<string, string> | undefined;
            body?: any;
        } | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "http";
    routes: {
        path: string;
        flow: string;
        id?: string | undefined;
        method?: "get" | "post" | "put" | "patch" | "delete" | undefined;
        respondWith?: {
            status?: number | undefined;
            headers?: Record<string, string> | undefined;
            body?: any;
        } | undefined;
    }[];
    id?: string | undefined;
    basePath?: string | undefined;
    bodyLimit?: string | number | undefined;
}, {
    type: "http";
    routes: {
        path: string;
        flow: string;
        id?: string | undefined;
        method?: "get" | "post" | "put" | "patch" | "delete" | undefined;
        respondWith?: {
            status?: number | undefined;
            headers?: Record<string, string> | undefined;
            body?: any;
        } | undefined;
    }[];
    id?: string | undefined;
    basePath?: string | undefined;
    bodyLimit?: string | number | undefined;
}>;
export declare const httpInputPlugin: InputPlugin<HttpInputConfig>;
export declare function createHttpInputApp(engine: RuleLoomEngine, input: HttpInputConfig, options: CreateHttpInputOptions): HttpInputApp;
export declare function createPlaceholderHttpApp(logger?: RuleLoomLogger): HttpInputApp;
//# sourceMappingURL=http.d.ts.map