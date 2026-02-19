# Release Checklist

## Pre-Release

- Run `pnpm typecheck`, `pnpm test`, and `pnpm lint`.
- Run integration scenarios against a local OpenClaw instance.
- Complete 24h soak test checklist in `scripts/soak-test-checklist.md`.
- Validate DB migrations from clean install and upgrade path.
- Generate/update updater signing keys if needed:
  - `pnpm --filter @majorclaw/desktop-tauri exec tauri signer generate --ci -w .tauri/release.key -p "<strong-password>"`
  - Save private key content to `TAURI_SIGNING_PRIVATE_KEY`
  - Save matching public key to `TAURI_UPDATER_PUBLIC_KEY`

## Packaging

- Build Tauri artifacts for macOS, Windows, and Linux.
- Sign installers with platform-specific signing identities.
- Notarize macOS DMG and staple ticket.
- Verify installer opens and first-run wizard can connect instance.
- Verify installed app launched from Finder can start gateway from UI (`Start` button) and transitions from `Gateway: stopped` to running.
- Verify always-on daemon toggle can enable/start/restart gateway service from app UI.
- Ensure release secrets are set in GitHub Actions:
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  - `TAURI_UPDATER_PUBLIC_KEY`
  - macOS signing/notarization secrets (`APPLE_*`)
  - Windows signing secrets (`CODE_SIGNING_CERT*`)
  - Linux checksum signing secrets (`GPG_SIGNING_KEY*`)
- Confirm CI produces updater artifacts (`latest.json` + `.sig`) from signed builds.
- Confirm release workflow generates `SHA256SUMS` and `SHA256SUMS.asc`.
- Confirm `.github/workflows/release.yml` completes all gates before publish.

## Launch Assets

- Publish quickstart docs.
- Publish 5-minute walkthrough script.
- Add issue templates and bug report instructions.
- Follow `docs/release-process.md` for verification commands and troubleshooting.
