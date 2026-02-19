# Major Claw Architecture

## Runtime Boundaries

- `apps/desktop-tauri`: native host shell and secure command boundary.
- `apps/desktop-web`: mission control interface.
- `services/gateway`: OpenClaw WebSocket integration, normalization, orchestration API, telemetry stream, analytics query layer.
- `packages/db`: schema, migrations, repositories.
- `packages/router`: per-agent model routing and fallback policy.
- `packages/shared-types`: shared contracts across all modules.

## Data Flow

1. Gateway loads local instance registry.
2. Connection manager discovers and connects to OpenClaw processes.
3. Inbound events are normalized and emitted through the event bus.
4. Telemetry service records lifecycle/security/runtime signals, provides snapshot + historical APIs, and streams SSE updates.
5. Analytics service aggregates repository and telemetry data into trend/delta/forecast snapshots.
6. UI consumes event snapshots for hierarchy, kanban, chat, logs, health, and analytics.
7. Repository persists state and emits audit-friendly records.
