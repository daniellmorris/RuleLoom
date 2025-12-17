import type { ClosureDefinition, ClosureSignature, FlowDefinition, FlowInvokeStep, ConditionDefinition } from 'rule-loom-engine';
import type { RunnerConfig } from './config.js';
import type { BaseInputConfig } from './pluginApi.js';

export type ValidationIssueLevel = 'error' | 'warning';

export interface ValidationIssue {
  level: ValidationIssueLevel;
  message: string;
  flow?: string;
  closure?: string;
  path?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export class RunnerValidationError extends Error {
  constructor(public result: ValidationResult) {
    super('Runner configuration validation failed');
    this.name = 'RunnerValidationError';
  }
}

export function validateRunnerConfig(config: RunnerConfig, closures: ClosureDefinition[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const signatureByClosure = new Map<string, ClosureSignature>();
  const implicitClosures = closures.filter((c) => (c.implicitFields ?? []).length > 0);
  const flowNames = new Set(config.flows.map((f) => f.name));

  for (const closure of closures) {
    if (!closure.signature) {
      issues.push({
        level: 'error',
        message: `Closure "${closure.name}" is missing signature metadata.`,
        closure: closure.name,
      });
      continue;
    }
    signatureByClosure.set(closure.name, closure.signature);
  }

  validateInputTriggers(config.inputs ?? [], flowNames, issues);

  for (const flow of config.flows ?? []) {
    validateFlow(flow, signatureByClosure, implicitClosures, issues);
  }

  return { valid: issues.every((issue) => issue.level !== 'error'), issues };
}

function validateInputTriggers(inputs: BaseInputConfig[], flowNames: Set<string>, issues: ValidationIssue[]) {
  inputs.forEach((input, idx) => {
    const path = `inputs[${idx}]`;
    const type = (input as any).type;
    const triggers = (input as any).triggers;
    if (!Array.isArray(triggers) || triggers.length === 0) {
      issues.push({
        level: 'error',
        message: `Input "${type}" must provide at least one trigger.`,
        path,
      });
      return;
    }
    triggers.forEach((trigger: any, tIdx: number) => {
      const trigPath = `${path}.triggers[${tIdx}]`;
      if (!trigger?.flow || typeof trigger.flow !== 'string') {
        issues.push({
          level: 'error',
          message: `Trigger at ${trigPath} is missing required "flow".`,
          path: trigPath,
        });
        return;
      }
      if (!flowNames.has(trigger.flow)) {
        issues.push({
          level: 'error',
          message: `Trigger flow "${trigger.flow}" does not match any configured flow.`,
          path: trigPath,
        });
      }
    });
  });
}

function validateFlow(
  flow: FlowDefinition,
  signatureByClosure: Map<string, ClosureSignature>,
  implicitClosures: ClosureDefinition[],
  issues: ValidationIssue[],
) {
  const visitSteps = (steps: FlowInvokeStep[], path: string) => {
    steps.forEach((step, index) => {
      validateInvokeStep(step, flow.name, `${path}.steps[${index}]`, signatureByClosure, implicitClosures, issues);
      if (step.when) {
        validateConditions(step.when, flow.name, `${path}.steps[${index}].when`, signatureByClosure, issues);
      }
    });
  };

  visitSteps(flow.steps ?? [], `flows[${flow.name}]`);
}

function validateInvokeStep(
  step: FlowInvokeStep,
  flowName: string,
  path: string,
  signatureByClosure: Map<string, ClosureSignature>,
  implicitClosures: ClosureDefinition[],
  issues: ValidationIssue[],
) {
  if (!step.closure) {
    const matched = implicitClosures.find((closure) => {
      const fields = closure.implicitFields ?? [];
      if (!fields.length) return false;
      return fields.every((field) => Object.prototype.hasOwnProperty.call(step as any, field));
    });

    if (!matched) {
      issues.push({
        level: 'error',
        message: 'Step is missing "closure" and does not satisfy any implicit closure matcher.',
        flow: flowName,
        path,
      });
      return;
    }

    if (!matched.signature) {
      issues.push({
        level: 'error',
        message: `Implicit closure "${matched.name}" is missing signature metadata for validation.`,
        flow: flowName,
        closure: matched.name,
        path,
      });
      return;
    }

    validateParameters(step.parameters ?? {}, matched.signature, flowName, matched.name, path, issues);
    return;
  }

  const signature = signatureByClosure.get(step.closure);
  if (!signature) {
    issues.push({ level: 'error', message: `Closure "${step.closure}" is not registered.`, flow: flowName, closure: step.closure, path });
    return;
  }

  validateParameters(step.parameters ?? {}, signature, flowName, step.closure, path, issues);
}

function validateConditions(
  when: ConditionDefinition | ConditionDefinition[],
  flowName: string,
  path: string,
  signatureByClosure: Map<string, ClosureSignature>,
  issues: ValidationIssue[],
) {
  if (Array.isArray(when)) {
    when.forEach((condition, index) =>
      validateSingleCondition(condition, flowName, `${path}[${index}]`, signatureByClosure, issues),
    );
    return;
  }
  validateSingleCondition(when, flowName, path, signatureByClosure, issues);
}

function validateSingleCondition(
  condition: ConditionDefinition,
  flowName: string,
  path: string,
  signatureByClosure: Map<string, ClosureSignature>,
  issues: ValidationIssue[],
) {
  const signature = signatureByClosure.get(condition.closure);
  if (!signature) {
    issues.push({
      level: 'error',
      message: `Condition closure "${condition.closure}" is not registered.`,
      flow: flowName,
      closure: condition.closure,
      path,
    });
    return;
  }
  validateParameters(condition.parameters ?? {}, signature, flowName, condition.closure, path, issues);
}

function validateParameters(
  parameters: Record<string, unknown>,
  signature: ClosureSignature,
  flowName: string,
  closureName: string,
  path: string,
  issues: ValidationIssue[],
) {
  const descriptors = signature.parameters ?? [];
  const providedKeys = new Set(Object.keys(parameters));

  for (const descriptor of descriptors) {
    if (descriptor.required) {
      const value = parameters[descriptor.name];
      if (value === undefined || value === null) {
        issues.push({
          level: 'error',
          message: `Closure "${closureName}" is missing required parameter "${descriptor.name}".`,
          flow: flowName,
          closure: closureName,
          path,
        });
        continue;
      }
    }

    const value = parameters[descriptor.name];
    if (value !== undefined && descriptor.type === 'flowSteps') {
      if (!Array.isArray(value)) {
        issues.push({
          level: 'error',
          message: `Parameter "${descriptor.name}" on closure "${closureName}" must be an array of steps.`,
          flow: flowName,
          closure: closureName,
          path,
        });
      }
    }
  }

  if (signature.allowAdditionalParameters) {
    return;
  }

  const allowedNames = new Set(descriptors.map((descriptor) => descriptor.name));
  for (const key of providedKeys) {
    if (!allowedNames.has(key)) {
      issues.push({
        level: 'error',
        message: `Parameter "${key}" is not defined for closure "${closureName}".`,
        flow: flowName,
        closure: closureName,
        path,
      });
    }
  }
}
