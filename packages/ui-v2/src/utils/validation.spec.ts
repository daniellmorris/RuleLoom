import { describe, expect, it } from "vitest";
import { validateApp } from "./validation";

const catalog = {
  closuresMeta: {
    "core.test": {
      signature: {
        parameters: [
          { name: "message", type: "string", required: true },
          { name: "enabled", type: "boolean", required: true },
          { name: "count", type: "number", required: true },
          { name: "steps", type: "flowSteps", required: true }
        ]
      }
    },
    "core.branch": {
      signature: {
        parameters: [
          {
            name: "cases",
            type: "array",
            required: true,
            children: [
              { name: "when", type: "flowSteps", required: true },
              { name: "then", type: "flowSteps", required: true }
            ]
          }
        ]
      }
    }
  },
  inputsMeta: {
    http: {
      configParameters: [{ name: "basePath", type: "string", required: true }],
      triggerParameters: [
        { name: "flow", type: "string", required: true },
        { name: "json", type: "boolean", required: true }
      ]
    }
  }
};

describe("validateApp", () => {
  it("flags missing required params and flowSteps connections", () => {
    const app = {
      flows: [
        {
          name: "Main",
          steps: [
            {
              closure: "core.test",
              parameters: { enabled: true, count: 1, steps: [] },
              $meta: { id: "step-1" }
            }
          ],
          $meta: { id: "flow-1", disconnected: [] }
        }
      ],
      closures: [],
      inputs: []
    };

    const result = validateApp(app, catalog);

    expect(result.byNodeId["step-1"].map((issue) => issue.field)).toEqual(["message", "steps"]);
    expect(result.byNodeId["step-1"].find((issue) => issue.field === "steps")?.kind).toBe("missing-connection");
  });

  it("does not treat false or zero as missing required values", () => {
    const app = {
      flows: [
        {
          name: "Main",
          steps: [
            {
              closure: "core.test",
              parameters: {
                message: "ok",
                enabled: false,
                count: 0,
                steps: [{ closure: "core.test", parameters: { message: "child", enabled: true, count: 1, steps: [{ closure: "unknown" }] } }]
              },
              $meta: { id: "step-1" }
            }
          ],
          $meta: { id: "flow-1", disconnected: [] }
        }
      ],
      closures: [],
      inputs: []
    };

    const result = validateApp(app, catalog);

    expect(result.byNodeId["step-1"]).toBeUndefined();
  });

  it("validates required input config and trigger values without rejecting false", () => {
    const app = {
      flows: [{ name: "Main", steps: [], $meta: { id: "flow-1", disconnected: [] } }],
      closures: [],
      inputs: [
        {
          type: "http",
          config: {},
          triggers: [{ flow: "Main", json: false, $meta: { id: "trigger-1" } }]
        }
      ]
    };

    const result = validateApp(app, catalog);

    expect(result.byNodeId["trigger-1"].map((issue) => issue.field)).toEqual(["config.basePath"]);
  });

  it("flags missing nested required flowSteps inside array parameters", () => {
    const app = {
      flows: [
        {
          name: "Main",
          steps: [
            {
              closure: "core.branch",
              parameters: { cases: [{ when: [], then: [{ closure: "core.test", parameters: {} }] }] },
              $meta: { id: "branch-1" }
            }
          ],
          $meta: { id: "flow-1", disconnected: [] }
        }
      ],
      closures: [],
      inputs: []
    };

    const result = validateApp(app, catalog);

    expect(result.byNodeId["branch-1"].some((issue) => issue.field === "cases[0].when")).toBe(true);
    expect(result.byNodeId["branch-1"].find((issue) => issue.field === "cases[0].when")?.kind).toBe("missing-connection");
  });
});
