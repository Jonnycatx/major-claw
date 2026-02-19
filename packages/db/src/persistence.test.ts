import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import assert from "node:assert/strict";
import type { AgentProfile, CheckpointRecord, PermissionGrant, VaultEntry } from "@majorclaw/shared-types";
import { SqliteRuntimePersistence, createInMemoryStore, createSqliteBackedRepository } from "./index.js";

function tempDbPath(): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "majorclaw-db-test-"));
  const path = join(dir, "app.db");
  return {
    path,
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

test("persists critical runtime entities across repository restart", () => {
  const { path, cleanup } = tempDbPath();
  try {
    const seed = createInMemoryStore();
    const repoA = createSqliteBackedRepository(new SqliteRuntimePersistence(path), seed);

    const agent: AgentProfile = {
      id: "agent_test",
      name: "Test Agent",
      role: "analysis",
      modelProfileId: "local:test-model",
      status: "idle",
      parentId: "agent_cso",
      modelProvider: "local",
      modelName: "test-model",
      temperature: 0.4,
      maxTokens: 4096,
      lastHeartbeat: new Date().toISOString()
    };
    repoA.upsertAgent(agent);

    const vaultEntry: VaultEntry = {
      id: "vault_test_entry",
      type: "kb",
      title: "Durability Check",
      markdownSummary: "Persistence should survive process restart.",
      importanceScore: 9,
      tags: ["test", "durable"],
      agentId: "agent_test",
      version: 1,
      createdAt: new Date().toISOString(),
      encrypted: false
    };
    repoA.upsertVaultEntry(vaultEntry);

    const permission: PermissionGrant = {
      id: "perm_test",
      agentId: "agent_test",
      capability: "network.http",
      granted: false,
      createdAt: new Date().toISOString()
    };
    repoA.addPermission(permission);

    const checkpoint: CheckpointRecord = {
      id: "ckpt_test",
      swarmId: "swarm_main",
      step: 1,
      stateJson: JSON.stringify({ stage: "init" }),
      createdAt: new Date().toISOString()
    };
    repoA.addCheckpoint(checkpoint);

    repoA.addAuditLog({
      id: "audit_test",
      category: "test",
      action: "persist",
      actor: "suite",
      metadata: { ok: true },
      createdAt: new Date().toISOString()
    });

    // Simulate restart by constructing a new repository against same DB path.
    const repoB = createSqliteBackedRepository(new SqliteRuntimePersistence(path), createInMemoryStore());

    assert.equal(repoB.getAgent("agent_test")?.name, "Test Agent");
    assert.equal(repoB.getVaultEntry("vault_test_entry")?.title, "Durability Check");
    assert.equal(repoB.listPermissions().some((item) => item.id === "perm_test"), true);
    assert.equal(repoB.listCheckpoints("swarm_main", 10).some((item) => item.id === "ckpt_test"), true);
    assert.equal(repoB.listAuditLogs(10).some((item) => item.id === "audit_test"), true);
  } finally {
    cleanup();
  }
});
