# Desktop Tauri Host

This package hosts the Tauri shell for Major Claw. The Rust-side commands will expose:

- gateway lifecycle controls
- secure key storage hooks
- local filesystem-safe export/import
- app health snapshots for diagnostics

The initial implementation keeps web UI and gateway development decoupled while preserving the expected package boundary for Tauri 2.0 integration.
