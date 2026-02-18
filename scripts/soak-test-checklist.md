# 24h Soak Test Checklist

Run this with one gateway instance and one UI client attached.

## Setup

- Start gateway and connect at least one OpenClaw instance.
- Seed at least 50 tasks across all kanban statuses.
- Enable usage reporting and permission prompts.

## During Soak Window

- Verify heartbeat remains within expected threshold every 10 minutes.
- Trigger at least 30 delegation actions and 30 direct `@agent` messages.
- Simulate one OpenClaw disconnect and reconnection.
- Execute at least 10 permission approvals/rejections.

## Pass Criteria

- No process crashes.
- No unrecoverable WS disconnects.
- Task state transitions remain consistent.
- Logs export succeeds and contains all major events.
