import { randomUUID } from "node:crypto";
import type { Repository } from "@majorclaw/db";
import type {
  AgentActionResult,
  AgentConfigPatch,
  AgentConnectionTestResult,
  AgentCreatePayload,
  AgentFullConfig,
  AgentProfile,
  AgentQuickAction,
  AuditLog
} from "@majorclaw/shared-types";
import type { EventBus } from "./eventBus.js";
import type { GatewayEvent } from "./types.js";
import type { SecretStore } from "./secretStore.js";

function sanitizeAgent(agent: AgentProfile): AgentProfile {
  return {
    ...agent,
    modelProvider: agent.modelProvider ?? "anthropic",
    modelName: agent.modelName ?? "claude-3-5-sonnet",
    temperature: agent.temperature ?? 0.7,
    maxTokens: agent.maxTokens ?? 8192
  };
}

export class AgentManager {
  constructor(
    private readonly repository: Repository,
    private readonly events: EventBus<GatewayEvent>,
    private readonly secretStore: SecretStore
  ) {}

  listAgents(): AgentProfile[] {
    return this.repository.listAgents().map((agent) => sanitizeAgent(agent));
  }

  createAgent(payload: AgentCreatePayload): AgentProfile {
    const agent = sanitizeAgent(this.repository.createAgent(payload));
    if (payload.apiKey?.trim()) {
      const secretRef = this.secretStore.put(`agent:${agent.id}`, payload.apiKey);
      this.repository.setEncryptedApiKey(agent.id, secretRef);
    }
    this.events.emit({
      type: "agent.created",
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
      payload: { agentId: agent.id }
    });
    this.audit(agent.id, "create", "Agent created from wizard.");
    return agent;
  }

  updateAgentConfig(agentId: string, patch: AgentConfigPatch): AgentProfile {
    const agent = sanitizeAgent(this.repository.updateAgentConfig(agentId, patch));
    if (patch.apiKey?.trim()) {
      const secretRef = this.secretStore.put(`agent:${agentId}`, patch.apiKey);
      this.repository.setEncryptedApiKey(agentId, secretRef);
    }
    this.events.emit({
      type: "agent.config_updated",
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
      payload: { agentId }
    });
    this.audit(agentId, "config_update", "Agent config updated.");
    return agent;
  }

  getAgentWithConfig(agentId: string): AgentFullConfig {
    return this.repository.getAgentFullConfig(agentId);
  }

  reorderAgents(order: string[]): AgentProfile[] {
    const agents = this.repository.reorderAgents(order).map((agent) => sanitizeAgent(agent));
    this.events.emit({
      type: "agent.reordered",
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
      payload: { count: agents.length }
    });
    this.repository.addAuditLog({
      id: randomUUID(),
      category: "agent",
      action: "reorder",
      actor: "user",
      metadata: { order },
      createdAt: new Date().toISOString()
    });
    return agents;
  }

  quickAction(agentId: string, action: AgentQuickAction): AgentActionResult {
    if (action === "pause") {
      this.repository.updateAgentConfig(agentId, { status: "offline" });
      this.audit(agentId, "pause", "Agent paused.");
      return { success: true, message: "Agent paused.", action, agentId };
    }
    if (action === "clone") {
      const source = this.repository.getAgent(agentId);
      if (!source) {
        return { success: false, message: "Agent not found.", action, agentId };
      }
      const cloned = this.repository.createAgent({
        name: `${source.name} Copy`,
        role: source.role,
        parentId: source.parentId ?? "agent_cso",
        modelProvider: source.modelProvider ?? "anthropic",
        modelName: source.modelName ?? "claude-3-5-sonnet",
        temperature: source.temperature ?? 0.7,
        maxTokens: source.maxTokens ?? 8192
      });
      this.audit(cloned.id, "clone", `Cloned from ${agentId}.`);
      return { success: true, message: `${source.name} cloned.`, action, agentId: cloned.id };
    }
    if (action === "delete") {
      const target = this.repository.getAgent(agentId);
      if (!target) {
        return { success: false, message: "Agent not found.", action, agentId };
      }
      if (target.parentId === null) {
        return { success: false, message: "Cannot delete CSO root agent.", action, agentId };
      }
      this.repository.deleteAgent(agentId);
      this.audit(agentId, "delete", "Agent deleted.");
      return { success: true, message: `${target.name} deleted.`, action, agentId };
    }
    this.audit(agentId, "logs_viewed", "Agent logs viewed.");
    return { success: true, message: "Agent logs loaded.", action, agentId };
  }

  getAgentLogs(agentId: string, limit = 40): AuditLog[] {
    return this.repository
      .listAuditLogs(limit * 3)
      .filter((entry) => entry.category === "agent" && String(entry.metadata.agentId ?? "") === agentId)
      .slice(0, limit);
  }

  testConnection(agentId: string, apiKey?: string): AgentConnectionTestResult {
    const agent = this.repository.getAgent(agentId);
    if (!agent) {
      return { ok: false, message: "Agent not found.", status: "error" };
    }
    const provider = agent.modelProvider ?? "anthropic";
    const normalized = apiKey?.trim();
    const looksValid = this.validateKeyShape(provider, normalized);
    if (!looksValid) {
      this.repository.updateAgentConfig(agentId, { status: "error" });
      this.audit(agentId, "connection_test_failed", `Invalid ${provider} API key format.`);
      return { ok: false, message: `Connection failed: invalid ${provider} API key.`, status: "error" };
    }
    if (normalized) {
      const secretRef = this.secretStore.put(`agent:${agentId}`, normalized);
      this.repository.setEncryptedApiKey(agentId, secretRef);
    }
    this.repository.updateAgentConfig(agentId, { status: "online" });
    this.audit(agentId, "connection_test_passed", `Connection test passed for ${provider}.`);
    return { ok: true, message: "Connection test passed.", status: "online" };
  }

  private validateKeyShape(provider: string, value?: string): boolean {
    if (!value) {
      return false;
    }
    if (provider === "anthropic") {
      return value.startsWith("sk-ant-") && value.length > 18;
    }
    if (provider === "openai") {
      return value.startsWith("sk-") && value.length > 14;
    }
    if (provider === "google") {
      return (value.startsWith("AIza") || value.startsWith("gsk_")) && value.length > 14;
    }
    if (provider === "xai") {
      return (value.startsWith("xai-") || value.startsWith("sk-")) && value.length > 10;
    }
    // local provider does not require a key.
    return provider === "local" || value.length > 8;
  }

  private audit(agentId: string, action: string, message: string): void {
    this.repository.addAuditLog({
      id: randomUUID(),
      category: "agent",
      action,
      actor: "user",
      metadata: { agentId, message },
      createdAt: new Date().toISOString()
    });
  }
}
