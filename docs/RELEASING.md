# Releasing Major Claw

This guide is the canonical release runbook for Major Claw desktop builds.

## 1) Required GitHub Secrets

Set these in repository settings before tagging:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `TAURI_UPDATER_PUBLIC_KEY`
- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_ID_PASSWORD`
- `APPLE_TEAM_ID`
- `WINDOWS_CERTIFICATE`
- `WINDOWS_CERTIFICATE_PASSWORD`

## 2) Tag Conventions

- Stable: `vX.Y.Z` (example: `v0.1.0`)
- Pre-release: `vX.Y.Z-beta.N` or `vX.Y.Z-rc.N` (example: `v0.1.0-beta.1`)

The tag triggers `.github/workflows/tauri-release.yml`.

## 3) Create and Push a Release Tag

```bash
git checkout main
git pull origin main
git tag v0.1.0-beta.1
git push origin v0.1.0-beta.1
```

## 4) What the Workflow Produces

- macOS: `.dmg` / `.app`
- Windows: `.msi` / `.exe`
- Linux: `.AppImage` (and additional native formats if configured)

The workflow creates a **draft GitHub release** and marks it as:

- pre-release when tag contains `-` (beta/rc tags)
- stable when tag has no suffix

## 5) Verify Before Publishing Draft

- Artifacts exist for all target OS jobs.
- Installer opens and app launches.
- In app UI, gateway can be started (`Gateway: stopped` -> running).
- Critical-path checks are green in CI for the target commit.

## 6) Publish

Open the generated draft release in GitHub, review notes and assets, then publish.
