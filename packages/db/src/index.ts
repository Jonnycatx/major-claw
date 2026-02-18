import type {
  AgentConfigPatch,
  AgentCreatePayload,
  AgentFullConfig,
  AgentProfile,
  AgentStats,
  AuditLog,
  ChatMessage,
  DelegationPlanStep,
  ClawHubSkill,
  PermissionGrant,
  SkillSuggestionPayload,
  SwarmChatMessage,
  SwarmChatThread,
  SwarmSummary,
  TaskRecord,
  UsageReport
} from "@majorclaw/shared-types";
export { loadMigrationBundle, type MigrationBundle } from "./migrations.js";

export interface TaskEvent {
  id: string;
  taskId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface DataStore {
  agents: AgentProfile[];
  apiKeys: { agentId: string; encrypted: string }[];
  agentStats: AgentStats[];
  tasks: TaskRecord[];
  taskEvents: TaskEvent[];
  chatMessages: ChatMessage[];
  chatThreads: SwarmChatThread[];
  swarmMessages: SwarmChatMessage[];
  delegationPlans: { messageId: string; steps: DelegationPlanStep[] }[];
  skillSuggestions: { messageId: string; suggestion: SkillSuggestionPayload }[];
  skills: ClawHubSkill[];
  agentSkills: { agentId: string; skillSlug: string; enabled: boolean; assignedAt: string }[];
  usageReports: UsageReport[];
  permissions: PermissionGrant[];
  auditLogs: AuditLog[];
}

export function createInMemoryStore(): DataStore {
  return {
    agents: [],
    apiKeys: [],
    agentStats: [],
    tasks: [],
    taskEvents: [],
    chatMessages: [],
    chatThreads: [],
    swarmMessages: [],
    delegationPlans: [],
    skillSuggestions: [],
    skills: [],
    agentSkills: [],
    usageReports: [],
    permissions: [],
    auditLogs: []
  };
}

export class Repository {
  constructor(private readonly db: DataStore) {}

  listAgents(): AgentProfile[] {
    return this.db.agents;
  }

  getAgent(agentId: string): AgentProfile | undefined {
    return this.db.agents.find((agent) => agent.id === agentId);
  }

  deleteAgent(agentId: string): void {
    this.db.agents = this.db.agents.filter((agent) => agent.id !== agentId && agent.parentId !== agentId);
    this.db.agentSkills = this.db.agentSkills.filter((entry) => entry.agentId !== agentId);
    this.db.apiKeys = this.db.apiKeys.filter((entry) => entry.agentId !== agentId);
    this.db.agentStats = this.db.agentStats.filter((entry) => entry.agentId !== agentId);
  }

  upsertAgent(agent: AgentProfile): void {
    const idx = this.db.agents.findIndex((item) => item.id === agent.id);
    if (idx === -1) {
      this.db.agents.push(agent);
      return;
    }
    this.db.agents[idx] = agent;
  }

  createAgent(payload: AgentCreatePayload): AgentProfile {
    const now = new Date().toISOString();
    const agent: AgentProfile = {
      id: `agent_${payload.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_")}_${Math.random().toString(36).slice(2, 6)}`,
      name: payload.name.trim(),
      role: payload.role,
      modelProfileId: `${payload.modelProvider}:${payload.modelName}`,
      modelProvider: payload.modelProvider,
      modelName: payload.modelName,
      temperature: payload.temperature ?? 0.7,
      maxTokens: payload.maxTokens ?? 8192,
      status: "idle",
      parentId: payload.parentId ?? "agent_cso",
      lastHeartbeat: now
    };
    this.upsertAgent(agent);
    this.upsertAgentStats({
      agentId: agent.id,
      tokensToday: 0,
      tasksCompleted: 0,
      lastUpdated: now
    });
    return agent;
  }

