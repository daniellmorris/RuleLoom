import type { FlowWithUi, StepWithUi } from "./appStore";

export type StepVisit = {
  step: StepWithUi;
  path: string;
  arr: StepWithUi[];
  idx: number;
  discIdx?: number;
  parentStepPath?: string;
  parentEdgeLabel?: string;
};

export type StepsArrayMeta = {
  pathPrefix: string;
  inline: boolean;
  discIdx?: number;
  parentStepPath?: string;
  parentEdgeLabel?: string;
  stepPaths: string[];
  steps: StepWithUi[];
};

export type WalkResult = { steps: StepVisit[]; arrays: StepsArrayMeta[] };

const isStepLike = (val: any) => val && typeof val === "object" && (val.$ui || val.closure || val.type);

export function walkFlow(flow: FlowWithUi): WalkResult {
  const steps: StepVisit[] = [];
  const arrays: StepsArrayMeta[] = [];

  const ensureArrayMeta = (meta: Omit<StepsArrayMeta, "stepPaths" | "steps">, stepsArr: StepWithUi[]): StepsArrayMeta => {
    const existing = arrays.find(
      (a) =>
        a.pathPrefix === meta.pathPrefix &&
        a.inline === meta.inline &&
        a.discIdx === meta.discIdx &&
        a.parentStepPath === meta.parentStepPath &&
        a.parentEdgeLabel === meta.parentEdgeLabel
    );
    if (existing) return existing;
    const created: StepsArrayMeta = { ...meta, stepPaths: [], steps: stepsArr };
    arrays.push(created);
    return created;
  };

  const visitSteps = (
    stepsArr: StepWithUi[] | undefined,
    opts: { pathPrefix: string; inline: boolean; discIdx?: number; parentStepPath?: string; parentEdgeLabel?: string }
  ) => {
    if (!Array.isArray(stepsArr)) return;
    const meta = ensureArrayMeta(opts, stepsArr);
    stepsArr.forEach((step, idx) => {
      const path = opts.inline ? `${opts.pathPrefix}[${idx}]` : `${opts.pathPrefix}steps[${idx}]`;
      meta.stepPaths.push(path);
      steps.push({
        step,
        path,
        arr: stepsArr,
        idx,
        discIdx: opts.discIdx,
        parentStepPath: opts.parentStepPath,
        parentEdgeLabel: opts.parentEdgeLabel
      });

      const traverseValue = (val: any, basePath: string, label: string) => {
        if (Array.isArray(val)) {
          if (val.some(isStepLike)) {
            visitSteps(val as any, { pathPrefix: basePath, inline: true, discIdx: opts.discIdx, parentStepPath: path, parentEdgeLabel: label });
            return;
          }
          val.forEach((item, i) => traverseValue(item, `${basePath}[${i}]`, `${label}[${i}]`));
          return;
        }
          if (val && typeof val === "object") {
            if (Array.isArray((val as any).steps)) {
              visitSteps((val as any).steps as any, { pathPrefix: `${basePath}.steps.`, inline: false, discIdx: opts.discIdx, parentStepPath: path, parentEdgeLabel: label });
              return;
            }
            if (Array.isArray((val as any).$call?.steps)) {
              visitSteps((val as any).$call.steps as any, { pathPrefix: `${basePath}.$call.steps.`, inline: false, discIdx: opts.discIdx, parentStepPath: path, parentEdgeLabel: label });
              return;
            }
            Object.entries(val).forEach(([k, v]) => traverseValue(v, `${basePath}.${k}`, `${label}.${k}`));
          }
        };

        Object.entries(step.parameters ?? {}).forEach(([pname, pval]) => traverseValue(pval, `${path}.parameters.${pname}`, pname));
    });
  };

  visitSteps(flow.steps, { pathPrefix: "", inline: false });
  (flow.$ui?.disconnected ?? []).forEach((frag, di) => visitSteps(frag?.steps, { pathPrefix: `$ui.disconnected[${di}].`, inline: false, discIdx: di }));

  return { steps, arrays };
}
