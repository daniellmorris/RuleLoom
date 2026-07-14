import { describe, expect, it } from "vitest";
import { buildConnectorsForNode } from "./connectors";
import type { Node } from "../types";

const branchMeta = {
  signature: {
    parameters: [
      {
        name: "cases",
        type: "array",
        itemLabelKey: "label",
        labelTemplate: "{itemLabel} {name}",
        children: [
          { name: "label", type: "string" },
          { name: "when", type: "flowSteps" },
          { name: "then", type: "flowSteps" }
        ]
      },
      { name: "otherwise", type: "flowSteps" }
    ]
  }
};

function branchNode(params: Record<string, unknown>, connectorLabels?: Record<string, string>): Node {
  return {
    id: "branch",
    kind: "closure",
    label: "core.branch",
    x: 0,
    y: 0,
    connectors: [],
    data: {
      closureName: "core.branch",
      params,
      ui: connectorLabels ? { connectorLabels } : undefined
    }
  };
}

describe("buildConnectorsForNode", () => {
  it("keeps stable connector ids while deriving readable array labels", () => {
    const connectors = buildConnectorsForNode(
      branchNode({ cases: [{ when: [], then: [] }], otherwise: [] }),
      branchMeta
    );

    expect(connectors.map((connector) => connector.id)).toEqual(["next", "cases[0].when", "cases[0].then", "otherwise"]);
    expect(connectors.map((connector) => connector.label)).toEqual(["next", "case 1 when", "case 1 then", "otherwise"]);
  });

  it("uses itemLabelKey and labelTemplate metadata when available", () => {
    const connectors = buildConnectorsForNode(
      branchNode({ cases: [{ label: "in-stock", when: [], then: [] }] }),
      branchMeta
    );

    expect(connectors.find((connector) => connector.id === "cases[0].then")?.label).toBe("in-stock then");
  });

  it("lets $meta.connectorLabels override display labels without changing ids", () => {
    const connectors = buildConnectorsForNode(
      branchNode(
        { cases: [{ label: "in-stock", when: [], then: [] }] },
        { "cases[0].then": "ship now" }
      ),
      branchMeta
    );

    expect(connectors.find((connector) => connector.label === "ship now")?.id).toBe("cases[0].then");
  });
});
