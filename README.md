# Major Claw

Major Claw is a local-first mission control app for hierarchical OpenClaw agents.

Security Review: Passed (P0 #3 strict input validation + secret redaction audit)

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
5. Optional demo seeding in dev only: run with `VITE_SEED_DATA=true` to preload sample tasks.

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

## Testing Guide

- Critical-path suite config: `e2e/config/playwright.config.ts`
- Critical-path specs: `e2e/tests`
- Setup/extension guide: `docs/testing.md`
- Runtime preflight doctor: `pnpm e2e:doctor`

## Release Hardening

- Tag-driven hardened release workflow: `.github/workflows/release.yml`
- Legacy manual workflow: `.github/workflows/tauri-release.yml` (`workflow_dispatch` only)
- Release verification and operations guide: `docs/release-process.md`
