# Figma Handoff Spec

The environment cannot generate a native `.fig` file directly, but this spec recreates all 5 required screens with the exact visual system.

## Frame

- Size: 1728 x 1117 (desktop canvas)
- Background: `#0a0a0a`
- Overlay layer: low-opacity nebula gradients + star particles

## Regions

- Top bar: height `64`
- Left sidebar: width `280`
- Right sidebar: width `320`
- Center: flexible, tabs row + content panel

## Top Bar

- Lobster icon glow, product mark:
  - `Major Claw` (white)
  - `Mission Control` (lobster red)
- Right status strip:
  - Spend
  - Gateway (`green/red` dot)
  - Health (`cyan` dot, pulse)
  - Start/Stop outline buttons

## Shared Card Style

- Fill: `#111113`
- Border: `1px rgba(255,255,255,0.05)`
- Accent edge: `#ff3b00`
- Hover glow: `#ff3b00 @ 15%`
- Radius: `16`

## Tabs

- Labels: Overview, Kanban, Chat, Logs, Analytics
- Active state: lobster text + 2px red underline + glow

## Screen Set (5 Frames)

Create five frames that share identical shell (top bar + left + right panels):

1. `Overview`
   - KPI cards on top row
   - Hero center state with large lobster icon
   - Big red heading: `EXFOLIATE your swarm!`
2. `Kanban`
   - 5 columns: inbox, assigned, in_progress, review, done
   - Elevated task cards with red glow on hover
3. `Chat`
   - CSO messages with red left accent bar
   - Input row with route hint text
4. `Logs`
   - Monospace rows + cyan timestamps
   - Subtle scanline texture over panel
5. `Analytics`
   - Two metric cards with consistent panel style
   - Maintain same cosmic background depth

## Right Sidebar Sections

- Agent Info
- Live Logs (monospaced, cyan timestamps)
- Permissions
- Pending Approvals (left red accent + approve button)

## Empty State

- Lobster icon + message:
  - `EXFOLIATE your swarm!`
