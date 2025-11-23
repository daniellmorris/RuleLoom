import { z } from 'zod';
import type { FlowDefinition } from 'rule-loom-engine';
import type { LogLevel } from 'rule-loom-lib';
export declare const logLevelSchema: z.ZodType<LogLevel>;
declare let flowStepSchema: z.ZodType<FlowDefinition['steps'][number]>;
export { flowStepSchema };
export declare const flowSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    steps: z.ZodArray<z.ZodType<import("rule-loom-engine").FlowStep, z.ZodTypeDef, import("rule-loom-engine").FlowStep>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    steps: import("rule-loom-engine").FlowStep[];
    description?: string | undefined;
}, {
    name: string;
    steps: import("rule-loom-engine").FlowStep[];
    description?: string | undefined;
}>;
export declare const templateClosureSchema: z.ZodIntersection<z.ZodObject<{
    type: z.ZodLiteral<"template">;
    template: z.ZodEnum<["set-state", "respond"]>;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    type: "template";
    name: string;
    template: "set-state" | "respond";
    options?: Record<string, any> | undefined;
    description?: string | undefined;
}, {
    type: "template";
    name: string;
    template: "set-state" | "respond";
    options?: Record<string, any> | undefined;
    description?: string | undefined;
}>, z.ZodDiscriminatedUnion<"template", [z.ZodObject<{
    template: z.ZodLiteral<"set-state">;
    target: z.ZodString;
    value: z.ZodOptional<z.ZodAny>;
    merge: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    template: "set-state";
    target: string;
    merge: boolean;
    value?: any;
}, {
    template: "set-state";
    target: string;
    value?: any;
    merge?: boolean | undefined;
}>, z.ZodObject<{
    template: z.ZodLiteral<"respond">;
    status: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    body: z.ZodOptional<z.ZodAny>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status: number;
    template: "respond";
    headers?: Record<string, string> | undefined;
    body?: any;
}, {
    template: "respond";
    status?: number | undefined;
    headers?: Record<string, string> | undefined;
    body?: any;
}>]>>;
export declare const moduleClosureSchema: z.ZodObject<{
    type: z.ZodLiteral<"module">;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    module: z.ZodString;
    export: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    type: "module";
    module: string;
    name?: string | undefined;
    description?: string | undefined;
    export?: string | undefined;
    config?: any;
}, {
    type: "module";
    module: string;
    name?: string | undefined;
    description?: string | undefined;
    export?: string | undefined;
    config?: any;
}>;
export declare const flowClosureSchema: z.ZodObject<{
    type: z.ZodLiteral<"flow">;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    steps: z.ZodArray<z.ZodType<import("rule-loom-engine").FlowStep, z.ZodTypeDef, import("rule-loom-engine").FlowStep>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "flow";
    name: string;
    steps: import("rule-loom-engine").FlowStep[];
    description?: string | undefined;
}, {
    type: "flow";
    name: string;
    steps: import("rule-loom-engine").FlowStep[];
    description?: string | undefined;
}>;
//# sourceMappingURL=schemas.d.ts.map