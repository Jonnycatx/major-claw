import { randomUUID } from "node:crypto";
import { McpHostRegistry } from "@majorclaw/mcp-host";
import type { Repository } from "@majorclaw/db";
import type { McpServerEntry, McpToolEntry } from "@majorclaw/shared-types";
import type { EventBus } from "./eventBus.js";
import type { GatewayEvent } from "./types.js";

export class McpService {
  private readonly registry = new McpHostRegistry();

  constructor(
    private readonly repository: Repository,
    private readonly events: EventBus<GatewayEvent>
  ) {}

  list(query = ""): McpServerEntry[] {
    return this.registry.list(query);
  }

  register(url: string, name?: string, capabilities?: string[]): McpServerEntry {
    const payload: { url: string; name?: string; capabilities?: string[] } = { url };
    if (name !== undefined) {
      payload.name = name;
    }
    if (capabilities !== undefined) {
      payload.capabilities = capabilities;
    }
    const entry = this.registry.register(payload);
    this.repository.addAuditLog({
      id: randomUUID(),
      category: "mcp",
      action: "register_server",
      actor: "user",
      metadata: { serverId: entry.id, url: entry.url },
      createdAt: new Date().toISOString()
    });
    this.events.emit({
      type: "mcp.server_registered",
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
      payload: { serverId: entry.id }
    });
    return entry;
  }

  connect(serverId: string, approvedScopes: string[]): McpServerEntry {
    const entry = this.registry.connect(serverId, approvedScopes);
    this.repository.addAuditLog({
      id: randomUUID(),
      category: "mcp",
      action: "connect_server",
      actor: "user",
      metadata: { serverId, approvedScopes },
      createdAt: new Date().toISOString()
    });
    this.events.emit({
      type: "mcp.server_connected",
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
      payload: { serverId }
    });
    return entry;
  }

  disconnect(serverId: string): McpServerEntry {
    const entry = this.registry.disconnect(serverId);
    this.repository.addAuditLog({
      id: randomUUID(),
      category: "mcp",
      action: "disconnect_server",
      actor: "user",
      metadata: { serverId },
      createdAt: new Date().toISOString()
    });
    this.events.emit({
      type: "mcp.server_disconnected",
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
      payload: { serverId }
    });
    return entry;
  }

  listTools(serverId: string): McpToolEntry[] {
    return this.registry.listTools(serverId);
  }

  invoke(serverId: string, toolId: string, agentId: string, args: Record<string, unknown>): { output: string; latencyMs: number } {
    const result = this.registry.invokeTool(serverId, toolId, agentId, args);
    this.repository.addAuditLog({
      id: randomUUID(),
      category: "mcp",
      action: "invoke_tool",
      actor: agentId,
      metadata: { serverId, toolId, args, latencyMs: result.latencyMs },
      createdAt: new Date().toISOString()
    });
    this.events.emit({
      type: "mcp.tool_invoked",
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
      payload: { serverId, toolId, agentId }
    });
    return result;
  }
}
