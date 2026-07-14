# rule-loom-plugin-ai

Provider-neutral AI workflow closures for RuleLoom.

## Closures

| Closure | Purpose |
| --- | --- |
| `ai.generate` | Generate text or JSON with a configured provider. |
| `ai.extract` | Extract structured JSON from text/state using a schema. |
| `ai.classify` | Classify input into a constrained label set. |
| `ai.embed` | Generate embeddings for one or more strings. |

## Providers

- `mock`: deterministic local provider for tests, demos, and simulation.
- `openai`: OpenAI-backed provider. Pass `apiKey` from runner secrets or another resolved value.

## Example

```yaml
plugins:
  - source: file
    path: plugins/rule-loom-plugin-ai
flows:
  - name: classify-ticket
    steps:
      - closure: ai.classify
        assign: ai.ticket
        parameters:
          provider: mock
          input: ${state.request.body.message}
          labels: [billing, bug, sales, other]
      - closure: ai.extract
        assign: ai.details
        parameters:
          provider: mock
          input: ${state.request.body.message}
          schema:
            type: object
            properties:
              priority:
                type: string
                enum: [low, medium, high]
              summary:
                type: string
            required: [priority, summary]
```
