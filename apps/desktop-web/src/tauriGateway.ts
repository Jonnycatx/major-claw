type GatewayStatus = {
  running: boolean;
  port: number;
};

type GatewayHealth = {
  status: string;
  startedAt?: string;
  instanceCount?: number;
};

export type ClawHubSort = "downloads" | "newest";
export type AgentStatus = "online" | "offline" | "degraded" | "idle" | "busy" | "error";

export type AgentProfile = {
  id: string;
  name: string;
  role: string;
  modelProfileId: string;
  status: AgentStatus;
  parentId: string | null;
  modelProvider?: string;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  lastHeartbeat?: string | null;
};

export type AgentStats = {
  agentId: string;
  tokensToday: number;
  tasksCompleted: number;
  lastUpdated: string;
};

export type AgentFullConfig = AgentProfile & {
  apiKeyMasked?: string;
  installedSkills: string[];
  stats: AgentStats;
};

export type AgentCreatePayload = {
  name: string;
  role: string;
  parentId?: string | null;
  modelProvider: string;
  modelName: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
};

export type AgentConfigPatch = {
  modelProvider?: string;
  modelName?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  status?: AgentStatus;
};

export type AgentQuickAction = "pause" | "clone" | "delete" | "logs";

export type AgentActionResult = {
  success: boolean;
  message: string;
  action: AgentQuickAction;
  agentId: string;
};

export type AgentConnectionTestResult = {
  ok: boolean;
  message: string;
  status: AgentStatus;
};

export type IntegrationStatus = "connected" | "disconnected" | "setup_required";

export type IntegrationEntry = {
  slug: string;
  name: string;
  category: string;
  description: string;
  setup: string[];
  permissions: string[];
  status: IntegrationStatus;
  assignedAgentIds: string[];
};

export type IntegrationsListResult = {
  items: IntegrationEntry[];
  categories: { name: string; connectedCount: number; totalCount: number }[];
};

export type SwarmChatThread = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type SwarmChatMessage = {
  id: string;
  threadId: string;
  type: "user" | "cso" | "agent_update" | "delegation" | "skill_suggestion" | "system";
  author: string;
  content: string;
  createdAt: string;
  parentMessageId?: string;
  metadata?: Record<string, unknown>;
};

export type SwarmSummary = {
  onlineAgents: number;
  activeTasks: number;
  spendTodayUsd: number;
  heartbeat: string;
};

export type ConnectedModelProvider = {
  provider: string;
  label: string;
  modelHint: string;
};

export type ClawHubSkill = {
  slug: string;
  name: string;
  author: string;
  description: string;
  downloads: number;
  stars?: number;
  version: string;
  categories: string[];
  permissions: string[];
  installed: boolean;
};

export type ClawHubLiveSkillsResult = {
  skills: ClawHubSkill[];
  nextCursor: string | null;
  source: "live" | "cache";
};

export type ClawHubInstallResult = {
  slug: string;
  installed: boolean;
  assignedAgentId?: string | null;
  message: string;
  requestedPermissionIds?: string[];
};

export type PermissionGrant = {
  id: string;
  agentId: string;
  capability: string;
  granted: boolean;
  createdAt: string;
};

export type AuditLogEntry = {
  id: string;
  category: string;
  action: string;
  actor: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    const core = await import("@tauri-apps/api/core");
    return (await core.invoke(command, args)) as T;
  } catch {
    return null;
  }
}

export async function startGateway(): Promise<GatewayStatus | null> {
  return invokeTauri<GatewayStatus>("start_gateway");
}

export async function stopGateway(): Promise<GatewayStatus | null> {
  return invokeTauri<GatewayStatus>("stop_gateway");
}

export async function getGatewayStatus(): Promise<GatewayStatus | null> {
  return invokeTauri<GatewayStatus>("gateway_status");
}

export async function getGatewayHealth(): Promise<GatewayHealth | null> {
  return invokeTauri<GatewayHealth>("gateway_health");
}

export async function listAgents(): Promise<AgentProfile[]> {
  return (await invokeTauri<AgentProfile[]>("list_agents")) ?? [];
}

export async function createAgent(payload: AgentCreatePayload): Promise<AgentProfile | null> {
  return invokeTauri<AgentProfile>("create_agent", { payload });
}

export async function reorderAgents(order: string[]): Promise<AgentProfile[]> {
  return (await invokeTauri<AgentProfile[]>("reorder_agents", { order })) ?? [];
}

export async function updateAgentConfig(agentId: string, config: AgentConfigPatch): Promise<AgentProfile | null> {
  return invokeTauri<AgentProfile>("update_agent_config", { agent_id: agentId, config });
}

export async function getAgentConfig(agentId: string): Promise<AgentFullConfig | null> {
  return invokeTauri<AgentFullConfig>("get_agent_config", { agent_id: agentId });
}

export async function runAgentQuickAction(agentId: string, action: AgentQuickAction): Promise<AgentActionResult | null> {
  return invokeTauri<AgentActionResult>("run_agent_quick_action", { agent_id: agentId, action });
}

export async function getAgentLogs(agentId: string, limit = 40): Promise<AuditLogEntry[]> {
  return (await invokeTauri<AuditLogEntry[]>("get_agent_logs", { agent_id: agentId, limit })) ?? [];
}

