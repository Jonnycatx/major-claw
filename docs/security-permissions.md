# Security and Permissions

Major Claw defaults to local-first, least-privilege operation.

## Core Rules

- Deny by default for `can_write` and `can_exec`.
- New tool/skill capability requests require explicit user approval.
- Permission grants are attached to agent identity and stored in local state.
- Every approval/rejection event is written to audit logs.

## Capability Matrix

- `can_read`: read-only tool usage.
- `can_write`: file or state modification capability.
- `can_exec`: shell and process execution capability.
- `scopes`: domain constraints, such as `email.read` or `filesystem.workspace`.
