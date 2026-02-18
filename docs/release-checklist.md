# Release Checklist

## Pre-Release

- Run `pnpm typecheck`, `pnpm test`, and `pnpm lint`.
- Run integration scenarios against a local OpenClaw instance.
- Complete 24h soak test checklist in `scripts/soak-test-checklist.md`.
- Validate DB migrations from clean install and upgrade path.

## Packaging

- Build Tauri artifacts for macOS, Windows, and Linux.
- Sign installers with platform-specific signing identities.
- Verify installer opens and first-run wizard can connect instance.

## Launch Assets

- Publish quickstart docs.
- Publish 5-minute walkthrough script.
- Add issue templates and bug report instructions.
