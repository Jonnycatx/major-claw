# Critical-Path Test Suite

This project includes a critical-path E2E suite focused on the highest-risk runtime journeys.

## Run Locally

- Install deps: `pnpm install`
- Run environment preflight: `pnpm e2e:doctor`
- Run full critical suite: `pnpm e2e:critical`
- Run all playwright tests: `pnpm e2e`
- Open HTML report: `npx playwright show-report playwright-report`
- Enforce hard runtime requirement (no skip on bind failure): `E2E_REQUIRE_RUNTIME=true pnpm e2e:critical`

## What It Covers

The suite lives in `e2e/tests` and currently validates these critical paths:

1. Kanban CRUD + bulk flows
2. Permissions request/approve/deny
3. Red Phone audit + lifecycle shutdown/restart
4. Vault deposit/search/versioning
5. Marketplace install assignment path
6. Onboarding (agent creation path)
7. Agent hierarchy create/update/reorder
8. Integrations connect + assign
9. Official catalog data contract
10. Daemon restart + orphan prevention (PID lock)
11. Health dashboard observability (telemetry endpoints, SSE realtime/replay)
12. Actionable analytics (snapshot trends/deltas/forecasts, export contracts)

## Test Architecture

- Runner: `@playwright/test`
- Config: `e2e/config/playwright.config.ts`
- Fixtures: `e2e/fixtures`
- One test file per critical path (fast to extend)
- Report artifacts: HTML report + traces/screenshots/videos on failure

## Add a New Critical Test (< 15 minutes)

1. Copy an existing file in `e2e/tests/`.
2. Use the `GatewayHarness` fixture (`../fixtures/criticalTest`) for authenticated API flow.
3. Add `@critical` to the test title to include it in CI job.
4. Run `pnpm e2e:critical` locally before pushing.

## CI

- Workflow: `.github/workflows/ci.yml`
- Job: `e2e-critical` (macOS)
- Uploads `playwright-report` and `test-results/playwright` artifacts on every run.
- CI sets `E2E_REQUIRE_RUNTIME=true` so critical tests fail if runtime prerequisites are unavailable.

