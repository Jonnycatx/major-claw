# OpenClaw WebSocket Contract (MVP)

This document defines the Major Claw gateway contract used to communicate with local OpenClaw instances over WebSocket.

## Connection

- Transport: WebSocket
- URL format: `ws://<host>:<port>/gateway`
- Auth: optional bearer token during handshake (local-first default is disabled)
- Heartbeat: ping every 10s, timeout after 30s without pong
- Reconnect policy: exponential backoff with jitter, max 30s delay

## Envelope

All messages use this envelope:

```json
{
  "type": "task.updated",
  "timestamp": "2026-02-17T00:00:00.000Z",
  "requestId": "req_123",
  "instanceId": "claw_local_1",
  "payload": {}
}
```

## Outbound Commands (Major Claw -> OpenClaw)

- `instance.subscribe`
  - payload: `{ "topics": ["task.*", "agent.*", "chat.*", "system.*"] }`
- `task.create`
  - payload: `{ "id": "task_1", "title": "Research X", "priority": "normal", "metadata": {} }`
- `task.assign`
  - payload: `{ "taskId": "task_1", "agentId": "agent_research" }`
- `task.updateStatus`
  - payload: `{ "taskId": "task_1", "status": "in_progress" }`
- `chat.send`
  - payload: `{ "threadId": "thread_1", "from": "cso", "message": "..." }`
- `agent.invoke`
  - payload: `{ "agentId": "agent_research", "prompt": "...", "context": {} }`

## Inbound Events (OpenClaw -> Major Claw)

- `instance.ready`
  - payload: `{ "version": "x.y.z", "capabilities": ["delegation", "streaming"] }`
- `instance.heartbeat`
  - payload: `{ "uptimeSec": 1000, "cpuPct": 12.4, "memMb": 512 }`
- `task.created`
- `task.updated`
- `task.completed`
- `task.failed`
- `agent.status`
- `chat.message`
- `usage.report`
  - payload: `{ "agentId": "agent_research", "model": "local-llama3.1:8b", "promptTokens": 123, "completionTokens": 456, "costUsd": 0.0123 }`
- `error`
  - payload: `{ "code": "X", "message": "..." }`

## Canonical Task Status

- `inbox`
- `assigned`
- `in_progress`
- `review`
- `done`
- `failed`

## Versioning

- Contract version header: `x-majorclaw-contract: 1`
- Backward-compatible additions may add optional fields
- Breaking changes increment major contract version
