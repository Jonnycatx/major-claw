import { randomUUID } from "node:crypto";
import type { Repository } from "@majorclaw/db";
import type { CheckpointRecord } from "@majorclaw/shared-types";
import type { EventBus } from "./eventBus.js";
import type { GatewayEvent } from "./types.js";

export class CheckpointService {
  constructor(
    private readonly repository: Repository,
    private readonly events: EventBus<GatewayEvent>
  ) {}

  create(swarmId: string, promptSnapshot?: string, state?: Record<string, unknown>): CheckpointRecord {
    const existing = this.repository.listCheckpoints(swarmId, 10000);
    const step = existing.length + 1;
    const record: CheckpointRecord = {
      id: randomUUID(),
      swarmId,
      step,
      stateJson: JSON.stringify(state ?? {}),
      createdAt: new Date().toISOString()
    };
    if (promptSnapshot?.trim()) {
      record.promptSnapshot = promptSnapshot.trim();
    }
    this.repository.addCheckpoint(record);
    this.repository.addAuditLog({
      id: randomUUID(),
      category: "checkpoint",
      action: "create",
      actor: "system",
      metadata: { swarmId, checkpointId: record.id, step },
      createdAt: new Date().toISOString()
    });
    this.events.emit({
      type: "swarm.checkpoint",
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
      payload: { swarmId, checkpointId: record.id, step }
    });
    return record;
  }

  list(swarmId: string, limit = 50): CheckpointRecord[] {
    return this.repository.listCheckpoints(swarmId, limit);
  }

  rewind(swarmId: string, checkpointId: string): CheckpointRecord {
    const checkpoint = this.repository
      .listCheckpoints(swarmId, 10000)
      .find((item) => item.id === checkpointId);
    if (!checkpoint) {
      throw new Error(`checkpoint not found: ${checkpointId}`);
    }
    this.repository.addAuditLog({
      id: randomUUID(),
      category: "checkpoint",
      action: "rewind",
      actor: "user",
      metadata: { swarmId, checkpointId },
      createdAt: new Date().toISOString()
    });
    this.events.emit({
      type: "swarm.rewind",
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
      payload: { swarmId, checkpointId }
    });
    return checkpoint;
  }
}
