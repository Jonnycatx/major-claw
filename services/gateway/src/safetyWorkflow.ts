import { randomUUID } from "node:crypto";
import type { AuditLog, PermissionGrant } from "@majorclaw/shared-types";
import type { Repository } from "@majorclaw/db";
import { PermissionService } from "./permissions.js";

export class SafetyWorkflow {
  constructor(
    private readonly permissions: PermissionService,
    private readonly repository: Repository
  ) {}

  requestCapability(agentId: string, capability: string): PermissionGrant {
    const grant: PermissionGrant = {
      id: randomUUID(),
      agentId,
      capability,
      granted: false,
      createdAt: new Date().toISOString()
    };
    this.permissions.requestApproval(grant);
    this.repository.addPermission(grant);
    this.repository.addAuditLog(this.audit("permissions", "request", "system", { agentId, capability }));
    return grant;
  }

  requestCapabilities(agentId: string, capabilities: string[], metadata?: Record<string, unknown>): PermissionGrant[] {
    return capabilities.map((capability) => {
      const grant = this.requestCapability(agentId, capability);
      if (metadata) {
        this.repository.addAuditLog(this.audit("permissions", "request_context", "system", { grantId: grant.id, ...metadata }));
      }
      return grant;
    });
  }

  approve(grantId: string): PermissionGrant {
    const approved = this.permissions.approve(grantId);
    this.repository.addPermission(approved);
    this.repository.addAuditLog(this.audit("permissions", "approve", "user", { grantId }));
    return approved;
  }

  deny(grantId: string): PermissionGrant {
    const denied = this.permissions.deny(grantId);
    this.repository.addPermission(denied);
    this.repository.addAuditLog(this.audit("permissions", "deny", "user", { grantId }));
    return denied;
  }

  listPending(agentId?: string): PermissionGrant[] {
    return this.permissions.listPending(agentId);
  }

  listAuditLogs(limit = 100): AuditLog[] {
    return this.repository.listAuditLogs(limit);
  }

  private audit(category: string, action: string, actor: string, metadata: Record<string, unknown>): AuditLog {
    return {
      id: randomUUID(),
      category,
      action,
      actor,
      metadata,
      createdAt: new Date().toISOString()
    };
  }
}
