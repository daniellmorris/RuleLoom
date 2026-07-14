# rule-loom-testing

`rule-loom-testing` runs declarative tests embedded in RuleLoom YAML. It loads the normal runner, executes in safe simulation mode, installs closure mocks, records a full trace, and evaluates partial state/output expectations.

## CLI

```bash
npx ruleloom-testing test config.yaml
npx ruleloom-testing test config.yaml --reporter json
npx ruleloom-testing test config.yaml --reporter tap
```

The command exits non-zero when a test or configuration fails.

## YAML shape

```yaml
tests:
  - name: returns a greeting
    flow: greet
    state:
      user: Ada
    mocks:
      - name: external.lookup
        id: lookup-user
        when:
          userId: ada
        output:
          tier: pro
        patchAfter:
          profile.loaded: true
    expect:
      match: partial # use exact to require complete object equality
      nodes:
        - id: lookup-user
          output:
            tier: pro
      state:
        profile:
          loaded: true
      response:
        status: 200
```

Mocks can return `output`, return successive values with `sequence`, throw an `error`, patch state before/after execution, or use `passthrough`. Passthrough is rejected for side-effect closures during simulation.

## JavaScript API

```ts
import { runYamlTests } from 'rule-loom-testing';

const result = await runYamlTests({ configPath: 'config.yaml' });
if (!result.passed) process.exitCode = 1;
```

Object expectations are partial recursive matches; arrays and scalar values are exact. Failure objects include expected/actual values and recorder traces.
