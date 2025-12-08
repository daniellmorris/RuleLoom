import { z } from 'zod';
import type { FlowDefinition, FlowInvokeStep, FlowBranchStep } from 'rule-loom-engine';
import type { LogLevel } from 'rule-loom-lib';

export const logLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']) as z.ZodType<LogLevel>;

const conditionSchema = z.object({
  closure: z.string().min(1),
  parameters: z.record(z.any()).optional(),
  negate: z.boolean().optional(),
});

const whenSchema = z.union([conditionSchema, z.array(conditionSchema)]);

let flowStepSchema: z.ZodType<FlowDefinition['steps'][number]>;

const invokeStepSchema = z
  .object({
    type: z.literal('invoke').optional(),
    closure: z.string().min(1).optional(),
    parameters: z.record(z.any()).optional(),
    assign: z.string().min(1).optional(),
    mergeResult: z.boolean().optional(),
    when: whenSchema.optional(),
  })
  .passthrough()
  .superRefine((step, ctx) => {
    if ('cases' in step) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invoke steps cannot include "cases"; use branch step shape instead.',
      });
    }
  })
  .transform((step) => {
    const { type, closure, parameters, assign, mergeResult, when, ...rest } = step as any;
    const computedParams: Record<string, unknown> = { ...(parameters ?? {}) };

    for (const [key, value] of Object.entries(rest)) {
      if (value === undefined) continue;
      if (key === 'steps') {
        computedParams.steps = flowStepSchema.array().parse(value);
      } else {
        computedParams[key] = value;
      }
    }

    return {
      type: 'invoke' as const,
      closure,
      parameters: Object.keys(computedParams).length ? computedParams : undefined,
      assign,
      mergeResult,
      when,
    } satisfies FlowInvokeStep;
  });

const branchCaseSchema = z.object({
  when: z.lazy(() => flowStepSchema.array().min(1)),
  then: z.lazy(() => flowStepSchema.array().min(1)),
});

const rawBranchStepSchema = z
  .object({
    type: z.literal('branch').optional(),
    cases: z.array(branchCaseSchema).min(1),
    otherwise: z.lazy(() => flowStepSchema.array()).optional(),
  })
  .superRefine((value, ctx) => {
    if ('closure' in (value as Record<string, unknown>)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Branch steps cannot specify "closure".',
      });
    }
  });

const branchStepSchema = rawBranchStepSchema.transform((step) => ({
  type: 'branch' as const,
  cases: step.cases,
  otherwise: step.otherwise,
})) as unknown as z.ZodType<FlowBranchStep>;

flowStepSchema = z.union([
  invokeStepSchema as unknown as z.ZodType<FlowInvokeStep>,
  branchStepSchema,
]) as unknown as z.ZodType<FlowDefinition['steps'][number]>;

export { flowStepSchema };

export const flowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  steps: z.array(flowStepSchema).min(1),
}) satisfies z.ZodType<FlowDefinition>;

export const templateClosureSchema = z
  .object({
    type: z.literal('template'),
    template: z.enum(['set-state', 'respond']),
    name: z.string().min(1),
    description: z.string().optional(),
    options: z.record(z.any()).optional(),
  })
  .and(
    z.discriminatedUnion('template', [
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
    ]),
  );

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
