import { z } from 'zod';
import type { InitInputConfig, InputPlugin } from './types.js';
export declare const initInputSchema: z.ZodObject<{
    type: z.ZodLiteral<"init">;
    flow: z.ZodString;
    initialState: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    runtime: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    type: "init";
    flow: string;
    initialState?: Record<string, any> | undefined;
    runtime?: Record<string, any> | undefined;
}, {
    type: "init";
    flow: string;
    initialState?: Record<string, any> | undefined;
    runtime?: Record<string, any> | undefined;
}>;
export declare const initInputPlugin: InputPlugin<InitInputConfig>;
//# sourceMappingURL=init.d.ts.map