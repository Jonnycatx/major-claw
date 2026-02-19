import { randomUUID } from "node:crypto";
import type { McpServerEntry, McpToolEntry } from "@majorclaw/shared-types";

type RegisterInput = {
  url: string;
  name?: string;
  capabilities?: string[];
};

export class McpHostRegistry {
  private readonly servers = new Map<string, McpServerEntry>();
  private readonly toolsByServer = new Map<string, McpToolEntry[]>();

  constructor() {
    this.seed();
  }

  list(query = ""): McpServerEntry[] {
    const lowered = query.trim().toLowerCase();
    const values = [...this.servers.values()];
    if (!lowered) {
      return values;
    }
    return values.filter(
      (item) =>
        item.name.toLowerCase().includes(lowered) ||
        item.url.toLowerCase().includes(lowered) ||
        item.capabilities.some((capability) => capability.toLowerCase().includes(lowered))
    );
  }

  register(input: RegisterInput): McpServerEntry {
    const entry: McpServerEntry = {
      id: `mcp_${randomUUID().slice(0, 8)}`,
      url: input.url.trim(),
      name: (input.name?.trim() || this.inferName(input.url)).slice(0, 80),
      capabilities: input.capabilities?.length ? input.capabilities : ["tools.list", "tools.invoke"],
      connected: false,
      approvedScopes: [],
      createdAt: new Date().toISOString()
    };
    this.servers.set(entry.id, entry);
    this.toolsByServer.set(entry.id, this.defaultToolsFor(entry));
    return entry;
  }

  connect(serverId: string, approvedScopes: string[]): McpServerEntry {
    const existing = this.servers.get(serverId);
    if (!existing) {
      throw new Error(`mcp server not found: ${serverId}`);
    }
    const next: McpServerEntry = {
      ...existing,
      connected: true,
      approvedScopes,
      lastConnectedAt: new Date().toISOString()
    };
    this.servers.set(serverId, next);
    return next;
  }

  disconnect(serverId: string): McpServerEntry {
    const existing = this.servers.get(serverId);
    if (!existing) {
      throw new Error(`mcp server not found: ${serverId}`);
    }
    const next: McpServerEntry = {
      ...existing,
      connected: false
    };
    this.servers.set(serverId, next);
    return next;
  }

  listTools(serverId: string): McpToolEntry[] {
    return this.toolsByServer.get(serverId) ?? [];
  }

  invokeTool(
    serverId: string,
    toolId: string,
    agentId: string,
    args: Record<string, unknown>
  ): { output: string; latencyMs: number } {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`mcp server not found: ${serverId}`);
    }
    if (!server.connected) {
      throw new Error(`mcp server not connected: ${serverId}`);
    }
    const tool = this.listTools(serverId).find((entry) => entry.id === toolId);
    if (!tool) {
      throw new Error(`mcp tool not found: ${toolId}`);
    }
    const preview = JSON.stringify(args).slice(0, 120) || "{}";
    return {
      output: `[${server.name}] ${tool.name} invoked by ${agentId} with args ${preview}`,
      latencyMs: Math.max(6, Math.floor(Math.random() * 45))
    };
  }

  private seed(): void {
    const filesystem = this.register({
      url: "mcp://local/filesystem",
      name: "Filesystem MCP",
      capabilities: ["filesystem.read", "filesystem.write", "tools.invoke"]
    });
    const github = this.register({
      url: "mcp://local/github",
      name: "GitHub MCP",
      capabilities: ["git.read", "git.write", "pull_request.create"]
    });
    this.connect(filesystem.id, ["filesystem.workspace"]);
    this.connect(github.id, ["repo.read"]);
  }

  private inferName(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname || "MCP Server";
    } catch {
      return "MCP Server";
    }
  }

  private defaultToolsFor(entry: McpServerEntry): McpToolEntry[] {
    return entry.capabilities.map((capability, index) => ({
      id: `${entry.id}_tool_${index + 1}`,
      serverId: entry.id,
      name: capability.replaceAll(".", "_"),
      description: `Tool mapped from capability ${capability}`,
      scopes: [capability]
    }));
  }
}
