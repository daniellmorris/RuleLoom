import type { FlowWithMeta, StepWithMeta } from "../state/appStore";
import { buildNodeIndex } from "../state/appStore";
import { walkFlow } from "../state/walk";

export type ValidationSeverity = "error" | "warning";
export type ValidationIssueKind = "missing-param" | "missing-connection" | "unknown-closure" | "plugin";

export type ValidationIssue = {
  id: string;
  nodeId: string;
  flowName: string;
  field: string;
  message: string;
  severity: ValidationSeverity;
  kind: ValidationIssueKind;
};

export type ValidationResult = {
  issues: ValidationIssue[];
  byNodeId: Record<string, ValidationIssue[]>;
};

type ParamMeta = {
  name: string;
  type?: string;
  required?: boolean;
  children?: ParamMeta[];
};

type CatalogSnapshot = {
  closuresMeta?: Record<string, any>;
  inputsMeta?: Record<string, any>;
};

type AppSnapshot = {
  flows?: FlowWithMeta[];
  closures?: FlowWithMeta[];
  inputs?: any[];
};

export type PluginValidatorContext = {
  app: AppSnapshot;
  catalog: CatalogSnapshot;
};

export type PluginValidator = ((context: PluginValidatorContext) => ValidationIssue[] | void) | {
  validate: (context: PluginValidatorContext) => ValidationIssue[] | void;
};

export function validateApp(app: AppSnapshot, catalog: CatalogSnapshot, pluginValidators: PluginValidator[] = []): ValidationResult {
  const issues: ValidationIssue[] = [];
  const flows = app.flows ?? [];
  const closures = app.closures ?? [];

  flows.forEach((flow) => {
    validateFlow(flow, app.inputs ?? [], catalog, issues);
  });
  closures.forEach((closure) => {
    validateFlow(closure, [], catalog, issues);
  });

  pluginValidators.forEach((validator, idx) => {
    try {
      const validate = typeof validator === "function" ? validator : validator?.validate;
      const pluginIssues = validate?.({ app, catalog }) ?? [];
      pluginIssues.forEach((issue, issueIdx) => {
        issues.push({
          ...issue,
          id: issue.id || `plugin-validator-${idx}:${issueIdx}`,
          kind: issue.kind ?? "plugin",
          severity: issue.severity ?? "warning"
        });
      });
    } catch (err) {
      issues.push({
        id: `plugin-validator-${idx}:error`,
        nodeId: "plugin-validator",
        flowName: "plugin-validator",
        field: "plugin",
        message: `Plugin validator failed: ${(err as Error).message}`,
        severity: "warning",
        kind: "plugin"
      });
    }
  });

  return groupIssues(issues);
}

export function validateFlow(
  flow: FlowWithMeta,
  inputs: any[],
  catalog: CatalogSnapshot,
  issues: ValidationIssue[]
): void {
  const index = buildNodeIndex(flow);
  const visits = walkFlow(flow).steps;

  visits.forEach(({ step, path }) => {
    const nodeId = index.idByPath[path] ?? step.$meta?.id;
    if (!nodeId) return;
    const closureName = resolveClosureName(step);
    const meta = closureName ? catalog.closuresMeta?.[closureName] : undefined;
    if (!meta && closureName) {
      issues.push({
        id: `${nodeId}:unknown-closure:${closureName}`,
        nodeId,
        flowName: flow.name,
        field: closureName,
        message: `No catalog metadata found for "${closureName}".`,
        severity: "warning",
        kind: "unknown-closure"
      });
      return;
    }
    validateParameters({
      params: step.parameters ?? {},
      descriptors: meta?.signature?.parameters ?? [],
      nodeId,
      flowName: flow.name,
      issues
    });
  });

  inputs.forEach((input, inputIdx) => {
    const meta = catalog.inputsMeta?.[input?.type ?? ""] ?? {};
    (input?.triggers ?? []).forEach((trigger: any, triggerIdx: number) => {
      if (trigger?.flow !== flow.name) return;
      const nodeId = trigger?.$meta?.id ?? `inputs[${inputIdx}].triggers[${triggerIdx}]`;
      validateParameters({
        params: input?.config ?? {},
        descriptors: meta.configParameters ?? [],
        nodeId,
        flowName: flow.name,
        issues,
        prefix: "config"
      });
      validateParameters({
        params: trigger ?? {},
        descriptors: meta.triggerParameters ?? [],
        nodeId,
        flowName: flow.name,
        issues,
        prefix: "trigger"
      });
    });
  });
}

function validateParameters(args: {
  params: Record<string, any>;
  descriptors: ParamMeta[];
  nodeId: string;
  flowName: string;
  issues: ValidationIssue[];
  prefix?: string;
}): void {
  const { params, descriptors, nodeId, flowName, issues, prefix } = args;
  descriptors.forEach((descriptor) => {
    const field = prefix ? `${prefix}.${descriptor.name}` : descriptor.name;
    const value = params?.[descriptor.name];

    if (descriptor.required && isMissingValue(value, descriptor)) {
      issues.push({
        id: `${nodeId}:${field}`,
        nodeId,
        flowName,
        field,
        message: missingMessage(field, descriptor),
        severity: "error",
        kind: descriptor.type === "flowSteps" ? "missing-connection" : "missing-param"
      });
    }

    if (descriptor.type === "array" && Array.isArray(value) && Array.isArray(descriptor.children)) {
      value.forEach((item, idx) => {
        descriptor.children?.forEach((child) => {
          const childField = `${field}[${idx}].${child.name}`;
          const childValue = item?.[child.name];
          if (child.required && isMissingValue(childValue, child)) {
            issues.push({
              id: `${nodeId}:${childField}`,
              nodeId,
              flowName,
              field: childField,
              message: missingMessage(childField, child),
              severity: "error",
              kind: child.type === "flowSteps" ? "missing-connection" : "missing-param"
            });
          }
        });
      });
    }
  });
}

function isMissingValue(value: any, descriptor: ParamMeta): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number" || typeof value === "boolean") return false;
  if (descriptor.type === "flowSteps") return isMissingFlowSteps(value);
  if (Array.isArray(value)) return descriptor.required === true && value.length === 0;
  if (typeof value === "object" && "$call" in value) {
    const callValue = value.$call;
    if (typeof callValue === "string") return callValue.trim() === "";
    if (callValue && typeof callValue === "object" && Array.isArray(callValue.steps)) return callValue.steps.length === 0;
  }
  return false;
}

function isMissingFlowSteps(value: any): boolean {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === "object") {
    if (Array.isArray(value.steps)) return value.steps.length === 0;
    if ("$call" in value) return isMissingValue(value, { name: "$call" });
  }
  return true;
}

function missingMessage(field: string, descriptor: ParamMeta): string {
  if (descriptor.type === "flowSteps") return `Required connector "${field}" has no connected steps.`;
  return `Required parameter "${field}" is missing.`;
}

function resolveClosureName(step: StepWithMeta): string | undefined {
  return step?.closure ?? (typeof step?.type === "string" ? step.type : undefined);
}

function groupIssues(issues: ValidationIssue[]): ValidationResult {
  const byNodeId: Record<string, ValidationIssue[]> = {};
  issues.forEach((issue) => {
    byNodeId[issue.nodeId] = [...(byNodeId[issue.nodeId] ?? []), issue];
  });
  return { issues, byNodeId };
}
