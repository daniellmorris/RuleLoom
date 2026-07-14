import type { Connector, Node } from "../types";

type ConnectorParamMeta = {
  name: string;
  type?: string;
  label?: string;
  labelTemplate?: string;
  itemLabelKey?: string;
  children?: ConnectorParamMeta[];
};

type ArrayContext = {
  arrayParam: ConnectorParamMeta;
  item: any;
  index: number;
};

export function buildConnectorsForNode(node: Node, meta?: any): Connector[] {
  const seen = new Set<string>();
  const connectors: Connector[] = [];
  const connectorLabels = (node.data?.ui as any)?.connectorLabels ?? {};
  const add = (c: Connector) => {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    connectors.push(c);
  };
  add({ id: "next", label: "next", direction: "next" });
  if (node.kind !== "closure") return connectors;
  const paramsMeta: ConnectorParamMeta[] = meta?.signature?.parameters ?? [];
  const paramsValue = node.data?.params ?? {};

  const visit = (param: ConnectorParamMeta, val: any, base: string, arrayContext?: ArrayContext) => {
    if (!param) return;
    if (param.type === "flowSteps") {
      add({
        id: base,
        label: resolveConnectorLabel(base, param, connectorLabels, arrayContext),
        direction: "dynamic"
      });
      return;
    }
    if (param.type === "array" && Array.isArray(val) && Array.isArray(param.children)) {
      val.forEach((item: any, idx: number) => {
        param.children?.forEach((child) => {
          visit(child, item?.[child.name], `${base}[${idx}].${child.name}`, { arrayParam: param, item, index: idx });
        });
      });
    }
  };

  paramsMeta.forEach((p) => {
    visit(p, paramsValue[p.name], p.name);
  });

  Object.entries(node.data?.params ?? {})
    .filter(([, v]) => typeof v === "object" && v !== null && "$call" in (v as any))
    .forEach(([name]) => add({ id: name, label: connectorLabels[name] || name, direction: "param" }));
  return connectors;
}

function resolveConnectorLabel(
  connectorId: string,
  param: ConnectorParamMeta,
  overrides: Record<string, string>,
  arrayContext?: ArrayContext
): string {
  const override = overrides[connectorId];
  if (typeof override === "string" && override.trim()) return override.trim();

  const template = param.labelTemplate ?? arrayContext?.arrayParam.labelTemplate;
  if (template) {
    const itemLabel = arrayContext ? resolveItemLabel(arrayContext) : null;
    if (!template.includes("{itemLabel}") || itemLabel) {
      const templated = applyTemplate(template, connectorId, param, arrayContext, itemLabel).trim();
      if (templated) return templated;
    }
  }

  if (param.label) return param.label;

  if (arrayContext) {
    const itemLabel = resolveItemLabel(arrayContext);
    return itemLabel ? `${itemLabel} ${param.name}` : `${singularize(arrayContext.arrayParam.name)} ${arrayContext.index + 1} ${param.name}`;
  }

  return connectorId;
}

function resolveItemLabel(arrayContext: ArrayContext): string | null {
  const key = arrayContext.arrayParam.itemLabelKey;
  if (!key) return null;
  const value = arrayContext.item?.[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function applyTemplate(
  template: string,
  connectorId: string,
  param: ConnectorParamMeta,
  arrayContext?: ArrayContext,
  itemLabel?: string | null
): string {
  return template
    .split("{connector}").join(connectorId)
    .split("{name}").join(param.name)
    .split("{index}").join(arrayContext ? String(arrayContext.index) : "")
    .split("{number}").join(arrayContext ? String(arrayContext.index + 1) : "")
    .split("{itemLabel}").join(itemLabel ?? "");
}

function singularize(value: string): string {
  if (value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.endsWith("s") && value.length > 1) return value.slice(0, -1);
  return value;
}
