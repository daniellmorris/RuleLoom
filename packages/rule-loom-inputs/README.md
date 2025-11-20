# rule-loom-inputs

`rule-loom-inputs` hosts the concrete input adapters used by the RuleLoom runner and orchestrator. Each input encapsulates how external events enter the system (HTTP routes, Bree-backed scheduler, future AMQP/MQTT transports) without coupling the runner core to specific transport details.

## Exposed Inputs

- **HTTP (`createHttpInputApp`)** – builds an Express application for the configured routes, wiring flow execution and structured responses.
- **Scheduler (`createSchedulerInput`)** – spins up Bree jobs and emits lifecycle events plus job state tracking.

Additional input types can live here (AMQP/MQTT/etc.) so runner/orchestrator packages only orchestrate them instead of embedding transport logic directly.
