# Major Claw

Major Claw is a local-first mission control app for hierarchical OpenClaw agents.

## Workspace Layout

- `apps/desktop-web`: React mission control shell
- `apps/desktop-tauri`: Tauri host boundary
- `services/gateway`: orchestration + OpenClaw WS bridge
- `packages/shared-types`: shared contracts
- `packages/router`: model routing and fallback
- `packages/db`: schema, migrations, repository APIs

## Quick Start

1. Copy `.env.example` to `.env.local`.
2. Copy `.majorclaw.instances.example.json` to `.majorclaw.instances.json` and set your local OpenClaw endpoint.
3. Install dependencies with `pnpm install`.
4. Run `pnpm dev:all`.

## Quality Gates

- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