  updateAgentConfig(agentId: string, patch: AgentConfigPatch): AgentProfile {
    const current = this.getAgent(agentId);
    if (!current) {
      throw new Error(`agent not found: ${agentId}`);
    }
    const updated: AgentProfile = {
      ...current,
      modelProvider: patch.modelProvider ?? current.modelProvider ?? "anthropic",
      modelName: patch.modelName ?? current.modelName ?? "claude-3-5-sonnet",
      modelProfileId: `${patch.modelProvider ?? current.modelProvider ?? "anthropic"}:${patch.modelName ?? current.modelName ?? "claude-3-5-sonnet"}`,
      temperature: patch.temperature ?? current.temperature ?? 0.7,
      maxTokens: patch.maxTokens ?? current.maxTokens ?? 8192,
      status: patch.status ?? current.status,
      lastHeartbeat: new Date().toISOString()
    };
    this.upsertAgent(updated);
    return updated;
  }

  setEncryptedApiKey(agentId: string, encrypted: string): void {
    const idx = this.db.apiKeys.findIndex((item) => item.agentId === agentId);
    if (idx === -1) {
      this.db.apiKeys.push({ agentId, encrypted });
      return;
    }
    this.db.apiKeys[idx] = { agentId, encrypted };
  }

  getEncryptedApiKey(agentId: string): string | null {
    return this.db.apiKeys.find((item) => item.agentId === agentId)?.encrypted ?? null;
  }

  reorderAgents(order: string[]): AgentProfile[] {
    const rank = new Map(order.map((id, index) => [id, index]));
    this.db.agents = [...this.db.agents].sort((a, b) => {
      const aRank = rank.get(a.id);
      const bRank = rank.get(b.id);
      if (aRank == null && bRank == null) {
        return a.name.localeCompare(b.name);
      }
      if (aRank == null) {
        return 1;
      }
      if (bRank == null) {
        return -1;
      }
      return aRank - bRank;
    });
    return this.db.agents;
  }

  upsertAgentStats(stats: AgentStats): void {
    const idx = this.db.agentStats.findIndex((item) => item.agentId === stats.agentId);
    if (idx === -1) {
      this.db.agentStats.push(stats);
      return;
    }
    this.db.agentStats[idx] = stats;
  }

  getAgentStats(agentId: string): AgentStats {
    const existing = this.db.agentStats.find((item) => item.agentId === agentId);
    if (existing) {
      return existing;
    }
    const baseline: AgentStats = {
      agentId,
      tokensToday: 0,
      tasksCompleted: 0,
      lastUpdated: new Date().toISOString()
    };
    this.db.agentStats.push(baseline);
    return baseline;
  }

  getAgentFullConfig(agentId: string): AgentFullConfig {
    const agent = this.getAgent(agentId);
    if (!agent) {
      throw new Error(`agent not found: ${agentId}`);
    }
    const stats = this.getAgentStats(agentId);
    const installedSkills = this.listAgentSkills(agentId)
      .filter((item) => item.enabled)
      .map((item) => item.skillSlug);
    const encrypted = this.getEncryptedApiKey(agentId);
    return {
      ...agent,
      apiKeyMasked: encrypted ? "••••••••" : "",
      installedSkills,
      stats
    };
  }

  listTasks(): TaskRecord[] {
    return this.db.tasks;
  }

  getTask(taskId: string): TaskRecord | undefined {
    return this.db.tasks.find((task) => task.id === taskId);
  }

  upsertTask(task: TaskRecord): void {
    const idx = this.db.tasks.findIndex((item) => item.id === task.id);
    if (idx === -1) {
      this.db.tasks.push(task);
      return;
    }
    this.db.tasks[idx] = task;
  }

  appendChatMessage(message: ChatMessage): void {
    this.db.chatMessages.push(message);
  }

  listChatThreads(): SwarmChatThread[] {
    return this.db.chatThreads;
  }

  upsertChatThread(thread: SwarmChatThread): void {
    const idx = this.db.chatThreads.findIndex((item) => item.id === thread.id);
    if (idx === -1) {
      this.db.chatThreads.push(thread);
      return;
    }
    this.db.chatThreads[idx] = thread;
  }

  appendSwarmMessage(message: SwarmChatMessage): void {
    this.db.swarmMessages.push(message);
  }

