import { describe, expect, it } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import yaml from "js-yaml";
import { runYamlTests } from "../../packages/rule-loom-testing/src/index.ts";

const CONFIG_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), "configs");
const CONFIG_PATH = path.join(CONFIG_DIR, "yaml-testing.yaml");
const execFileAsync = promisify(execFile);

describe("YAML testing framework", () => {
  it("runs YAML tests with closure mocks, expectations, and recorder traces", async () => {
    const result = await runYamlTests({ configPath: CONFIG_PATH });

    expect(result.passed).toBe(true);
    expect(result.results).toHaveLength(1);
    const [test] = result.results;
    expect(test.passed).toBe(true);
    expect(test.state?.response).toMatchObject({
      status: 200,
      body: { ok: true, count: 7, echoed: "sample" },
    });
    expect(test.trace.some((event) => event.kind === "exit" && event.step === "count-items" && (event as any).output === 7)).toBe(true);
    expect(test.trace.some((event) => event.kind === "exit" && event.step === "respond-ok")).toBe(true);
  });

  it("returns failures with trace data when an expectation does not match", async () => {
    const configPath = await writeBadConfig();

    const result = await runYamlTests({ configPath });

    expect(result.passed).toBe(false);
    expect(result.results[0].failures[0].path).toBe("response");
    expect(result.results[0].failures[0].trace?.length).toBeGreaterThan(0);
  });

  it("CLI exits non-zero and emits trace data for failing YAML tests", async () => {
    const configPath = await writeBadConfig();
    const repoRoot = path.resolve(CONFIG_DIR, "../../..");
    await execFileAsync("npm", ["run", "build", "--workspace", "rule-loom-testing"], { cwd: repoRoot });

    await expect(
      execFileAsync("node", [
        "packages/rule-loom-testing/dist/cli.js",
        "test",
        configPath,
        "--reporter",
        "json",
      ], { cwd: repoRoot }),
    ).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining('"passed": false'),
    });
  });
});

async function writeBadConfig(): Promise<string> {
  const raw = yaml.load(await fs.readFile(CONFIG_PATH, "utf8")) as any;
  raw.tests[0].expect.response.body.count = 99;
  raw.plugins[0].path = path.resolve(CONFIG_DIR, "../../../plugins/rule-loom-core");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rule-loom-testing-"));
  const configPath = path.join(dir, "bad.yaml");
  await fs.writeFile(configPath, yaml.dump(raw));
  return configPath;
}
