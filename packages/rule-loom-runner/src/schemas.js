import { z } from 'zod';
export const logLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);
const conditionSchema = z.object({
    closure: z.string().min(1),
    parameters: z.record(z.any()).optional(),
    negate: z.boolean().optional(),
});
const whenSchema = z.union([conditionSchema, z.array(conditionSchema)]);
let flowStepSchema;
const invokeStepSchema = z
    .object({
    type: z.literal('invoke').optional(),
    closure: z.string().min(1),
    parameters: z.record(z.any()).optional(),
    assign: z.string().min(1).optional(),
    mergeResult: z.boolean().optional(),
    when: whenSchema.optional(),
})
    .passthrough()
    .transform((step) => {
    const { type, closure, parameters, assign, mergeResult, when, ...rest } = step;
    const computedParams = { ...(parameters ?? {}) };
    for (const [key, value] of Object.entries(rest)) {
        if (value === undefined)
            continue;
        if (key === 'steps') {
            computedParams.steps = flowStepSchema.array().parse(value);
        }
        else {
            computedParams[key] = value;
        }
    }
    return {
        type: 'invoke',
        closure,
        parameters: Object.keys(computedParams).length ? computedParams : undefined,
        assign,
        mergeResult,
        when,
    };
});
const branchCaseSchema = z.object({
    when: whenSchema,
    steps: z.lazy(() => flowStepSchema.array().min(1)),
});
const rawBranchStepSchema = z.object({
    type: z.literal('branch').optional(),
    cases: z.array(branchCaseSchema).min(1),
    otherwise: z.lazy(() => flowStepSchema.array()).optional(),
}).superRefine((value, ctx) => {
    if ('closure' in value) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Branch steps cannot specify "closure".',
        });
    }
});
const branchStepSchema = rawBranchStepSchema.transform((step) => ({
    type: 'branch',
    cases: step.cases,
    otherwise: step.otherwise,
}));
flowStepSchema = z.union([
    invokeStepSchema,
    branchStepSchema,
]);
export { flowStepSchema };
export const flowSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    steps: z.array(flowStepSchema).min(1),
});
export const templateClosureSchema = z
    .object({
    type: z.literal('template'),
    template: z.enum(['set-state', 'respond']),
    name: z.string().min(1),
    description: z.string().optional(),
    options: z.record(z.any()).optional(),
})
    .and(z.discriminatedUnion('template', [
    z.object({
        template: z.literal('set-state'),
        target: z.string().min(1),
        value: z.any().optional(),
        merge: z.boolean().optional().default(false),
    }),
    z.object({
        template: z.literal('respond'),
        status: z.number().int().optional().default(200),
        body: z.any().optional(),
        headers: z.record(z.string()).optional(),
    }),
]));
export const moduleClosureSchema = z.object({
    type: z.literal('module'),
    name: z.string().optional(),
    description: z.string().optional(),
    module: z.string().min(1),
    export: z.string().optional(),
    config: z.any().optional(),
});
export const flowClosureSchema = z.object({
    type: z.literal('flow'),
    name: z.string().min(1),
    description: z.string().optional(),
    steps: z.array(flowStepSchema).min(1),
});
//# sourceMappingURL=schemas.js.map