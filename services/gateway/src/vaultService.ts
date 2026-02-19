import { randomUUID } from "node:crypto";
import { mkdir, statfs, access } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { Repository } from "@majorclaw/db";
import type {
  VaultEntry,
  VaultStorageInfo,
  VaultStorageStats,
  VaultStorageWarningLevel,
  VaultSummary,
  VaultVersion,
  VaultEntryType
} from "@majorclaw/shared-types";
import type { EventBus } from "./eventBus.js";
import type { GatewayEvent } from "./types.js";

type DepositInput = {
  type: VaultEntryType;
  title: string;
  markdownSummary: string;
  importanceScore?: number;
  tags?: string[];
  agentId: string;
  taskId?: string;
  encrypted?: boolean;
};

export class VaultService {
  private rootPath = join(homedir(), "Library", "Application Support", "com.jonnycatx.major-claw", "vault");
  private readonly tempCachePath = join(tmpdir(), "major-claw-vault-cache");
  private isOfflineFallback = false;

  constructor(
    private readonly repository: Repository,
    private readonly events: EventBus<GatewayEvent>
  ) {
    void this.ensurePath(this.rootPath);
  }

  summary(): VaultSummary {
    return this.repository.vaultSummary(128);
  }

  capacity(): VaultStorageStats {
    const summary = this.summary();
    const archiveGb = Number((summary.archivedItems * 0.006).toFixed(3));
    const filesGb = Number((summary.fileItems * 0.02).toFixed(3));
    const stat: VaultStorageStats = {
      snapshotTime: new Date().toISOString(),
      archiveGb,
      filesGb,
      totalGb: summary.capacityGb,
      freeGb: Number((summary.capacityGb - summary.usedGb).toFixed(3))
    };
    this.repository.addStorageStat(stat);
    return stat;
  }

  async storageInfo(): Promise<VaultStorageInfo> {
    const summary = this.summary();
    const primary = await this.inspectPath(this.rootPath);
    if (primary) {
      this.isOfflineFallback = false;
      return {
        ...primary,
        vaultUsedGb: summary.usedGb,
        warningLevel: this.warningLevel(summary.usedGb, primary.totalGb),
        isOfflineFallback: false,
        updatedAt: new Date().toISOString()
      };
    }
    await this.ensurePath(this.tempCachePath);
    const fallback = await this.inspectPath(this.tempCachePath);
    this.isOfflineFallback = true;
    if (!fallback) {
      return {
        rootPath: this.tempCachePath,
        volumeName: "Temporary Cache",
        totalGb: 0,
        freeGb: 0,
        vaultUsedGb: summary.usedGb,
        isExternal: false,
        isNetwork: false,
        warningLevel: "critical_95",
        isOfflineFallback: true,
        tempCachePath: this.tempCachePath,
        updatedAt: new Date().toISOString()
      };
    }
    return {
      ...fallback,
      vaultUsedGb: summary.usedGb,
      warningLevel: this.warningLevel(summary.usedGb, fallback.totalGb),
      isOfflineFallback: true,
      tempCachePath: this.tempCachePath,
      updatedAt: new Date().toISOString()
    };
  }

  async relocate(nextPath: string, moveExisting: boolean): Promise<VaultStorageInfo> {
    const target = nextPath.trim();
    if (!target) {
      throw new Error("vault path is required");
    }
    await this.ensurePath(target);
    const previous = this.rootPath;
    this.rootPath = target;
    this.repository.addAuditLog({
      id: randomUUID(),
      category: "vault",
      action: "relocate",
      actor: "user",
      metadata: { from: previous, to: target, moveExisting },
      createdAt: new Date().toISOString()
    });
    this.events.emit({
      type: "vault.relocated",
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
      payload: { from: previous, to: target, moveExisting }
    });
    return this.storageInfo();
  }

  recent(limit = 40): VaultEntry[] {
    return this.repository.listVaultEntries(limit);
  }

  search(query: string, limit = 40): VaultEntry[] {
    return this.repository.searchVaultEntries(query, limit);
  }

