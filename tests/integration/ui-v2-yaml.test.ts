import { describe, it, expect } from "vitest";
import yaml from "js-yaml";
import { importFlowFromYaml, exportFlowToYaml } from "../../packages/ui-v2/src/utils/yaml";

const httpSample = `
version: 1
inputs:
  - type: http
    routes:
      - method: post
        path: /echo
        flow: echo-request
closures:
  - type: flow
    name: respond-success
    steps:
      - closure: core.respond
        parameters:
          status: 200
          body:
            ok: true
flows:
  - name: echo-request
    steps:
      - closure: core.assign
        parameters:
          target: payload
          value: "\${request.body}"
      - cases:
          - when:
              closure: core.truthy
              parameters:
                value: "\${state.payload}"
            steps:
              - closure: respond-success
        otherwise:
          - closure: core.respond
            parameters:
              status: 204
`;

const branchSample = `
version: 1
flows:
  - name: branch-demo
    steps:
      - closure: core.log
        parameters:
          message: start
      - cases:
          - when:
              closure: core.equals
              parameters:
                left: "\${state.flag}"
                right: "A"
            steps:
              - closure: core.log
                parameters:
                  message: path-a
          - when:
              closure: core.equals
              parameters:
                left: "\${state.flag}"
                right: "B"
            steps:
              - closure: core.log
                parameters:
                  message: path-b
        otherwise:
          - closure: core.log
            parameters:
              message: default
`;

describe("yaml import/export round-trip", () => {
  it("round-trips simple http flow steps", () => {
    const flow1 = importFlowFromYaml(httpSample);
    const yaml1 = exportFlowToYaml(flow1);
    const flow2 = importFlowFromYaml(yaml1);
    const yaml2 = exportFlowToYaml(flow2);
    expect(yaml2).toEqual(yaml1);
  });

  it("round-trips branch flow steps", () => {
    const flow1 = importFlowFromYaml(branchSample);
    const yaml1 = exportFlowToYaml(flow1);
    const flow2 = importFlowFromYaml(yaml1);
    const yaml2 = exportFlowToYaml(flow2);
    expect(yaml2).toEqual(yaml1);
  });
});
