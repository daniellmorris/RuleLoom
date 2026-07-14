import yaml from "js-yaml";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "./appStore";

const baseYaml = `
version: 1
plugins: []
inputs: []
closures: []
flows:
  - name: Main
    steps: []
    $meta:
      id: flow-1
      x: 100
      y: 100
      disconnected: []
      notes: []
`;

describe("appStore canvas notes", () => {
  beforeEach(() => {
    useAppStore.getState().loadYaml(baseYaml);
  });

  it("adds, updates, and deletes notes without changing steps", () => {
    const noteId = useAppStore.getState().addNote("Main", { x: 12, y: 34, text: "first" });
    expect(noteId).toBeTruthy();

    let flow = useAppStore.getState().app.flows[0];
    expect(flow.steps).toEqual([]);
    expect(flow.$meta?.notes).toMatchObject([{ id: noteId, x: 12, y: 34, text: "first" }]);

    useAppStore.getState().updateNote("Main", noteId as string, { x: 90, text: "updated" });
    flow = useAppStore.getState().app.flows[0];
    expect(flow.$meta?.notes?.[0]).toMatchObject({ id: noteId, x: 90, y: 34, text: "updated" });

    useAppStore.getState().deleteNote("Main", noteId as string);
    flow = useAppStore.getState().app.flows[0];
    expect(flow.$meta?.notes).toEqual([]);
    expect(flow.steps).toEqual([]);
  });

  it("preserves notes through YAML export and import", () => {
    const noteId = useAppStore.getState().addNote("Main", { x: 44, y: 55, text: "persist me" });
    const exported = useAppStore.getState().toYaml();
    const parsed = yaml.load(exported) as any;

    expect(parsed.flows[0].$meta.notes).toMatchObject([{ id: noteId, x: 44, y: 55, text: "persist me" }]);

    useAppStore.getState().loadYaml(exported);
    expect(useAppStore.getState().app.flows[0].$meta?.notes).toMatchObject([
      { id: noteId, x: 44, y: 55, text: "persist me" }
    ]);
  });
});

describe("appStore input instances", () => {
  beforeEach(() => {
    useAppStore.getState().loadYaml(baseYaml);
  });

  it("adds same-type triggers as distinct input instances with stable ids", () => {
    const store = useAppStore.getState();
    store.addTrigger("http", "Main");
    store.addTrigger("http", "Main");

    const inputs = useAppStore.getState().app.inputs;
    expect(inputs).toHaveLength(2);
    expect(inputs.map((input) => input.type)).toEqual(["http", "http"]);
    expect(inputs.map((input) => input.id)).toEqual(["http-1", "http-2"]);
    expect(inputs.every((input) => input.triggers?.[0]?.flow === "Main")).toBe(true);
  });

  it("preserves input instance ids through YAML export and import", () => {
    useAppStore.getState().addTrigger("http", "Main");
    useAppStore.getState().addTrigger("http", "Main");
    useAppStore.getState().updateInputId(1, "admin-http");
    useAppStore.getState().updateInputConfig(1, "basePath", "/admin");

    const exported = useAppStore.getState().toYaml();
    useAppStore.getState().loadYaml(exported);

    const inputs = useAppStore.getState().app.inputs;
    expect(inputs.map((input) => input.id)).toEqual(["http-1", "admin-http"]);
    expect(inputs[1].config.basePath).toBe("/admin");
  });

  it("removes an input instance independently", () => {
    useAppStore.getState().addTrigger("http", "Main");
    useAppStore.getState().addTrigger("http", "Main");
    useAppStore.getState().removeInputInstance(0);

    const inputs = useAppStore.getState().app.inputs;
    expect(inputs).toHaveLength(1);
    expect(inputs[0].id).toBe("http-2");
  });
});