  listSwarmMessages(threadId: string): SwarmChatMessage[] {
    return this.db.swarmMessages.filter((message) => message.threadId === threadId);
  }

  upsertDelegationPlan(messageId: string, steps: DelegationPlanStep[]): void {
    const idx = this.db.delegationPlans.findIndex((item) => item.messageId === messageId);
    if (idx === -1) {
      this.db.delegationPlans.push({ messageId, steps });
      return;
    }
    this.db.delegationPlans[idx] = { messageId, steps };
  }

  upsertSkillSuggestion(messageId: string, suggestion: SkillSuggestionPayload): void {
    const idx = this.db.skillSuggestions.findIndex((item) => item.messageId === messageId);
    if (idx === -1) {
      this.db.skillSuggestions.push({ messageId, suggestion });
      return;
    }
    this.db.skillSuggestions[idx] = { messageId, suggestion };
  }

  getSwarmSummary(): SwarmSummary {
    const onlineAgents = this.db.agents.filter((agent) => agent.status === "online" || agent.status === "busy").length;
    const activeTasks = this.db.tasks.filter((task) => task.status !== "done" && task.status !== "failed").length;
    const spendTodayUsd = this.db.usageReports
      .filter((report) => {
        const day = new Date(report.timestamp).toDateString();
        return day === new Date().toDateString();
      })
      .reduce((sum, item) => sum + item.costUsd, 0);
    return {
      onlineAgents,
      activeTasks,
      spendTodayUsd,
      heartbeat: new Date().toISOString()
    };
  }

  addTaskEvent(event: TaskEvent): void {
    this.db.taskEvents.push(event);
  }

  listTaskTimeline(taskId: string): TaskEvent[] {
    return this.db.taskEvents.filter((event) => event.taskId === taskId);
  }

  addUsageReport(report: UsageReport): void {
    this.db.usageReports.push(report);
  }

  upsertSkill(skill: ClawHubSkill): void {
    const idx = this.db.skills.findIndex((item) => item.slug === skill.slug);
    if (idx === -1) {
      this.db.skills.push(skill);
      return;
    }
    this.db.skills[idx] = skill;
  }

  listSkills(): ClawHubSkill[] {
    return this.db.skills;
  }

  getSkill(slug: string): ClawHubSkill | undefined {
    return this.db.skills.find((skill) => skill.slug === slug);
  }

  assignSkill(agentId: string, skillSlug: string, enabled = true): void {
    const idx = this.db.agentSkills.findIndex((item) => item.agentId === agentId && item.skillSlug === skillSlug);
    const record = { agentId, skillSlug, enabled, assignedAt: new Date().toISOString() };
    if (idx === -1) {
      this.db.agentSkills.push(record);
      return;
    }
    this.db.agentSkills[idx] = record;
  }

  listAgentSkills(agentId?: string): { agentId: string; skillSlug: string; enabled: boolean; assignedAt: string }[] {
    if (!agentId) {
      return this.db.agentSkills;
    }
    return this.db.agentSkills.filter((entry) => entry.agentId === agentId);
  }

  toggleAgentSkill(agentId: string, skillSlug: string, enabled: boolean): void {
    const idx = this.db.agentSkills.findIndex((item) => item.agentId === agentId && item.skillSlug === skillSlug);
    if (idx === -1) {
      this.db.agentSkills.push({ agentId, skillSlug, enabled, assignedAt: new Date().toISOString() });
      return;
    }
    const current = this.db.agentSkills[idx]!;
    this.db.agentSkills[idx] = {
      agentId: current.agentId,
      skillSlug: current.skillSlug,
      assignedAt: current.assignedAt,
      enabled
    };
  }

  addPermission(grant: PermissionGrant): void {
    this.db.permissions.push(grant);
  }

  addAuditLog(log: AuditLog): void {
    this.db.auditLogs.push(log);
  }

  listAuditLogs(limit = 100): AuditLog[] {
    return this.db.auditLogs.slice(-limit).reverse();
  }
}
