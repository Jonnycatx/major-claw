# Security Review Checklist (P0 #3)

Status: complete
Scope: `services/gateway` mutating routes + secret handling paths

## Input Validation (Schema-First)

- Added strict schema module at `services/gateway/src/validation.ts`.
- All mutating gateway routes now parse body payloads with `parseWithSchema(...)` and return `422 ValidationError` on invalid input.
- Path IDs used by mutating routes now pass through `parseRouteId(...)` for format and bounds checks.
- Validation failures are normalized through `RequestValidationError` and surfaced as consistent API errors.

## Secret Handling Audit

- Replaced base64-only secret storage with authenticated encryption (AES-256-GCM) in `services/gateway/src/secretStore.ts`.
- API keys are stored as opaque references in repository state; raw key material is not persisted in gateway DB rows.
- Session token remains process-memory only and is never returned by API responses.
- Added centralized redaction helpers in `services/gateway/src/securityRedaction.ts` to scrub sensitive key/token/password patterns.
- Request/error logging now runs through redaction before write.

## OpenClaw Compatibility

- Added automated compatibility guards:
  - `scripts/openclaw-compat-check.mjs` (local + deterministic pinned baseline)
  - `scripts/check-openclaw-compat-latest.mjs` (robust multi-source latest probe)
- Added baseline refresh helper:
  - `scripts/refresh-openclaw-baseline.mjs` with `--check`, `--apply`, and `--strict` modes.
  - Interactive prompt only in TTY local mode; CI remains non-interactive.
- Baseline and source candidates stored in `docs/openclaw-compat-baseline.json`.
- CI required gate: `openclaw-compat-pinned` (deterministic baseline).
- CI advisory signal: `openclaw-compat-latest` (`continue-on-error: true`).
- Scheduled drift monitor: `.github/workflows/openclaw-drift.yml` (daily + manual trigger).

## Evidence

- Validation and route enforcement:
  - `services/gateway/src/server.ts`
  - `services/gateway/src/validation.ts`
- Secret encryption + opaque references:
  - `services/gateway/src/secretStore.ts`
  - `services/gateway/src/agentManager.ts`
- Redaction:
  - `services/gateway/src/securityRedaction.ts`
  - `services/gateway/src/server.ts`
- Security tests:
  - `services/gateway/src/server.security.validation.test.ts`
  - `services/gateway/src/securityRedaction.test.ts`
- Compatibility check:
  - `scripts/openclaw-compat-check.mjs`
  - `scripts/check-openclaw-compat-latest.mjs`
  - `scripts/refresh-openclaw-baseline.mjs`
  - `.github/workflows/ci.yml` (`openclaw-compat-pinned`, `openclaw-compat-latest`)
  - `.github/workflows/openclaw-drift.yml`

