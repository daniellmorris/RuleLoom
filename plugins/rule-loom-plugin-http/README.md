# rule-loom-plugin-http

Registers the `http` input and `http.request` network closure.

```yaml
plugins:
  - source: file
    path: ./plugins/rule-loom-plugin-http
inputs:
  - type: http
    id: public
    config:
      port: 3000
      basePath: /api
      runnerEndpoint:
        enabled: true
        token: "${secrets.RUNNER_TOKEN}"
        allowSimulation: false
        maxTraceEvents: 1000
        maxCallDepth: 8
    triggers:
      - method: post
        path: /orders
        flow: process-order
```

Multiple HTTP input instances can share a port. Give same-type instances unique IDs and separate base paths. The remote runner endpoint is disabled by default; enable it explicitly and use a token outside isolated local development.

`http.request` declares the `network` capability, so safe simulation blocks it unless the test installs a mock.