  recallForContext(query: string, limit = 5, minImportance = 7): VaultEntry[] {
    const hits = this.repository.searchVaultEntries(query, 40);
    const lowered = query.trim().toLowerCase();
    const scored = hits
      .filter((entry) => entry.importanceScore >= minImportance)
      .map((entry) => {
        let score = entry.importanceScore * 10;
        if (entry.type === "kb") {
          score += 12;
        } else if (entry.type === "archive") {
          score += 6;
        }
        if (lowered && (entry.title.toLowerCase().includes(lowered) || entry.tags.some((tag) => tag.toLowerCase().includes(lowered)))) {
          score += 8;
        }
        return { entry, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.entry);
    if (scored.length >= limit) {
      return scored;
    }
    const fallback = this.repository
      .listVaultEntries(80)
      .filter((entry) => entry.importanceScore >= minImportance)
      .filter((entry) => !scored.some((item) => item.id === entry.id))
      .slice(0, limit - scored.length);
    return [...scored, ...fallback];
  }

  versions(entryId: string): VaultVersion[] {
    return this.repository.listVaultVersions(entryId);
  }

  deposit(input: DepositInput): VaultEntry {
    const entry: VaultEntry = {
      id: `vault_${randomUUID().slice(0, 12)}`,
      type: input.type,
      title: input.title.trim(),
      markdownSummary: input.markdownSummary.trim(),
      importanceScore: Math.max(1, Math.min(10, Number(input.importanceScore ?? 7))),
      tags: input.tags?.length ? input.tags : [],
      agentId: input.agentId,
      version: 1,
      createdAt: new Date().toISOString(),
      encrypted: Boolean(input.encrypted),
      blobPath: `~/.major-claw/vault/swarm_main/${new Date().toISOString().slice(0, 7)}/${input.type}/${randomUUID().slice(0, 8)}.md`
    };
    if (input.taskId) {
      entry.taskId = input.taskId;
    }
    this.repository.upsertVaultEntry(entry);
    const version: VaultVersion = {
      entryId: entry.id,
      versionNum: 1,
      diff: "initial",
      createdAt: entry.createdAt
    };
    if (entry.blobPath) {
      version.blobPath = entry.blobPath;
    }
    this.repository.addVaultVersion(version);
    this.repository.addAuditLog({
      id: randomUUID(),
      category: "vault",
      action: "deposit",
      actor: input.agentId,
      metadata: { entryId: entry.id, type: entry.type, importanceScore: entry.importanceScore },
      createdAt: new Date().toISOString()
    });
    this.events.emit({
      type: "vault.deposited",
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
      payload: { entryId: entry.id }
    });
    return entry;
  }

  updateEntry(
    entryId: string,
    patch: {
      title?: string;
      markdownSummary?: string;
      importanceScore?: number;
      tags?: string[];
      encrypted?: boolean;
    }
  ): VaultEntry {
    const entry = this.repository.updateVaultEntry(entryId, patch);
    this.repository.addAuditLog({
      id: randomUUID(),
      category: "vault",
      action: "update_entry",
      actor: entry.agentId,
      metadata: { entryId, importanceScore: entry.importanceScore, tags: entry.tags },
      createdAt: new Date().toISOString()
    });
    return entry;
  }

  createVersion(
    entryId: string,
    input: {
      markdownSummary?: string;
      blobPath?: string;
      diff?: string;
      importanceScore?: number;
      tags?: string[];
    }
  ): VaultVersion {
    const current = this.repository.getVaultEntry(entryId);
    if (!current) {
      throw new Error(`vault entry not found: ${entryId}`);
    }
    const latestVersion = Math.max(0, ...this.repository.listVaultVersions(entryId).map((item) => item.versionNum));
    const nextVersionNum = latestVersion + 1;
    const nextBlob = input.blobPath ?? current.blobPath;
    const version: VaultVersion = {
      entryId,
      versionNum: nextVersionNum,
      diff: input.diff ?? "manual revision",
      createdAt: new Date().toISOString()
    };
    if (nextBlob) {
      version.blobPath = nextBlob;
    }
    this.repository.addVaultVersion(version);
    const patch: {
      markdownSummary?: string;
      importanceScore?: number;
      tags?: string[];
      blobPath?: string;
    } = {};
    if (input.markdownSummary !== undefined) {
      patch.markdownSummary = input.markdownSummary;
    }
    if (input.importanceScore !== undefined) {
      patch.importanceScore = input.importanceScore;
    }
    if (input.tags !== undefined) {
      patch.tags = input.tags;
    }
    if (nextBlob !== undefined) {
      patch.blobPath = nextBlob;
    }
    const updated = this.repository.updateVaultEntry(entryId, patch);
    updated.version = nextVersionNum;
    this.repository.upsertVaultEntry(updated);
    this.repository.addAuditLog({
      id: randomUUID(),
      category: "vault",
      action: "new_version",
      actor: updated.agentId,
      metadata: { entryId, version: nextVersionNum, diff: version.diff },
      createdAt: new Date().toISOString()
    });
    this.events.emit({
      type: "vault.versioned",
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
      payload: { entryId, version: nextVersionNum }
    });
    return version;
  }

  prune(maxImportance = 3): { removed: number } {
    const pruned = this.repository.pruneVault(maxImportance);
    this.repository.addAuditLog({
      id: randomUUID(),
      category: "vault",
      action: "prune",
      actor: "system",
      metadata: { maxImportance, removed: pruned.removed },
      createdAt: new Date().toISOString()
    });
    this.events.emit({
      type: "vault.pruned",
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
      payload: pruned
    });
    return pruned;
  }

  private async ensurePath(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  private async inspectPath(path: string): Promise<Omit<VaultStorageInfo, "vaultUsedGb" | "warningLevel" | "isOfflineFallback" | "tempCachePath" | "updatedAt"> | null> {
    try {
      await access(path);
      const stats = await statfs(path);
      const totalBytes = Number(stats.blocks) * Number(stats.bsize);
      const freeBytes = Number(stats.bavail) * Number(stats.bsize);
      const totalGb = Number((totalBytes / (1024 ** 3)).toFixed(2));
      const freeGb = Number((freeBytes / (1024 ** 3)).toFixed(2));
      const normalized = path.replaceAll("\\", "/");
      const isExternal = normalized.startsWith("/Volumes/");
      const isNetwork = isExternal && /(nas|smb|afp|network)/i.test(normalized);
      const volumeName = isExternal ? normalized.split("/")[2] ?? "External Volume" : "Local System Volume";
      return {
        rootPath: path,
        volumeName,
        totalGb,
        freeGb,
        isExternal,
        isNetwork
      };
    } catch {
      return null;
    }
  }

  private warningLevel(usedGb: number, totalGb: number): VaultStorageWarningLevel {
    if (totalGb <= 0) {
      return "critical_95";
    }
    const ratio = usedGb / totalGb;
    if (ratio >= 0.95) {
      return "critical_95";
    }
    if (ratio >= 0.85) {
      return "warning_85";
    }
    if (ratio >= 0.7) {
      return "warning_70";
    }
    return "normal";
  }
}
