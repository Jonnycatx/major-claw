export type TaskStatus = "inbox" | "assigned" | "in_progress" | "review" | "done" | "failed";

export type AgentStatus = "online" | "offline" | "degraded" | "idle" | "busy" | "error";

export interface AgentProfile {
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
}

export interface AgentStats {
  agentId: string;
  tokensToday: number;
  tasksCompleted: number;
  lastUpdated: string;
}

export interface AgentConfigPatch {
  modelProvider?: string;
  modelName?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  status?: AgentStatus;
}

export interface AgentCreatePayload {
  name: string;
  role: string;
  parentId?: string | null;
  modelProvider: string;
  modelName: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentFullConfig extends AgentProfile {
  apiKeyMasked?: string;
  installedSkills: string[];
  stats: AgentStats;
}

export type AgentQuickAction = "pause" | "clone" | "delete" | "logs";

export interface AgentActionResult {
  success: boolean;
  message: string;
  action: AgentQuickAction;
  agentId: string;
}

export interface AgentConnectionTestResult {
  ok: boolean;
  message: string;
  status: AgentStatus;
}

export type IntegrationStatus = "connected" | "disconnected" | "setup_required";

export interface IntegrationEntry {
  slug: string;
  name: string;
  category: string;
  description: string;
  setup: string[];
  permissions: string[];
  status: IntegrationStatus;
  assignedAgentIds: string[];
}

export interface IntegrationsListResult {
  items: IntegrationEntry[];
  categories: { name: string; connectedCount: number; totalCount: number }[];
}

export interface TaskRecord {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: "low" | "normal" | "high";
  assigneeAgentId: string | null;
  parentTaskId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  sender: string;
  body: string;
  createdAt: string;
}

export type SwarmChatMessageType = "user" | "cso" | "agent_update" | "delegation" | "skill_suggestion" | "system";

export interface DelegationPlanStep {
  id: string;
  task: string;
  agentId: string;
  status: "planned" | "assigned" | "in_progress" | "done" | "failed";
}

export interface SkillSuggestionPayload {
  slug: string;
  name: string;
  reason: string;
  targetAgentId: string;
  permissions: string[];
}

export interface SwarmChatMessage {
  id: string;
  threadId: string;
  type: SwarmChatMessageType;
  author: string;
  content: string;
  createdAt: string;
  parentMessageId?: string;
  metadata?: Record<string, unknown>;
}

export interface SwarmChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface SwarmSummary {
  onlineAgents: number;
  activeTasks: number;
  spendTodayUsd: number;
  heartbeat: string;
}

export interface UsageReport {
  agentId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  timestamp: string;
}

export interface PermissionGrant {
  id: string;
  agentId: string;
  capability: string;
  granted: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  category: string;
  action: string;
  actor: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface GatewayEnvelope<TPayload = unknown> {
  type: string;
  timestamp: string;
  requestId?: string;
  instanceId?: string;
  payload: TPayload;
}

export interface OpenClawInstanceConfig {
  id: string;
  name: string;
  wsUrl: string;
  authToken?: string;
}

export type ClawHubSort = "downloads" | "newest";

export interface ClawHubSkill {
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
}

export interface ClawHubLiveSkillsResult {
  skills: ClawHubSkill[];
  nextCursor: string | null;
  source: "live" | "cache";
}

export interface ClawHubInstallResult {
  slug: string;
  installed: boolean;
  assignedAgentId: string | null;
  message: string;
  requestedPermissionIds?: string[];
}