export async function testAgentConnection(agentId: string, apiKey?: string): Promise<AgentConnectionTestResult | null> {
  return invokeTauri<AgentConnectionTestResult>("test_agent_connection", {
    agent_id: agentId,
    api_key: apiKey ?? null
  });
}

export async function getIntegrations(query = "", category = "All Categories"): Promise<IntegrationsListResult> {
  return (
    (await invokeTauri<IntegrationsListResult>("get_integrations", {
      query,
      category
    })) ?? { items: [], categories: [{ name: "All Categories", connectedCount: 0, totalCount: 0 }] }
  );
}

export async function getIntegrationStatus(slug: string): Promise<{ slug: string; status: IntegrationStatus } | null> {
  return invokeTauri<{ slug: string; status: IntegrationStatus }>("get_integration_status", { slug });
}

export async function connectIntegration(
  slug: string,
  targetAgentIds: string[],
  config?: Record<string, string>
): Promise<IntegrationEntry | null> {
  return invokeTauri<IntegrationEntry>("connect_integration", {
    slug,
    target_agent_ids: targetAgentIds,
    config: config ?? {}
  });
}

export async function getConnectedModelProviders(): Promise<ConnectedModelProvider[]> {
  return (await invokeTauri<ConnectedModelProvider[]>("get_connected_model_providers")) ?? [];
}

export async function chatThreads(): Promise<SwarmChatThread[]> {
  return (await invokeTauri<SwarmChatThread[]>("chat_threads")) ?? [];
}

export async function chatSummary(): Promise<SwarmSummary | null> {
  return invokeTauri<SwarmSummary>("chat_summary");
}

export async function chatMessages(threadId: string): Promise<SwarmChatMessage[]> {
  return (await invokeTauri<SwarmChatMessage[]>("chat_messages", { thread_id: threadId })) ?? [];
}

export async function chatSend(threadId: string, content: string, userId?: string): Promise<SwarmChatMessage[]> {
  return (
    (await invokeTauri<SwarmChatMessage[]>("chat_send", {
      thread_id: threadId,
      content,
      user_id: userId ?? "user"
    })) ?? []
  );
}

export async function chatQuickAction(
  threadId: string,
  action: "morning_briefing" | "status_report" | "suggest_skills" | "delegate_task"
): Promise<SwarmChatMessage[]> {
  return (
    (await invokeTauri<SwarmChatMessage[]>("chat_quick_action", {
      thread_id: threadId,
      action
    })) ?? []
  );
}

export async function clawhubSearch(query: string, sort: ClawHubSort): Promise<ClawHubSkill[]> {
  return (await invokeTauri<ClawHubSkill[]>("clawhub_search", { query, sort })) ?? [];
}

export async function getLiveSkills(
  sort: ClawHubSort = "downloads",
  nonSuspicious = true,
  cursor?: string | null
): Promise<ClawHubLiveSkillsResult> {
  return (
    (await invokeTauri<ClawHubLiveSkillsResult>("get_live_skills", {
      sort,
      non_suspicious: nonSuspicious,
      cursor: cursor ?? null
    })) ?? { skills: [], nextCursor: null, source: "cache" }
  );
}

export async function clawhubInstall(slug: string, targetAgent?: string): Promise<ClawHubInstallResult | null> {
  return invokeTauri<ClawHubInstallResult>("clawhub_install", {
    slug,
    target_agent: targetAgent ?? null
  });
}

export async function clawhubListInstalled(): Promise<ClawHubSkill[]> {
  return (await invokeTauri<ClawHubSkill[]>("clawhub_list_installed")) ?? [];
}

export async function getInstalledSkills(agentId?: string): Promise<ClawHubSkill[]> {
  return (await invokeTauri<ClawHubSkill[]>("get_installed_skills", { agent_id: agentId ?? null })) ?? [];
}

export async function clawhubGetSkillDetails(slug: string): Promise<ClawHubSkill | null> {
  return invokeTauri<ClawHubSkill>("clawhub_get_skill_details", { slug });
}

export async function toggleSkill(agentId: string, slug: string, enabled: boolean): Promise<boolean> {
  return (await invokeTauri<boolean>("toggle_skill", { agent_id: agentId, slug, enabled })) ?? false;
}

export async function permissionsRequest(
  agentId: string,
  capabilities: string[],
  context?: Record<string, unknown>
): Promise<PermissionGrant[]> {
  return (
    (await invokeTauri<PermissionGrant[]>("permissions_request", {
      agent_id: agentId,
      capabilities,
      context: context ?? {}
    })) ?? []
  );
}

export async function permissionsApprove(grantId: string): Promise<PermissionGrant | null> {
  return invokeTauri<PermissionGrant>("permissions_approve", { grant_id: grantId });
}

export async function permissionsDeny(grantId: string): Promise<PermissionGrant | null> {
  return invokeTauri<PermissionGrant>("permissions_deny", { grant_id: grantId });
}

export async function permissionsPending(agentId?: string): Promise<PermissionGrant[]> {
  return (await invokeTauri<PermissionGrant[]>("permissions_pending", { agent_id: agentId ?? null })) ?? [];
}

export async function auditLogs(limit = 100): Promise<AuditLogEntry[]> {
  return (await invokeTauri<AuditLogEntry[]>("audit_logs", { limit })) ?? [];
}

