import { describe, it, expect } from "vitest";
import path from "node:path";
import { createRunner } from "../../packages/rule-loom-runner/src/index.ts";
import type { RecorderEvent } from "../../packages/rule-loom-engine/src/index.ts";

const CONFIG_DIR = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "configs",
);

const makeRecorder = () => {
  const events: RecorderEvent[] = [];
  return {
    recorder: {
      onEvent: (e: RecorderEvent) => console.log(e) || events.push(e),
    },
    events,
  };
};

describe("Recorder integration", () => {
  it("records a branching flow (core.branch) with params and state snapshots", async () => {
    const runner = await createRunner(path.join(CONFIG_DIR, "branching.yaml"));
    try {
      const { recorder, events } = makeRecorder();

      const initialState = { request: { body: { items: ["a", "b", "c"] } } };
      const result = await runner.engine.execute(
        "process-order",
        initialState,
        {
          recorder,
          recordLevel: "full",
        },
      );

      // Response should be 200 with itemCount 3
      expect(result.state.response).toMatchObject({
        status: 200,
        body: { ok: true, itemCount: 3 },
      });

      // Expect enter/exit pairs for assign, branch, greater-than, respond (8 events)
      expect(events.map((e) => e.kind)).toEqual([
        "enter", // assign
        "exit",
        "enter", // branch
        "enter", // greater-than
        "exit",
        "enter", // respond - enter
        "exit", // resond - exit
        "exit", // branch exits after executing inner steps
      ]);

      const branchExit = events[events.length - 1];
      expect(branchExit.closure).toBe("core.branch");
      const respondEnter = events[5] as any; //
      expect(respondEnter.params?.status).toBe(200);
      const respondExit = events[6] as any; //
      expect(respondExit.stateAfter?.response?.status).toBe(200);
    } finally {
      await runner.close();
    }
  });
});
