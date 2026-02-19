import { randomUUID } from "node:crypto";
import type { Repository } from "@majorclaw/db";

export type TelemetrySeverity = "info" | "warning" | "critical";
export type TelemetryCategory = "lifecycle" | "gateway" | "agent" | "vault" | "error" | "system";

export type TelemetryEvent = {
  id: string;
  category: TelemetryCategory;
  severity: TelemetrySeverity;
  source: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type TelemetrySnapshot = {
  heartbeat: string;
  uptimeSeconds: number;
  gatewayStatus: "ok" | "degraded";
  activeAgents: number;
  totalAgents: number;
  errorAgents: number;
  pendingApprovals: number;
  spendTodayUsd: number;
  vaultUsedGb: number;
  vaultCapacityGb: number;
  vaultUsagePct: number;
  alerts: string[];
};

const TELEMETRY_RING_MAX = 2000;

export class TelemetryService {
  private readonly ring: TelemetryEvent[] = [];
  private readonly listeners = new Set<(event: TelemetryEvent) => void>();

  constructor(private readonly repository: Repository) {}

  record(input: {
    category: TelemetryCategory;
    severity?: TelemetrySeverity;
    source: string;
    message: string;
    metadata?: Record<string, unknown>;
    createdAt?: string;
  }): TelemetryEvent {
    const event: TelemetryEvent = {
      id: randomUUID(),
      category: input.category,
      severity: input.severity ?? "info",
      source: input.source,
      message: input.message,
      metadata: input.metadata ?? {},
      createdAt: input.createdAt ?? new Date().toISOString()
    };
    this.ring.push(event);
    if (this.ring.length > TELEMETRY_RING_MAX) {
      this.ring.splice(0, this.ring.length - TELEMETRY_RING_MAX);
    }
    for (const listener of this.listeners) {
      listener(event);
    }
    return event;
  }

  subscribe(listener: (event: TelemetryEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  listSince(lastEventId: string | null, limit = 200): TelemetryEvent[] {
    if (!lastEventId) {
      return this.listRecentFromRing(limit);
    }
    const idx = this.ring.findIndex((item) => item.id === lastEventId);
    if (idx === -1) {
      return this.listRecentFromRing(limit);
    }
    return this.ring.slice(idx + 1).slice(-limit);
  }

  listEvents(limit = 150, category?: TelemetryCategory): TelemetryEvent[] {
    const live = [...this.ring]
      .reverse()
      .filter((item) => (category ? item.category === category : true));
    const fromAudit = this.repository
      .listAuditLogs(limit * 3)
      .map((log): TelemetryEvent => {
        const mappedCategory: TelemetryCategory = log.category === "vault" || log.category === "agent" ? log.category : "system";
        const severity: TelemetrySeverity =
          log.category === "system" && String(log.action).includes("red_phone")
            ? "critical"
            : log.category === "vault" && String(log.action).includes("prune")
              ? "warning"
              : "info";
        return {
          id: `audit-${log.id}`,
          category: mappedCategory,
          severity,
          source: `audit.${log.category}`,
          message: `${log.category}.${log.action}`,
          metadata: log.metadata,
          createdAt: log.createdAt
        };
      })
      .filter((item) => (category ? item.category === category : true));
    const merged = [...live, ...fromAudit]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
    return merged;
  }

  private listRecentFromRing(limit: number): TelemetryEvent[] {
    return this.ring.slice(-limit);
  }

  snapshot(startedAt: string): TelemetrySnapshot {
    const now = Date.now();
    const uptimeSeconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
    const agents = this.repository.listAgents();
    const activeAgents = agents.filter((item) => item.status === "online" || item.status === "busy").length;
    const errorAgents = agents.filter((item) => item.status === "error" || item.status === "degraded").length;
    const approvals = this.repository.listPermissions().filter((item) => !item.granted).length;
    const summary = this.repository.getSwarmSummary();
    const vault = this.repository.vaultSummary(128);
    const vaultUsagePct = vault.capacityGb > 0 ? Number(((vault.usedGb / vault.capacityGb) * 100).toFixed(1)) : 0;

    const alerts: string[] = [];
    if (vaultUsagePct >= 85) {
      alerts.push(`Vault at ${vaultUsagePct}% used: consider pruning low-importance entries.`);
    }
    if (errorAgents > 0) {
      alerts.push(`${errorAgents} agent(s) in error/degraded state.`);
    }
    if (approvals > 0) {
      alerts.push(`${approvals} pending permission approval(s).`);
    }

    return {
      heartbeat: new Date().toISOString(),
      uptimeSeconds,
      gatewayStatus: errorAgents > 0 ? "degraded" : "ok",
      activeAgents,
      totalAgents: agents.length,
      errorAgents,
      pendingApprovals: approvals,
      spendTodayUsd: Number(summary.spendTodayUsd.toFixed(4)),
      vaultUsedGb: vault.usedGb,
      vaultCapacityGb: vault.capacityGb,
      vaultUsagePct,
      alerts
    };
  }

  exportEvents(format: "json" | "csv", limit = 300): string {
    const rows = this.listEvents(limit);
    if (format === "json") {
      return JSON.stringify(rows, null, 2);
    }
    const header = "createdAt,category,severity,source,message,metadata";
    const body = rows
      .map((item) => {
        const esc = (value: string) => `"${value.replaceAll("\"", "\"\"")}"`;
        return [
          esc(item.createdAt),
          esc(item.category),
          esc(item.severity),
          esc(item.source),
          esc(item.message),
          esc(JSON.stringify(item.metadata))
        ].join(",");
      })
      .join("\n");
    return `${header}\n${body}`;
  }
}

