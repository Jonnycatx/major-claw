# Placeholder Audit (P0 #4)

## Goal

Remove hardcoded/demo production values and replace with live repository-backed data, loading states, or actionable empty states.

## Inventory

- `apps/desktop-web/src/App.tsx`
  - Removed hardcoded spend fallback (`1.42`) in top bar and war room.
  - Moved seeded task data behind `VITE_SEED_DATA=true`.
  - Removed default draft message seed.
- `apps/desktop-web/src/components/CenterPanel.tsx`
  - Replaced static logs with real `auditTimeline` stream.
  - Replaced static analytics cards with budget snapshot data.
  - Replaced static swarm-energy copy with health-derived state.
  - Replaced permanent empty copy with actionable vault empty message.
  - Removed KB "seeded" default summary fallback (now user-provided).
- `apps/desktop-web/src/components/RightPanel.tsx`
  - Replaced fake live log lines with real audit timeline entries.
  - Replaced static permissions booleans with live permission metrics.
  - Improved installed-skills empty state to be actionable.
  - Added safe null-agent handling for first-launch/loading.
- `services/gateway/src/clawhub.ts`
  - Removed hardcoded mock skills fallback.
  - Empty cache fallback now returns `[]` / `null` instead of fake data.

## Follow-up

- Add first-class task query endpoint for Kanban/War Room lanes so these surfaces are fully persistence-backed without optional seed mode.
- Add dedicated `useSpendToday`, `useRecentVaultActivity`, and `useAuditStream` hooks to centralize loading/empty/error behavior.
