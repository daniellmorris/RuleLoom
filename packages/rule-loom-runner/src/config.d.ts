import { z } from 'zod';
import type { LogLevel } from 'rule-loom-lib';
import type { HttpInputConfig, SchedulerInputConfig } from 'rule-loom-core/inputs';
import { flowSchema } from './schemas.js';
export type FlowConfig = z.infer<typeof flowSchema>;
export declare const closureSchema: z.ZodUnion<[z.ZodIntersection<z.ZodObject<{
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
}>]>>, z.ZodObject<{
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
}>, z.ZodObject<{
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
}>]>;
export type ClosureConfig = z.infer<typeof closureSchema>;
export declare function parseClosureConfigs(raw: unknown): ClosureConfig[];
export declare function createRunnerConfigSchema(): z.ZodEffects<z.ZodObject<{
    version: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    logger: z.ZodOptional<z.ZodObject<{
        level: z.ZodOptional<z.ZodType<LogLevel, z.ZodTypeDef, LogLevel>>;
    }, "strip", z.ZodTypeAny, {
        level?: LogLevel | undefined;
    }, {
        level?: LogLevel | undefined;
    }>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    plugins: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodObject<{
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
    }>]>, "many">>>;
    inputs: z.ZodDefault<z.ZodOptional<z.ZodArray<any, "many">>>;
    closures: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodIntersection<z.ZodObject<{
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
    }>]>>, z.ZodObject<{
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
    }>, z.ZodObject<{
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
    }>]>, "many">>>;
    secrets: z.ZodOptional<z.ZodObject<{
        inline: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        files: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            path: z.ZodString;
            encoding: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            key: string;
            path: string;
            encoding?: string | undefined;
        }, {
            key: string;
            path: string;
            encoding?: string | undefined;
        }>, "many">>;
        dotenv: z.ZodOptional<z.ZodObject<{
            path: z.ZodOptional<z.ZodString>;
            encoding: z.ZodOptional<z.ZodString>;
            required: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            path?: string | undefined;
            encoding?: string | undefined;
            required?: boolean | undefined;
        }, {
            path?: string | undefined;
            encoding?: string | undefined;
            required?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        dotenv?: {
            path?: string | undefined;
            encoding?: string | undefined;
            required?: boolean | undefined;
        } | undefined;
        inline?: Record<string, string> | undefined;
        env?: Record<string, string> | undefined;
        files?: {
            key: string;
            path: string;
            encoding?: string | undefined;
        }[] | undefined;
    }, {
        dotenv?: {
            path?: string | undefined;
            encoding?: string | undefined;
            required?: boolean | undefined;
        } | undefined;
        inline?: Record<string, string> | undefined;
        env?: Record<string, string> | undefined;
        files?: {
            key: string;
            path: string;
            encoding?: string | undefined;
        }[] | undefined;
    }>>;
    flows: z.ZodArray<z.ZodObject<{
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
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    closures: ({
        type: "module";
        module: string;
        name?: string | undefined;
        description?: string | undefined;
        export?: string | undefined;
        config?: any;
    } | {
        type: "flow";
        name: string;
        steps: import("rule-loom-engine").FlowStep[];
        description?: string | undefined;
    } | ({
        type: "template";
        name: string;
        template: "set-state" | "respond";
        options?: Record<string, any> | undefined;
        description?: string | undefined;
    } & ({
        template: "set-state";
        target: string;
        merge: boolean;
        value?: any;
    } | {
        status: number;
        template: "respond";
        headers?: Record<string, string> | undefined;
        body?: any;
    })))[];
    flows: {
        name: string;
        steps: import("rule-loom-engine").FlowStep[];
        description?: string | undefined;
    }[];
    version: number;
    plugins: ({
        path: string;
        source: "file";
        name?: string | undefined;
        integrity?: string | undefined;
    } | {
        name: string;
        source: "npm";
        integrity?: string | undefined;
        version?: string | undefined;
        registry?: string | undefined;
    } | {
        name: string;
        source: "store";
        integrity?: string | undefined;
        version?: string | undefined;
        registry?: string | undefined;
    } | {
        source: "github";
        repo: string;
        ref: string;
        path?: string | undefined;
        name?: string | undefined;
        integrity?: string | undefined;
    } | {
        path: string;
        source: "config";
        name?: string | undefined;
    })[];
    inputs: any[];
    logger?: {
        level?: LogLevel | undefined;
    } | undefined;
    metadata?: Record<string, any> | undefined;
    secrets?: {
        dotenv?: {
            path?: string | undefined;
            encoding?: string | undefined;
            required?: boolean | undefined;
        } | undefined;
        inline?: Record<string, string> | undefined;
        env?: Record<string, string> | undefined;
        files?: {
            key: string;
            path: string;
            encoding?: string | undefined;
        }[] | undefined;
    } | undefined;
}, {
    flows: {
        name: string;
        steps: import("rule-loom-engine").FlowStep[];
        description?: string | undefined;
    }[];
    logger?: {
        level?: LogLevel | undefined;
    } | undefined;
    closures?: ({
        type: "module";
        module: string;
        name?: string | undefined;
        description?: string | undefined;
        export?: string | undefined;
        config?: any;
    } | {
        type: "flow";
        name: string;
        steps: import("rule-loom-engine").FlowStep[];
        description?: string | undefined;
    } | ({
        type: "template";
        name: string;
        template: "set-state" | "respond";
        options?: Record<string, any> | undefined;
        description?: string | undefined;
    } & ({
        template: "set-state";
        target: string;
        value?: any;
        merge?: boolean | undefined;
    } | {
        template: "respond";
        status?: number | undefined;
        headers?: Record<string, string> | undefined;
        body?: any;
    })))[] | undefined;
    metadata?: Record<string, any> | undefined;
    version?: number | undefined;
    plugins?: ({
        path: string;
        source: "file";
        name?: string | undefined;
        integrity?: string | undefined;
    } | {
        name: string;
        source: "npm";
        integrity?: string | undefined;
        version?: string | undefined;
        registry?: string | undefined;
    } | {
        name: string;
        source: "store";
        integrity?: string | undefined;
        version?: string | undefined;
        registry?: string | undefined;
    } | {
        source: "github";
        repo: string;
        ref: string;
        path?: string | undefined;
        name?: string | undefined;
        integrity?: string | undefined;
    } | {
        path: string;
        source: "config";
        name?: string | undefined;
    })[] | undefined;
    inputs?: any[] | undefined;
    secrets?: {
        dotenv?: {
            path?: string | undefined;
            encoding?: string | undefined;
            required?: boolean | undefined;
        } | undefined;
        inline?: Record<string, string> | undefined;
        env?: Record<string, string> | undefined;
        files?: {
            key: string;
            path: string;
            encoding?: string | undefined;
        }[] | undefined;
    } | undefined;
}>, {
    closures: ({
        type: "module";
        module: string;
        name?: string | undefined;
        description?: string | undefined;
        export?: string | undefined;
        config?: any;
    } | {
        type: "flow";
        name: string;
        steps: import("rule-loom-engine").FlowStep[];
        description?: string | undefined;
    } | ({
        type: "template";
        name: string;
        template: "set-state" | "respond";
        options?: Record<string, any> | undefined;
        description?: string | undefined;
    } & ({
        template: "set-state";
        target: string;
        merge: boolean;
        value?: any;
    } | {
        status: number;
        template: "respond";
        headers?: Record<string, string> | undefined;
        body?: any;
    })))[];
    flows: {
        name: string;
        steps: import("rule-loom-engine").FlowStep[];
        description?: string | undefined;
    }[];
    version: number;
    plugins: ({
        path: string;
        source: "file";
        name?: string | undefined;
        integrity?: string | undefined;
    } | {
        name: string;
        source: "npm";
        integrity?: string | undefined;
        version?: string | undefined;
        registry?: string | undefined;
    } | {
        name: string;
        source: "store";
        integrity?: string | undefined;
        version?: string | undefined;
        registry?: string | undefined;
    } | {
        source: "github";
        repo: string;
        ref: string;
        path?: string | undefined;
        name?: string | undefined;
        integrity?: string | undefined;
    } | {
        path: string;
        source: "config";
        name?: string | undefined;
    })[];
    inputs: any[];
    logger?: {
        level?: LogLevel | undefined;
    } | undefined;
    metadata?: Record<string, any> | undefined;
    secrets?: {
        dotenv?: {
            path?: string | undefined;
            encoding?: string | undefined;
            required?: boolean | undefined;
        } | undefined;
        inline?: Record<string, string> | undefined;
        env?: Record<string, string> | undefined;
        files?: {
            key: string;
            path: string;
            encoding?: string | undefined;
        }[] | undefined;
    } | undefined;
}, {
    flows: {
        name: string;
        steps: import("rule-loom-engine").FlowStep[];
        description?: string | undefined;
    }[];
    logger?: {
        level?: LogLevel | undefined;
    } | undefined;
    closures?: ({
        type: "module";
        module: string;
        name?: string | undefined;
        description?: string | undefined;
        export?: string | undefined;
        config?: any;
    } | {
        type: "flow";
        name: string;
        steps: import("rule-loom-engine").FlowStep[];
        description?: string | undefined;
    } | ({
        type: "template";
        name: string;
        template: "set-state" | "respond";
        options?: Record<string, any> | undefined;
        description?: string | undefined;
    } & ({
        template: "set-state";
        target: string;
        value?: any;
        merge?: boolean | undefined;
    } | {
        template: "respond";
        status?: number | undefined;
        headers?: Record<string, string> | undefined;
        body?: any;
    })))[] | undefined;
    metadata?: Record<string, any> | undefined;
    version?: number | undefined;
    plugins?: ({
        path: string;
        source: "file";
        name?: string | undefined;
        integrity?: string | undefined;
    } | {
        name: string;
        source: "npm";
        integrity?: string | undefined;
        version?: string | undefined;
        registry?: string | undefined;
    } | {
        name: string;
        source: "store";
        integrity?: string | undefined;
        version?: string | undefined;
        registry?: string | undefined;
    } | {
        source: "github";
        repo: string;
        ref: string;
        path?: string | undefined;
        name?: string | undefined;
        integrity?: string | undefined;
    } | {
        path: string;
        source: "config";
        name?: string | undefined;
    })[] | undefined;
    inputs?: any[] | undefined;
    secrets?: {
        dotenv?: {
            path?: string | undefined;
            encoding?: string | undefined;
            required?: boolean | undefined;
        } | undefined;
        inline?: Record<string, string> | undefined;
        env?: Record<string, string> | undefined;
        files?: {
            key: string;
            path: string;
            encoding?: string | undefined;
        }[] | undefined;
    } | undefined;
}>;
export type RunnerConfig = z.infer<ReturnType<typeof createRunnerConfigSchema>>;
export interface RunnerConfigWithMeta {
    config: RunnerConfig;
    rawConfig: unknown;
    configPath: string;
    configDir: string;
}
export declare function parseRunnerConfig(rawConfig: unknown): RunnerConfig;
export declare function getHttpInput(config: RunnerConfig): HttpInputConfig | undefined;
export declare function getSchedulerInput(config: RunnerConfig): SchedulerInputConfig | undefined;
export declare function readRunnerConfigFile(configPath: string): Promise<RunnerConfigWithMeta>;
export declare function importClosureModule(modulePath: string, baseDir: string): Promise<any>;
//# sourceMappingURL=config.d.ts.map