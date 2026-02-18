# Major Claw Component Library

This file documents the reusable UI building blocks shipped in the redesign.

## Core Components

- `TopBar` (`src/components/TopBar.tsx`)
  - Brand lockup, spend, gateway status, health status, start/stop controls.
- `HierarchyPanel` (`src/components/HierarchyPanel.tsx`)
  - Left tree panel with CSO badge, online/degraded indicator, active node styling.
- `CenterPanel` (`src/components/CenterPanel.tsx`)
  - Tabs + primary content: Overview, Kanban, Chat, Logs, Analytics.
- `RightPanel` (`src/components/RightPanel.tsx`)
  - Agent info, live logs, permissions, and approval queue cards.
- `PanelCard` (`src/components/ui/PanelCard.tsx`)
  - Shared elevated card with lobster accent border + hover glow.

## Visual Tokens

- Background: `void` (`#0a0a0a`)
- Primary accent: `lobster` (`#ff3b00`)
- Secondary accent: `cyan` (`#00f0ff`)
- Text: `text.primary` (`#f1f1f1`), `text.secondary` (`#a1a1aa`)
- Card/panel: `panel` (`#111113`)

## Motion

- `duration-200` for controls and cards
- Hover scale: `1.02`
- Live pulse: `animate-live`
- Subtle nebula drift on background: `.starfield`
