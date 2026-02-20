# Major Claw

Major Claw is a local-first mission control app for hierarchical OpenClaw agents.

Security Review: Passed (P0 #3 strict input validation + secret redaction audit)

## What Ships Today

Major Claw includes these primary operator surfaces:

- `Overview`: system pulse, quick vault actions, high-signal status cards.
- `Warroom`: high-priority execution panel for active operations.
- `Kanban`: task lifecycle, bulk actions, drag/drop status flow.
- `Chat`: CSO-led delegation and swarm command workflow.
- `Logs`: operational timeline and runtime event visibility.
- `Analytics`: trend lines, per-agent deltas, budget forecasting.
- `Health`: live telemetry timeline + SSE connectivity status.
- `Integrations`: provider/connectivity management and assignment.
- `Marketplace`: ClawHub skill discovery, install, and assignment.

## Workspace Layout

- `apps/desktop-web`: React mission control shell
- `apps/desktop-tauri`: Tauri host boundary
- `services/gateway`: orchestration + OpenClaw WS bridge
- `packages/shared-types`: shared contracts
- `packages/router`: model routing and fallback
- `packages/db`: schema, migrations, repository APIs

## First 5 Minutes (Installed App)

1. Launch `Major Claw.app`.
2. Confirm gateway status in header; if stopped, click `Start`.
3. Open right panel and enable Always-On Service if you want 24/7 background runtime.
4. Verify Health tab shows telemetry updates and gateway heartbeat.
5. Create or import your first tasks/agents and confirm execution in Kanban + Chat.

## Quick Start

1. Copy `.env.example` to `.env.local`.
2. Copy `.majorclaw.instances.example.json` to `.majorclaw.instances.json` and set your local OpenClaw endpoint.
3. Install dependencies with `pnpm install`.
4. Run `pnpm dev:all`.
5. Optional demo seeding in dev only: run with `VITE_SEED_DATA=true` to preload sample tasks.

## Vault & Memory

The Vault is the persistent memory backbone for Major Claw.

- **Entry types:** archive, file, and knowledge records tied to agents/tasks.
- **Core actions:** deposit, recent activity feed, search, metadata updates, and version history.
- **Versioning:** each entry can produce new revisions (`vault_create_version`) with change context.
- **Storage intelligence:** usage/capacity telemetry, warning thresholds, and storage relocation support.
- **Operational controls:** prune low-importance content to control growth and retain high-signal memory.
- **Security/governance:** vault actions flow through permissions + audit timeline and support encrypted storage flags.

### Vault Quick Ops (24/7)

- Check capacity and warning level daily in Overview/Health.
- Prune low-importance entries when growth accelerates.
- Relocate storage before critical capacity thresholds.
- Review version history before destructive edits.
- Track all vault mutations via audit logs.

## Quality Gates

- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
- `pnpm e2e:critical` (critical-path runtime suite)
- `pnpm security:smoke` (gateway validation + secret redaction checks)
- `pnpm compat:openclaw` (local contract baseline check)
- `pnpm compat:openclaw:pinned` (deterministic required CI compatibility gate)
- `pnpm compat:openclaw:latest` (robust latest-main multi-source drift signal)
- `pnpm compat:check` (non-interactive drift check against latest baseline candidates)
- `pnpm compat:refresh` (interactive baseline refresh helper; writes only on explicit apply)
- `pnpm compat:strict` (strict non-interactive drift check; exits non-zero on drift)
- `pnpm compat:refresh:dry-run` (machine-readable JSON drift report; non-blocking)

## Runtime APIs (Gateway)

Representative operator-facing APIs:

- `GET /telemetry/snapshot`, `GET /telemetry/events`, `GET /telemetry/stream`, `GET /telemetry/export`
- `GET /analytics/snapshot`, `GET /analytics/export`
- `GET /vault/summary`, `GET /vault/recent`, `GET /vault/search`, `GET /vault/storage/info`
- `GET /clawhub/live`, `POST /clawhub/install`, `GET /integrations/all`
- `GET /tasks`, `POST /tasks/create`, `PATCH /tasks/:id`, `DELETE /tasks/:id`
- `GET /agents`, `POST /agents/create`, `PATCH /agents/:id/config`

## Desktop Security & Packaging

- Tauri config lives in `apps/desktop-tauri/src-tauri/tauri.conf.json` with strict CSP and production bundle targets (`dmg`, `msi`, `appimage`).
- Cross-platform app icons are generated in `apps/desktop-tauri/src-tauri/icons` from `source-icon.svg`.
- Release CI is defined in `.github/workflows/tauri-release.yml` and expects signing secrets for macOS/Windows plus updater secrets (`TAURI_SIGNING_PRIVATE_KEY*`, `TAURI_UPDATER_PUBLIC_KEY`).
- Updater is enabled and CI injects the release public key before build. Keep placeholder pubkey in git, and set the real key via secrets.

### Local Release Build

- `pnpm --filter @majorclaw/desktop-web build`
- `pnpm --filter @majorclaw/desktop-tauri tauri build`

## 24/7 Daemon Lifecycle

- Gateway now supports graceful shutdown via `POST /system/shutdown` (drains in-flight requests, checkpoints SQLite WAL, releases PID lock, then exits).
- Tauri stop/Red Phone paths request graceful shutdown first, then force-kill as fallback.
- Gateway PID lock is stored at `~/.major-claw/run/gateway.pid` to prevent orphan duplicate instances.
- On desktop window close, Tauri performs graceful gateway stop before final app exit.
- Service templates are provided for always-on environments:
  - macOS launchd: `ops/launchd/com.jonnycatx.major-claw.gateway.plist`
  - Linux systemd: `ops/systemd/major-claw-gateway.service`
  - Windows NSSM helper: `ops/windows/install-gateway-service.ps1`
- Desktop gateway startup now resolves `pnpm` using local workspace and common absolute paths (`/opt/homebrew/bin/pnpm`, `/usr/local/bin/pnpm`) to avoid Finder/PATH startup failures in installed macOS app launches.

## Observability + Analytics

- Health dashboard is backed by structured lifecycle telemetry with:
  - snapshot API: `GET /telemetry/snapshot`
  - event feed API: `GET /telemetry/events`
  - export API: `GET /telemetry/export`
  - SSE stream: `GET /telemetry/stream` (supports `Last-Event-ID` replay)
- Analytics tab provides actionable operator metrics:
  - trend lines (`7d`, `30d`, `90d`)
  - per-agent deltas (tokens/spend/task activity)
  - budget forecasts + risk tiers
  - recommendations + exports (JSON, CSV, print/PDF)
- Gateway analytics APIs:
  - `GET /analytics/snapshot?range=7d|30d|90d`
  - `GET /analytics/export?range=...&format=json|csv`

## Troubleshooting

- If header shows `Gateway: stopped (:4455)` in installed app:
  1. click `Start` in top bar
  2. verify local gateway process on port `4455`
  3. enable Always-On Service in the right panel for auto-boot behavior
- If repeated toast errors appear, use `Clear all`; duplicate errors are deduped and shown with a repeat counter.
- If vault errors repeat while gateway is stopped, start gateway first; vault version/list calls require active runtime.

## Configuration Notes

- `MAJORCLAW_GATEWAY_SESSION_TOKEN`: gateway request auth token (Tauri/gateway boundary).
- `OPENCLAW_COMPAT_REQUIRE_REMOTE`: strict compatibility enforcement mode in CI.
- `OPENCLAW_COMPAT_REMOTE_TIMEOUT_MS`: timeout for remote compatibility checks.
- `VITE_SEED_DATA=true`: optional dev/demo seed data mode.
- `E2E_REQUIRE_RUNTIME=true`: fail E2E when runtime dependencies are unavailable.

## Testing Guide

- Critical-path suite config: `e2e/config/playwright.config.ts`
- Critical-path specs: `e2e/tests`
- Setup/extension guide: `docs/testing.md`
- Runtime preflight doctor: `pnpm e2e:doctor`

## Release Hardening

- Tag-driven release workflow: `.github/workflows/tauri-release.yml`
- Manual hardened release workflow: `.github/workflows/release.yml` (`workflow_dispatch` only)
- Release verification and operations guide: `docs/release-process.md`
- Operator release runbook: `docs/RELEASING.md`

## Documentation Map

- Architecture: `docs/architecture.md`
- Security checklist: `docs/security-review-checklist.md`
- Testing and E2E: `docs/testing.md`
- Release process: `docs/release-process.md`
- Release runbook: `docs/RELEASING.md`

## Current Beta Notes

- Pre-release workflow currently targets beta tags for rapid iteration.
- Always-On daemon behaviors should still be validated per OS in real host environments.
- For production rollout, keep signing/notarization secrets complete and verified before publishing draft releases.
