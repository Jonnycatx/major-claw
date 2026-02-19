import type { PermissionGrant } from "@majorclaw/shared-types";

export interface CapabilityMatrix {
  can_read: boolean;
  can_write: boolean;
  can_exec: boolean;
  scopes: string[];
}

export class PermissionService {
  private readonly grants = new Map<string, CapabilityMatrix>();
  private readonly requests = new Map<string, PermissionGrant>();

  setCapabilities(agentId: string, capabilities: CapabilityMatrix): void {
    this.grants.set(agentId, capabilities);
  }

  getCapabilities(agentId: string): CapabilityMatrix {
    return (
      this.grants.get(agentId) ?? {
        can_read: true,
        can_write: false,
        can_exec: false,
        scopes: []
      }
    );
  }

  requestApproval(grant: PermissionGrant): void {
    this.requests.set(grant.id, grant);
  }

  restorePending(grants: PermissionGrant[]): void {
    this.requests.clear();
    for (const grant of grants) {
      this.requests.set(grant.id, grant);
    }
  }

  approve(grantId: string): PermissionGrant {
    const grant = this.requests.get(grantId);
    if (!grant) {
      throw new Error(`Missing permission request ${grantId}`);
    }
    const approved = { ...grant, granted: true };
    this.requests.delete(grantId);
    return approved;
  }

  deny(grantId: string): PermissionGrant {
    const grant = this.requests.get(grantId);
    if (!grant) {
      throw new Error(`Missing permission request ${grantId}`);
    }
    this.requests.delete(grantId);
    return grant;
  }

  listPending(agentId?: string): PermissionGrant[] {
    const values = Array.from(this.requests.values());
    if (!agentId) {
      return values;
    }
    return values.filter((grant) => grant.agentId === agentId);
  }
}
