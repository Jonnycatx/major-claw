# Release Process

This document defines the production release flow for Major Claw desktop artifacts.

## 1) Prerequisites

Set these GitHub Actions repository secrets before cutting a release tag:

- `APPLE_ID`
- `APPLE_ID_PASSWORD`
- `APPLE_TEAM_ID`
- `APPLE_CERTIFICATE` (base64 .p12)
- `APPLE_CERT_PASSWORD`
- `CODE_SIGNING_CERT` (base64 .pfx)
- `CODE_SIGNING_CERT_PASSWORD`
- `GPG_SIGNING_KEY` (base64 private key)
- `GPG_SIGNING_KEY_PASSWORD`
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `TAURI_UPDATER_PUBLIC_KEY`

## 2) Cut a Release

1. Ensure `main` is green.
2. Tag and push:
   - `git tag v1.0.0`
   - `git push origin v1.0.0`
3. GitHub Actions runs `.github/workflows/release.yml`.

## 3) Release Gates

The release workflow enforces:

- Quality gates:
  - `pnpm typecheck`
  - `pnpm test`
  - `E2E_REQUIRE_RUNTIME=true pnpm e2e:critical`
- Cross-platform build:
  - macOS, Windows, Linux bundles
- Platform signing:
  - macOS certificate signing + notarization + stapling
  - Windows code signing (`signtool`)
- Integrity:
  - `SHA256SUMS` generated for all release assets
  - `SHA256SUMS` detached GPG signature (`SHA256SUMS.asc`)
- Updater safety:
  - release fails if `latest.json` or updater `.sig` artifacts are missing

If any gate fails, publish is blocked.

## 4) Manual Verification Checklist

After release completes:

1. Download artifact and checksum files from GitHub Release.
2. Verify checksums:
   - `sha256sum -c SHA256SUMS`
3. Verify checksum signature:
   - `gpg --verify SHA256SUMS.asc SHA256SUMS`
4. macOS notarization sanity:
   - `spctl -a -vv -t install <artifact.dmg>`
5. Smoke install each target (macOS primary, Windows/Linux if available).

## 5) Troubleshooting

- **Notarization fails**: verify `APPLE_ID*` credentials and team ID; retry workflow.
- **Windows signing fails**: verify PFX encoding and password.
- **Missing updater files**: ensure Tauri updater keys are present and build step produced `latest.json` + `.sig`.
- **GPG signing fails**: verify base64 key format and passphrase.

