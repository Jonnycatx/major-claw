import type { ErrorResponse } from "@majorclaw/shared-types";
import type { TaskRecord } from "@majorclaw/shared-types";
import type { TaskStatus } from "@majorclaw/shared-types";
import { emitAppError } from "./utils/errorBus.js";
import { normalizeError } from "./utils/errorMapper.js";

type GatewayStatus = {
  running: boolean;
  port: number;
};

type GatewayHealth = {
  status: string;
  startedAt?: string;
  instanceCount?: number;
};

export type GatewayDaemonStatus = {
  platform: string;
  supported: boolean;
  enabled: boolean;
  running: boolean;
  serviceLabel: string;
  servicePath: string;
  logHint: string;
  lastError?: string;
  message: string;
};

export type RedPhoneResult = {
  status: "stopped";
  reason: string;
  timestamp: string;
  audited: boolean;
  auditLog?: AuditLogEntry;
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

export type CheckpointRecord = {
  id: string;
  swarmId: string;
  step: number;
  stateJson: string;
  promptSnapshot?: string;
  createdAt: string;
};

export type AgentBudget = {
  agentId: string;
  tokenLimit: number;
  costLimitUsd: number;
  currentTokens: number;
  currentCostUsd: number;
  hardKill: boolean;
  updatedAt: string;
};

export type BudgetSnapshot = {
  global: AgentBudget;
  agents: AgentBudget[];
};

export type McpServerEntry = {
  id: string;
  url: string;
  name: string;
  capabilities: string[];
  connected: boolean;
  approvedScopes: string[];
  createdAt: string;
  lastConnectedAt?: string;
};

export type McpToolEntry = {
  id: string;
  serverId: string;
  name: string;
  description: string;
  scopes: string[];
};

export type McpInvokeResult = {
  output: string;
  latencyMs: number;
};

export type VaultEntryType = "archive" | "file" | "kb";

export type VaultEntry = {
  id: string;
  type: VaultEntryType;
  title: string;
  markdownSummary: string;
  importanceScore: number;
  tags: string[];
  agentId: string;
  taskId?: string;
  version: number;
  blobPath?: string;
  createdAt: string;
  encrypted: boolean;
};

export type VaultSummary = {
  usedGb: number;
  capacityGb: number;
  archivedItems: number;
  fileItems: number;
  knowledgeItems: number;
};

export type VaultStorageStats = {
  snapshotTime: string;
  archiveGb: number;
  filesGb: number;
  totalGb: number;
  freeGb: number;
};

export type VaultStorageInfo = {
  rootPath: string;
  volumeName: string;
  totalGb: number;
  freeGb: number;
  vaultUsedGb: number;
  isExternal: boolean;
  isNetwork: boolean;
  warningLevel: "normal" | "warning_70" | "warning_85" | "critical_95";
  isOfflineFallback: boolean;
  tempCachePath?: string;
  updatedAt: string;
};

export type VaultVersion = {
  entryId: string;
  versionNum: number;
  blobPath?: string;
  diff?: string;
  createdAt: string;
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

export type HealthSnapshot = {
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

export type HealthTelemetryEvent = {
  id: string;
  category: "lifecycle" | "gateway" | "agent" | "vault" | "error" | "system";
  severity: "info" | "warning" | "critical";
  source: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type HealthExportResult = {
  format: "json" | "csv" | string;
  generatedAt: string;
  payload: string;
};

export type AnalyticsSnapshot = {
  range: "7d" | "30d" | "90d";
  kpis: {
    spend: { value: number; deltaPct: number };
    vaultGrowth: { value: number; deltaPct: number };
    activeAgents: { value: number; deltaPct: number };
  };
  trends: {
    spend: Array<{ date: string; value: number }>;
    vaultUsage: Array<{ date: string; value: number }>;
    activeAgents: Array<{ date: string; value: number }>;
  };
  perAgent: Array<{
    agentId: string;
    name: string;
    tokensLastPeriod: number;
    tokensPreviousPeriod: number;
    tokensDeltaPct: number;
    spendLastPeriodUsd: number;
    spendPreviousPeriodUsd: number;
    spendDeltaPct: number;
    tasksCompletedDelta: number;
  }>;
  forecasts: Array<{
    agentId: string;
    name: string;
    dailyCostSlopeUsd: number;
    projectedCost30dUsd: number;
    currentCostUsd: number;
    costLimitUsd: number;
    daysUntilLimit: number | null;
    risk: "low" | "watch" | "high";
  }>;
  recommendations: string[];
  generatedAt: string;
};

export type AnalyticsExportResult = {
  range: "7d" | "30d" | "90d";
  format: "json" | "csv" | string;
  generatedAt: string;
  payload: string;
};

export type GatewayErrorEnvelope = {
  success?: boolean;
  error?: ErrorResponse;
  requestId?: string;
};

function emitInvokeError(error: unknown, context: string, retry?: () => void): void {
  const normalized = normalizeError(error, context);
  const detail: { error: ErrorResponse; context: string; retry?: () => void } = {
    error: normalized,
    context
  };
  if (retry) {
    detail.retry = retry;
  }
  emitAppError(detail);
}

async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    const core = await import("@tauri-apps/api/core");
    return (await core.invoke(command, args)) as T;
  } catch (error) {
    emitInvokeError(error, `Command: ${command}`);
    return null;
  }
}

export async function startGateway(): Promise<GatewayStatus | null> {
  return invokeTauri<GatewayStatus>("start_gateway");
}

export async function stopGateway(): Promise<GatewayStatus | null> {
  return invokeTauri<GatewayStatus>("stop_gateway");
}

export async function redPhoneShutdown(reason: string): Promise<RedPhoneResult | null> {
  return invokeTauri<RedPhoneResult>("red_phone_shutdown", { reason });
}

export async function getGatewayDaemonStatus(): Promise<GatewayDaemonStatus | null> {
  return invokeTauri<GatewayDaemonStatus>("gateway_daemon_status");
}

export async function setGatewayDaemonEnabled(enabled: boolean): Promise<GatewayDaemonStatus | null> {
  return invokeTauri<GatewayDaemonStatus>("gateway_daemon_set_enabled", { enabled });
}

export async function startGatewayDaemon(): Promise<GatewayDaemonStatus | null> {
  return invokeTauri<GatewayDaemonStatus>("gateway_daemon_start");
}

export async function stopGatewayDaemon(): Promise<GatewayDaemonStatus | null> {
  return invokeTauri<GatewayDaemonStatus>("gateway_daemon_stop");
}

export async function restartGatewayDaemon(): Promise<GatewayDaemonStatus | null> {
  return invokeTauri<GatewayDaemonStatus>("gateway_daemon_restart");
}

export async function openOfficialIntegrations(fragment?: string): Promise<boolean> {
  try {
    const core = await import("@tauri-apps/api/core");
    await core.invoke("open_official_integrations", { fragment: fragment ?? null });
    return true;
  } catch (error) {
    emitInvokeError(error, "Open official integrations");
    return false;
  }
}

export async function closeOfficialIntegrations(): Promise<boolean> {
  try {
    const core = await import("@tauri-apps/api/core");
    return (await core.invoke("close_official_integrations")) as boolean;
  } catch (error) {
    emitInvokeError(error, "Close official integrations");
    return false;
  }
}

export async function backOfficialIntegrations(): Promise<boolean> {
  try {
    const core = await import("@tauri-apps/api/core");
    return (await core.invoke("back_official_integrations")) as boolean;
  } catch (error) {
    emitInvokeError(error, "Navigate integrations back");
    return false;
  }
}

export async function getGatewayStatus(): Promise<GatewayStatus | null> {
  return invokeTauri<GatewayStatus>("gateway_status");
}

export async function gatewaySessionToken(): Promise<string | null> {
  return invokeTauri<string>("gateway_session_token");
}

export async function getGatewayHealth(): Promise<GatewayHealth | null> {
  return invokeTauri<GatewayHealth>("gateway_health");
}

export async function listAgents(): Promise<AgentProfile[]> {
  return (await invokeTauri<AgentProfile[]>("list_agents")) ?? [];
}

export async function listTasks(): Promise<TaskRecord[]> {
  return (await invokeTauri<TaskRecord[]>("list_tasks")) ?? [];
}

export async function createTask(payload: {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: "low" | "normal" | "high";
  assigneeAgentId?: string | null;
  parentTaskId?: string | null;
}): Promise<TaskRecord | null> {
  return invokeTauri<TaskRecord>("create_task", {
    payload: {
      title: payload.title,
      description: payload.description ?? null,
      status: payload.status ?? null,
      priority: payload.priority ?? null,
      assigneeAgentId: payload.assigneeAgentId ?? null,
      parentTaskId: payload.parentTaskId ?? null
    }
  });
}

export async function updateTask(
  taskId: string,
  patch: {
    title?: string;
    description?: string;
    status?: TaskStatus;
    priority?: "low" | "normal" | "high";
    assigneeAgentId?: string | null;
  }
): Promise<TaskRecord | null> {
  const patchPayload: Record<string, unknown> = {};
  if ("title" in patch) {
    patchPayload.title = patch.title ?? null;
  }
  if ("description" in patch) {
    patchPayload.description = patch.description ?? null;
  }
  if ("status" in patch) {
    patchPayload.status = patch.status ?? null;
  }
  if ("priority" in patch) {
    patchPayload.priority = patch.priority ?? null;
  }
  if ("assigneeAgentId" in patch) {
    patchPayload.assigneeAgentId = patch.assigneeAgentId ?? null;
  }
  return invokeTauri<TaskRecord>("update_task", {
    task_id: taskId,
    patch: patchPayload
  });
}

export async function deleteTask(taskId: string): Promise<boolean> {
  return (await invokeTauri<boolean>("delete_task", { task_id: taskId })) ?? false;
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

export async function chatCheckpoints(swarmId = "swarm_main", limit = 50): Promise<CheckpointRecord[]> {
  return (await invokeTauri<CheckpointRecord[]>("chat_checkpoints", { swarm_id: swarmId, limit })) ?? [];
}

export async function chatRewind(
  threadId: string,
  checkpointId: string,
  editPrompt?: string
): Promise<SwarmChatMessage[]> {
  return (
    (await invokeTauri<SwarmChatMessage[]>("chat_rewind", {
      thread_id: threadId,
      checkpoint_id: checkpointId,
      edit_prompt: editPrompt ?? null
    })) ?? []
  );
}

export async function getBudgets(): Promise<BudgetSnapshot | null> {
  return invokeTauri<BudgetSnapshot>("get_budgets");
}

export async function updateBudget(
  agentId: string,
  tokenLimit: number,
  costLimitUsd: number,
  hardKill: boolean
): Promise<AgentBudget | null> {
  return invokeTauri<AgentBudget>("update_budget", {
    agent_id: agentId,
    token_limit: tokenLimit,
    cost_limit_usd: costLimitUsd,
    hard_kill: hardKill
  });
}

export async function mcpListServers(query = ""): Promise<McpServerEntry[]> {
  return (await invokeTauri<McpServerEntry[]>("mcp_list_servers", { query })) ?? [];
}

export async function mcpRegisterServer(
  url: string,
  name?: string,
  capabilities?: string[]
): Promise<McpServerEntry | null> {
  return invokeTauri<McpServerEntry>("mcp_register_server", {
    url,
    name: name ?? null,
    capabilities: capabilities ?? []
  });
}

export async function mcpConnectServer(serverId: string, scopes: string[]): Promise<McpServerEntry | null> {
  return invokeTauri<McpServerEntry>("mcp_connect_server", { server_id: serverId, scopes });
}

export async function mcpDisconnectServer(serverId: string): Promise<McpServerEntry | null> {
  return invokeTauri<McpServerEntry>("mcp_disconnect_server", { server_id: serverId });
}

export async function mcpListTools(serverId: string): Promise<McpToolEntry[]> {
  return (await invokeTauri<McpToolEntry[]>("mcp_list_tools", { server_id: serverId })) ?? [];
}

export async function mcpInvokeTool(
  serverId: string,
  toolId: string,
  agentId: string,
  args?: Record<string, unknown>
): Promise<McpInvokeResult | null> {
  return invokeTauri<McpInvokeResult>("mcp_invoke_tool", {
    server_id: serverId,
    tool_id: toolId,
    agent_id: agentId,
    args: args ?? {}
  });
}

export async function vaultSummary(): Promise<VaultSummary | null> {
  return invokeTauri<VaultSummary>("vault_summary");
}

export async function vaultCapacity(): Promise<VaultStorageStats | null> {
  return invokeTauri<VaultStorageStats>("vault_capacity");
}

export async function vaultRecent(limit = 40): Promise<VaultEntry[]> {
  return (await invokeTauri<VaultEntry[]>("vault_recent", { limit })) ?? [];
}

export async function vaultSearch(query: string, limit = 40): Promise<VaultEntry[]> {
  return (await invokeTauri<VaultEntry[]>("vault_search", { query, limit })) ?? [];
}

export async function vaultDeposit(input: {
  type: VaultEntryType;
  title: string;
  markdownSummary: string;
  importanceScore?: number;
  tags?: string[];
  agentId: string;
  taskId?: string;
  encrypted?: boolean;
}): Promise<VaultEntry | null> {
  return invokeTauri<VaultEntry>("vault_deposit", {
    entry_type: input.type,
    title: input.title,
    markdown_summary: input.markdownSummary,
    importance_score: input.importanceScore ?? 7,
    tags: input.tags ?? [],
    agent_id: input.agentId,
    task_id: input.taskId ?? null,
    encrypted: input.encrypted ?? false
  });
}

export async function vaultPrune(maxImportance = 3): Promise<{ result?: { removed: number } } | null> {
  return invokeTauri<{ result?: { removed: number } }>("vault_prune", { max_importance: maxImportance });
}

export async function vaultListVersions(entryId: string): Promise<VaultVersion[]> {
  return (await invokeTauri<VaultVersion[]>("vault_list_versions", { entry_id: entryId })) ?? [];
}

export async function vaultUpdateEntry(
  entryId: string,
  patch: {
    title?: string;
    markdownSummary?: string;
    importanceScore?: number;
    tags?: string[];
    encrypted?: boolean;
  }
): Promise<VaultEntry | null> {
  return invokeTauri<VaultEntry>("vault_update_entry", {
    entry_id: entryId,
    title: patch.title ?? null,
    markdown_summary: patch.markdownSummary ?? null,
    importance_score: patch.importanceScore ?? null,
    tags: patch.tags ?? null,
    encrypted: patch.encrypted ?? null
  });
}

export async function vaultCreateVersion(
  entryId: string,
  input: {
    markdownSummary?: string;
    blobPath?: string;
    diff?: string;
    importanceScore?: number;
    tags?: string[];
  }
): Promise<VaultVersion | null> {
  return invokeTauri<VaultVersion>("vault_create_version", {
    entry_id: entryId,
    markdown_summary: input.markdownSummary ?? null,
    blob_path: input.blobPath ?? null,
    diff: input.diff ?? null,
    importance_score: input.importanceScore ?? null,
    tags: input.tags ?? null
  });
}

export async function vaultStorageInfo(): Promise<VaultStorageInfo | null> {
  return invokeTauri<VaultStorageInfo>("vault_storage_info");
}

export async function vaultRelocateStorage(path: string, moveExisting = true): Promise<VaultStorageInfo | null> {
  return invokeTauri<VaultStorageInfo>("vault_relocate_storage", {
    path,
    move_existing: moveExisting
  });
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

export async function getHealthSnapshot(): Promise<HealthSnapshot | null> {
  return invokeTauri<HealthSnapshot>("get_health_snapshot");
}

export async function getHealthEvents(limit = 150, category?: string): Promise<HealthTelemetryEvent[]> {
  return (await invokeTauri<HealthTelemetryEvent[]>("get_health_events", { limit, category: category ?? null })) ?? [];
}

export async function exportHealthTelemetry(format: "json" | "csv", limit = 300): Promise<HealthExportResult | null> {
  return invokeTauri<HealthExportResult>("export_health_telemetry", { format, limit });
}

export async function getAnalyticsSnapshot(range: "7d" | "30d" | "90d" = "30d"): Promise<AnalyticsSnapshot | null> {
  return invokeTauri<AnalyticsSnapshot>("get_analytics_snapshot", { range });
}

export async function exportAnalyticsReport(
  range: "7d" | "30d" | "90d" = "30d",
  format: "json" | "csv" = "json"
): Promise<AnalyticsExportResult | null> {
  return invokeTauri<AnalyticsExportResult>("export_analytics_report", { range, format });
}

