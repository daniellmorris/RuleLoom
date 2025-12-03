import type {
  ClosureDefinition,
  ClosureSignature,
  FlowBranchStep,
  FlowDefinition,
  FlowInvokeStep,
  FlowStep,
  ConditionDefinition,
} from 'rule-loom-engine';
import type { RunnerConfig } from './config.js';
import type { HttpInputConfig, SchedulerInputConfig, InitInputConfig, BaseInputConfig } from 'rule-loom-core/inputs';

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
    validateFlow(flow, signatureByClosure, issues);
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

function validateFlow(flow: FlowDefinition, signatureByClosure: Map<string, ClosureSignature>, issues: ValidationIssue[]) {
  const visitSteps = (steps: FlowStep[], path: string) => {
    steps.forEach((step, index) => {
      if (isBranchStep(step)) {
        const branchPath = `${path}.steps[${index}]`;
        step.cases.forEach((branchCase, caseIndex) => {
          validateConditions(branchCase.when, flow.name, `${branchPath}.cases[${caseIndex}]`, signatureByClosure, issues);
          visitSteps(branchCase.steps, `${branchPath}.cases[${caseIndex}]`);
        });
        if (step.otherwise) {
          visitSteps(step.otherwise, `${branchPath}.otherwise`);
        }
        return;
      }

      validateInvokeStep(step, flow.name, `${path}.steps[${index}]`, signatureByClosure, issues);
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
  issues: ValidationIssue[],
) {
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
    if (value !== undefined && descriptor.type === 'flowSteps' && !Array.isArray(value)) {
      issues.push({
        level: 'error',
        message: `Parameter "${descriptor.name}" on closure "${closureName}" must be an array of steps.`,
        flow: flowName,
        closure: closureName,
        path,
      });
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

function isBranchStep(step: FlowStep): step is FlowBranchStep {
  return (step as FlowBranchStep).cases !== undefined;
}
