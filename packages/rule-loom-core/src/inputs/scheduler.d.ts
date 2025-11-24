import type { EventEmitter } from 'node:events';
import { z } from 'zod';
import type { RuleLoomEngine } from 'rule-loom-engine';
import type { RuleLoomLogger } from 'rule-loom-lib';
import type { SchedulerInputConfig, RunnerScheduler, InputPlugin } from './types.js';
export interface SchedulerInputOptions {
    engine: RuleLoomEngine;
    logger: RuleLoomLogger;
    events: EventEmitter;
}
export declare const schedulerInputSchema: z.ZodObject<{
    type: z.ZodLiteral<"scheduler">;
    jobs: z.ZodArray<z.ZodEffects<z.ZodObject<{
        name: z.ZodString;
        flow: z.ZodString;
        interval: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
        cron: z.ZodOptional<z.ZodString>;
        timeout: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString, z.ZodBoolean]>>;
        initialState: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        runtime: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        enabled: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        flow: string;
        name: string;
        interval?: string | number | undefined;
        cron?: string | undefined;
        timeout?: string | number | boolean | undefined;
        initialState?: Record<string, any> | undefined;
        runtime?: Record<string, any> | undefined;
        enabled?: boolean | undefined;
    }, {
        flow: string;
        name: string;
        interval?: string | number | undefined;
        cron?: string | undefined;
        timeout?: string | number | boolean | undefined;
        initialState?: Record<string, any> | undefined;
        runtime?: Record<string, any> | undefined;
        enabled?: boolean | undefined;
    }>, {
        flow: string;
        name: string;
        interval?: string | number | undefined;
        cron?: string | undefined;
        timeout?: string | number | boolean | undefined;
        initialState?: Record<string, any> | undefined;
        runtime?: Record<string, any> | undefined;
        enabled?: boolean | undefined;
    }, {
        flow: string;
        name: string;
        interval?: string | number | undefined;
        cron?: string | undefined;
        timeout?: string | number | boolean | undefined;
        initialState?: Record<string, any> | undefined;
        runtime?: Record<string, any> | undefined;
        enabled?: boolean | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "scheduler";
    jobs: {
        flow: string;
        name: string;
        interval?: string | number | undefined;
        cron?: string | undefined;
        timeout?: string | number | boolean | undefined;
        initialState?: Record<string, any> | undefined;
        runtime?: Record<string, any> | undefined;
        enabled?: boolean | undefined;
    }[];
}, {
    type: "scheduler";
    jobs: {
        flow: string;
        name: string;
        interval?: string | number | undefined;
        cron?: string | undefined;
        timeout?: string | number | boolean | undefined;
        initialState?: Record<string, any> | undefined;
        runtime?: Record<string, any> | undefined;
        enabled?: boolean | undefined;
    }[];
}>;
export declare const schedulerInputPlugin: InputPlugin<SchedulerInputConfig>;
export declare function createSchedulerInput(input: SchedulerInputConfig, options: SchedulerInputOptions): Promise<RunnerScheduler | undefined>;
//# sourceMappingURL=scheduler.d.ts.map