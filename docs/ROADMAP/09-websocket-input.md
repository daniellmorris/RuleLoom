# WebSocket client input

## Overview
Add a WebSocket **client** input plugin that connects to an upstream server, consumes the stream, and routes messages into flows. Optionally allows sending messages back over the established client connection.

## Theory / Intent
Treat upstream WS streams as inputs (market data, event buses, notifications) without hosting a server. Keeps RuleLoom as a consumer/processor while still enabling responses when supported.

## Implementation Plan
- Plugin config: `url`, optional headers/auth/token, subprotocols, reconnect/backoff strategy, message schema, optional ping interval.
- Runtime/state seed per message: `state.request.ws = { url, message, headers, meta: { receivedAt, attempt, connectionId } }`.
- Flow routing: triggers decide target flow (e.g., fixed flow per input, or by message field/pattern).
- Outbound closure: `core.ws-send` (or similar) to send a message on the existing connection (or by connectionId if multiplexed).
- Reconnect & resilience: exponential backoff, max retries, surfacing connection status in metrics/events.
- Simulation: simulator can inject WS messages without opening a socket; reuse recorder for traces.
- UI: input editor for WS client config; simulator tab to “send” a mock message; display connection status (connected/reconnecting/error).

## Code Touchpoints
- `rule-loom-core/inputs`: new `websocket-client` input with connect/recv loop and optional send helper.
- `rule-loom-runner`: manage lifecycle, reconnection, and graceful shutdown; emit events/metrics for connection state.
- Catalog manifest: add config/trigger parameters and outbound closure metadata.
- UI: input config form, simulator message sender, status indicator.

## Acceptance Criteria
- Runner can connect to a configured WS endpoint, receive messages, and dispatch them to flows with runtime/ws context populated.
- Handles reconnect with backoff; surfaces errors/status via logs/events.
- Supports optional outbound send via a closure when upstream allows.
- Simulator injects a message without real network and produces a recorder trace.

## Code Cleanliness
- Isolate WS client logic behind a small interface; avoid leaking WS library details into engine/UI.
- Ensure reconnection/backoff is centralized; no ad-hoc retry loops per trigger.
- Keep message->flow routing declarative in config/manifest, not hardcoded in code.
