import type {
  AgentBudget,
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
  CheckpointRecord,
  VaultEntry,
  VaultStorageStats,
  VaultSummary,
  VaultVersion,
  TaskRecord,
  UsageReport
} from "@majorclaw/shared-types";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { loadMigrationBundle } from "./migrations.js";
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
  budgets: AgentBudget[];
  checkpoints: CheckpointRecord[];
  vaultEntries: VaultEntry[];
  vaultVersions: VaultVersion[];
  storageStats: VaultStorageStats[];
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
    budgets: [],
    checkpoints: [],
    vaultEntries: [],
    vaultVersions: [],
    storageStats: [],
    permissions: [],
    auditLogs: []
  };
}

const DEFAULT_DB_PATH = resolve(homedir(), ".major-claw", "data", "app.db");
const STATE_KEY = "runtime";

function cloneStore(input: DataStore): DataStore {
  return JSON.parse(JSON.stringify(input)) as DataStore;
}

export class SqliteRuntimePersistence {
  private readonly db: DatabaseSync;

  constructor(private readonly dbPath = process.env.MAJORCLAW_DB_PATH ?? DEFAULT_DB_PATH) {
    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA synchronous = NORMAL;");
    this.db.exec("PRAGMA busy_timeout = 5000;");
    const { schemaSql } = loadMigrationBundle();
    this.db.exec(schemaSql);
    // Legacy snapshot table is kept only for one-time migration compatibility.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runtime_state (
        state_key TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS swarm_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        type TEXT NOT NULL,
        author TEXT NOT NULL,
        content TEXT NOT NULL,
        parent_message_id TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_swarm_messages_thread_created ON swarm_messages(thread_id, created_at);
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS delegation_plans (
        message_id TEXT PRIMARY KEY,
        steps_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS skill_suggestions (
        message_id TEXT PRIMARY KEY,
        suggestion_json TEXT NOT NULL
      );
    `);
  }

  loadOrInit(initial: DataStore): DataStore {
    const fromTables = this.hydrateFromCoreTables(cloneStore(initial));
    if (this.hasOperationalData(fromTables)) {
      return fromTables;
    }

    // One-time legacy migration path: import runtime snapshot if tables are empty.
    const legacy = this.loadLegacyRuntimeSnapshot();
    if (legacy) {
      this.persistCoreTables(legacy);
      return legacy;
    }

    // Fresh install path.
    this.persistCoreTables(initial);
    return cloneStore(initial);
  }

  save(state: DataStore): void {
    // Production source-of-truth is table-backed state.
    this.persistCoreTables(state);
  }

  flush(): void {
    this.db.exec("PRAGMA wal_checkpoint(FULL);");
  }

  private loadLegacyRuntimeSnapshot(): DataStore | null {
    const row = this.db
      .prepare("SELECT payload_json FROM runtime_state WHERE state_key = ?")
      .get(STATE_KEY) as { payload_json: string } | undefined;
    if (!row) {
      return null;
    }
    try {
      return JSON.parse(row.payload_json) as DataStore;
    } catch {
      return null;
    }
  }

  private hasOperationalData(state: DataStore): boolean {
    return (
      state.agents.length > 0 ||
      state.tasks.length > 0 ||
      state.chatThreads.length > 0 ||
      state.swarmMessages.length > 0 ||
      state.vaultEntries.length > 0 ||
      state.permissions.length > 0 ||
      state.auditLogs.length > 0
    );
  }

  private hydrateFromCoreTables(base: DataStore): DataStore {
    const next = cloneStore(base);

    const agents = this.db
      .prepare(
        `SELECT id,name,role,model_profile_id,model_provider,model_name,temperature,max_tokens,status,parent_id,last_heartbeat,api_key_encrypted
         FROM agents
         ORDER BY updated_at ASC`
      )
      .all() as Array<{
      id: string;
      name: string;
      role: string;
      model_profile_id: string;
      model_provider: string | null;
      model_name: string | null;
      temperature: number | null;
      max_tokens: number | null;
      status: string;
      parent_id: string | null;
      last_heartbeat: string | null;
      api_key_encrypted: string | null;
    }>;
    if (agents.length > 0) {
      next.agents = agents.map((row) => {
        const agent: AgentProfile = {
          id: row.id,
          name: row.name,
          role: row.role,
          modelProfileId: row.model_profile_id,
          status: row.status as AgentProfile["status"],
          parentId: row.parent_id,
          lastHeartbeat: row.last_heartbeat
        };
        if (row.model_provider !== null) {
          agent.modelProvider = row.model_provider;
        }
        if (row.model_name !== null) {
          agent.modelName = row.model_name;
        }
        if (row.temperature !== null) {
          agent.temperature = row.temperature;
        }
        if (row.max_tokens !== null) {
          agent.maxTokens = row.max_tokens;
        }
        return agent;
      });
      next.apiKeys = agents
        .filter((row) => Boolean(row.api_key_encrypted))
        .map((row) => ({ agentId: row.id, encrypted: row.api_key_encrypted ?? "" }));
    }

    const agentStats = this.db
      .prepare(`SELECT agent_id,tokens_today,tasks_completed,last_updated FROM agent_stats`)
      .all() as Array<{ agent_id: string; tokens_today: number; tasks_completed: number; last_updated: string }>;
    if (agentStats.length > 0) {
      next.agentStats = agentStats.map((row) => ({
        agentId: row.agent_id,
        tokensToday: row.tokens_today,
        tasksCompleted: row.tasks_completed,
        lastUpdated: row.last_updated
      }));
    }

    const tasks = this.db
      .prepare(
        `SELECT id,title,description,status,priority,assignee_agent_id,parent_task_id,created_at,updated_at
         FROM tasks ORDER BY created_at ASC`
      )
      .all() as Array<{
      id: string;
      title: string;
      description: string | null;
      status: string;
      priority: "low" | "normal" | "high";
      assignee_agent_id: string | null;
      parent_task_id: string | null;
      created_at: string;
      updated_at: string;
    }>;
    if (tasks.length > 0) {
      next.tasks = tasks.map((row) => {
        const task: TaskRecord = {
          id: row.id,
          title: row.title,
          status: row.status as TaskRecord["status"],
          priority: row.priority,
          assigneeAgentId: row.assignee_agent_id,
          parentTaskId: row.parent_task_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        if (row.description !== null) {
          task.description = row.description;
        }
        return task;
      });
    }

    const taskEvents = this.db
      .prepare(`SELECT id,task_id,event_type,payload_json,created_at FROM task_events ORDER BY created_at ASC`)
      .all() as Array<{ id: string; task_id: string; event_type: string; payload_json: string; created_at: string }>;
    if (taskEvents.length > 0) {
      next.taskEvents = taskEvents.map((row) => ({
        id: row.id,
        taskId: row.task_id,
        eventType: row.event_type,
        payload: JSON.parse(row.payload_json) as Record<string, unknown>,
        createdAt: row.created_at
      }));
    }

    const threads = this.db
      .prepare(`SELECT id,title,created_at FROM chat_threads ORDER BY created_at ASC`)
      .all() as Array<{ id: string; title: string; created_at: string }>;
    if (threads.length > 0) {
      next.chatThreads = threads.map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.created_at
      }));
    }

    const swarmMessages = this.db
      .prepare(
        `SELECT id,thread_id,type,author,content,parent_message_id,metadata_json,created_at
         FROM swarm_messages ORDER BY created_at ASC`
      )
      .all() as Array<{
      id: string;
      thread_id: string;
      type: string;
      author: string;
      content: string;
      parent_message_id: string | null;
      metadata_json: string | null;
      created_at: string;
    }>;
    if (swarmMessages.length > 0) {
      next.swarmMessages = swarmMessages.map((row) => {
        const message: SwarmChatMessage = {
          id: row.id,
          threadId: row.thread_id,
          type: row.type as SwarmChatMessage["type"],
          author: row.author,
          content: row.content,
          createdAt: row.created_at
        };
        if (row.parent_message_id !== null) {
          message.parentMessageId = row.parent_message_id;
        }
        if (row.metadata_json) {
          message.metadata = JSON.parse(row.metadata_json) as Record<string, unknown>;
        }
        return message;
      });
    }

    const chatMessages = this.db
      .prepare(`SELECT id,thread_id,sender,body,created_at FROM chat_messages ORDER BY created_at ASC`)
      .all() as Array<{ id: string; thread_id: string; sender: string; body: string; created_at: string }>;
    if (chatMessages.length > 0) {
      next.chatMessages = chatMessages.map((row) => ({
        id: row.id,
        threadId: row.thread_id,
        sender: row.sender,
        body: row.body,
        createdAt: row.created_at
      }));
    }

    const delegationPlans = this.db
      .prepare(`SELECT message_id,steps_json FROM delegation_plans`)
      .all() as Array<{ message_id: string; steps_json: string }>;
    if (delegationPlans.length > 0) {
      next.delegationPlans = delegationPlans.map((row) => ({
        messageId: row.message_id,
        steps: JSON.parse(row.steps_json) as DelegationPlanStep[]
      }));
    }

    const skillSuggestions = this.db
      .prepare(`SELECT message_id,suggestion_json FROM skill_suggestions`)
      .all() as Array<{ message_id: string; suggestion_json: string }>;
    if (skillSuggestions.length > 0) {
      next.skillSuggestions = skillSuggestions.map((row) => ({
        messageId: row.message_id,
        suggestion: JSON.parse(row.suggestion_json) as SkillSuggestionPayload
      }));
    }

    const vaultEntries = this.db
      .prepare(
        `SELECT id,type,title,markdown_summary,importance_score,tags_json,agent_id,task_id,version,blob_path,created_at,expires_at,encrypted
         FROM vault_entries ORDER BY created_at ASC`
      )
      .all() as Array<{
      id: string;
      type: string;
      title: string;
      markdown_summary: string;
      importance_score: number;
      tags_json: string;
      agent_id: string;
      task_id: string | null;
      version: number;
      blob_path: string | null;
      created_at: string;
      expires_at: string | null;
      encrypted: number;
    }>;
    if (vaultEntries.length > 0) {
      next.vaultEntries = vaultEntries.map((row) => {
        const entry: VaultEntry = {
          id: row.id,
          type: row.type as VaultEntry["type"],
          title: row.title,
          markdownSummary: row.markdown_summary,
          importanceScore: row.importance_score,
          tags: JSON.parse(row.tags_json) as string[],
          agentId: row.agent_id,
          version: row.version,
          createdAt: row.created_at,
          encrypted: Boolean(row.encrypted)
        };
        if (row.task_id !== null) {
          entry.taskId = row.task_id;
        }
        if (row.blob_path !== null) {
          entry.blobPath = row.blob_path;
        }
        if (row.expires_at !== null) {
          entry.expiresAt = row.expires_at;
        }
        return entry;
      });
    }

    const vaultVersions = this.db
      .prepare(`SELECT entry_id,version_num,blob_path,diff,created_at FROM vault_versions ORDER BY created_at ASC`)
      .all() as Array<{ entry_id: string; version_num: number; blob_path: string | null; diff: string | null; created_at: string }>;
    if (vaultVersions.length > 0) {
      next.vaultVersions = vaultVersions.map((row) => {
        const version: VaultVersion = {
          entryId: row.entry_id,
          versionNum: row.version_num,
          createdAt: row.created_at
        };
        if (row.blob_path !== null) {
          version.blobPath = row.blob_path;
        }
        if (row.diff !== null) {
          version.diff = row.diff;
        }
        return version;
      });
    }

    const skills = this.db
      .prepare(
        `SELECT slug,display_name,summary,author,downloads,stars,version,tags_json,stats_json,categories_json,permissions_json,installed,last_fetched
         FROM skills`
      )
      .all() as Array<{
      slug: string;
      display_name: string;
      summary: string | null;
      author: string | null;
      downloads: number;
      stars: number;
      version: string;
      tags_json: string;
      stats_json: string;
      categories_json: string;
      permissions_json: string;
      installed: number;
      last_fetched: string;
    }>;
    if (skills.length > 0) {
      next.skills = skills.map((row) => ({
        slug: row.slug,
        name: row.display_name,
        author: row.author ?? "community",
        description: row.summary ?? "",
        downloads: row.downloads,
        stars: row.stars,
        version: row.version,
        categories: JSON.parse(row.categories_json) as string[],
        permissions: JSON.parse(row.permissions_json) as string[],
        installed: Boolean(row.installed)
      }));
    }

    const agentSkills = this.db
      .prepare(`SELECT agent_id,skill_slug,enabled,assigned_at FROM agent_skills`)
      .all() as Array<{ agent_id: string; skill_slug: string; enabled: number; assigned_at: string }>;
    if (agentSkills.length > 0) {
      next.agentSkills = agentSkills.map((row) => ({
        agentId: row.agent_id,
        skillSlug: row.skill_slug,
        enabled: Boolean(row.enabled),
        assignedAt: row.assigned_at
      }));
    }

    const usageReports = this.db
      .prepare(`SELECT id,agent_id,model,prompt_tokens,completion_tokens,cost_usd,timestamp FROM cost_snapshots ORDER BY timestamp ASC`)
      .all() as Array<{
      id: string;
      agent_id: string;
      model: string;
      prompt_tokens: number;
      completion_tokens: number;
      cost_usd: number;
      timestamp: string;
    }>;
    if (usageReports.length > 0) {
      next.usageReports = usageReports.map((row) => ({
        agentId: row.agent_id,
        model: row.model,
        promptTokens: row.prompt_tokens,
        completionTokens: row.completion_tokens,
        costUsd: row.cost_usd,
        timestamp: row.timestamp
      }));
    }

    const budgets = this.db
      .prepare(`SELECT agent_id,token_limit,cost_limit_usd,current_tokens,current_cost_usd,hard_kill,updated_at FROM budgets`)
      .all() as Array<{
      agent_id: string;
      token_limit: number;
      cost_limit_usd: number;
      current_tokens: number;
      current_cost_usd: number;
      hard_kill: number;
      updated_at: string;
    }>;
    if (budgets.length > 0) {
      next.budgets = budgets.map((row) => ({
        agentId: row.agent_id,
        tokenLimit: row.token_limit,
        costLimitUsd: row.cost_limit_usd,
        currentTokens: row.current_tokens,
        currentCostUsd: row.current_cost_usd,
        hardKill: Boolean(row.hard_kill),
        updatedAt: row.updated_at
      }));
    }

    const checkpoints = this.db
      .prepare(`SELECT id,swarm_id,step,state_json,prompt_snapshot,created_at FROM checkpoints ORDER BY created_at ASC`)
      .all() as Array<{ id: string; swarm_id: string; step: number; state_json: string; prompt_snapshot: string | null; created_at: string }>;
    if (checkpoints.length > 0) {
      next.checkpoints = checkpoints.map((row) => {
        const record: CheckpointRecord = {
          id: row.id,
          swarmId: row.swarm_id,
          step: row.step,
          stateJson: row.state_json,
          createdAt: row.created_at
        };
        if (row.prompt_snapshot !== null) {
          record.promptSnapshot = row.prompt_snapshot;
        }
        return record;
      });
    }

    const storageStats = this.db
      .prepare(`SELECT snapshot_time,archive_gb,files_gb,total_gb,free_gb FROM storage_stats ORDER BY snapshot_time ASC`)
      .all() as Array<{ snapshot_time: string; archive_gb: number; files_gb: number; total_gb: number; free_gb: number }>;
    if (storageStats.length > 0) {
      next.storageStats = storageStats.map((row) => ({
        snapshotTime: row.snapshot_time,
        archiveGb: row.archive_gb,
        filesGb: row.files_gb,
        totalGb: row.total_gb,
        freeGb: row.free_gb
      }));
    }

    const permissions = this.db
      .prepare(`SELECT id,agent_id,capability,granted,created_at FROM permissions`)
      .all() as Array<{ id: string; agent_id: string; capability: string; granted: number; created_at: string }>;
    if (permissions.length > 0) {
      next.permissions = permissions.map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        capability: row.capability,
        granted: Boolean(row.granted),
        createdAt: row.created_at
      }));
    }

    const auditLogs = this.db
      .prepare(`SELECT id,category,action,actor,metadata_json,created_at FROM audit_logs ORDER BY created_at ASC`)
      .all() as Array<{ id: string; category: string; action: string; actor: string; metadata_json: string; created_at: string }>;
    if (auditLogs.length > 0) {
      next.auditLogs = auditLogs.map((row) => ({
        id: row.id,
        category: row.category,
        action: row.action,
        actor: row.actor,
        metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
        createdAt: row.created_at
      }));
    }

    return next;
  }

  private persistCoreTables(state: DataStore): void {
    this.db.exec("BEGIN TRANSACTION;");
    try {
      this.db.exec("DELETE FROM agents;");
      this.db.exec("DELETE FROM agent_stats;");
      this.db.exec("DELETE FROM tasks;");
      this.db.exec("DELETE FROM task_events;");
      this.db.exec("DELETE FROM chat_threads;");
      this.db.exec("DELETE FROM chat_messages;");
      this.db.exec("DELETE FROM swarm_messages;");
      this.db.exec("DELETE FROM delegation_plans;");
      this.db.exec("DELETE FROM skill_suggestions;");
      this.db.exec("DELETE FROM skills;");
      this.db.exec("DELETE FROM agent_skills;");
      this.db.exec("DELETE FROM cost_snapshots;");
      this.db.exec("DELETE FROM budgets;");
      this.db.exec("DELETE FROM checkpoints;");
      this.db.exec("DELETE FROM vault_entries;");
      this.db.exec("DELETE FROM vault_versions;");
      this.db.exec("DELETE FROM storage_stats;");
      this.db.exec("DELETE FROM permissions;");
      this.db.exec("DELETE FROM audit_logs;");

      const now = new Date().toISOString();
      const keyByAgent = new Map(state.apiKeys.map((item) => [item.agentId, item.encrypted]));
      const upsertAgent = this.db.prepare(
        `INSERT INTO agents (
          id,name,role,model_profile_id,model_provider,model_name,api_key_encrypted,temperature,max_tokens,status,parent_id,last_heartbeat,created_at,updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const agent of state.agents) {
        upsertAgent.run(
          agent.id,
          agent.name,
          agent.role,
          agent.modelProfileId,
          agent.modelProvider ?? null,
          agent.modelName ?? null,
          keyByAgent.get(agent.id) ?? null,
          agent.temperature ?? 0.7,
          agent.maxTokens ?? 8192,
          agent.status,
          agent.parentId,
          agent.lastHeartbeat ?? null,
          now,
          now
        );
      }

      const upsertAgentStats = this.db.prepare(
        `INSERT INTO agent_stats (agent_id,tokens_today,tasks_completed,last_updated) VALUES (?, ?, ?, ?)`
      );
      for (const stat of state.agentStats) {
        upsertAgentStats.run(stat.agentId, stat.tokensToday, stat.tasksCompleted, stat.lastUpdated);
      }

      const insertTask = this.db.prepare(
        `INSERT INTO tasks (id,title,description,status,priority,assignee_agent_id,parent_task_id,created_at,updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const task of state.tasks) {
        insertTask.run(
          task.id,
          task.title,
          task.description ?? null,
          task.status,
          task.priority,
          task.assigneeAgentId,
          task.parentTaskId,
          task.createdAt,
          task.updatedAt
        );
      }

      const insertTaskEvent = this.db.prepare(
        `INSERT INTO task_events (id,task_id,event_type,payload_json,created_at) VALUES (?, ?, ?, ?, ?)`
      );
      for (const event of state.taskEvents) {
        insertTaskEvent.run(event.id, event.taskId, event.eventType, JSON.stringify(event.payload), event.createdAt);
      }

      const insertThread = this.db.prepare(`INSERT INTO chat_threads (id,title,task_id,created_at) VALUES (?, ?, ?, ?)`);
      for (const thread of state.chatThreads) {
        insertThread.run(thread.id, thread.title, null, thread.createdAt);
      }

      const insertChatMessage = this.db.prepare(
        `INSERT INTO chat_messages (id,thread_id,sender,body,created_at) VALUES (?, ?, ?, ?, ?)`
      );
      for (const message of state.chatMessages) {
        insertChatMessage.run(message.id, message.threadId, message.sender, message.body, message.createdAt);
      }

      const insertSwarmMessage = this.db.prepare(
        `INSERT INTO swarm_messages (id,thread_id,type,author,content,parent_message_id,metadata_json,created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const message of state.swarmMessages) {
        insertSwarmMessage.run(
          message.id,
          message.threadId,
          message.type,
          message.author,
          message.content,
          message.parentMessageId ?? null,
          message.metadata ? JSON.stringify(message.metadata) : null,
          message.createdAt
        );
      }

      const insertDelegation = this.db.prepare(
        `INSERT INTO delegation_plans (message_id,steps_json) VALUES (?, ?)`
      );
      for (const plan of state.delegationPlans) {
        insertDelegation.run(plan.messageId, JSON.stringify(plan.steps));
      }

      const insertSuggestion = this.db.prepare(
        `INSERT INTO skill_suggestions (message_id,suggestion_json) VALUES (?, ?)`
      );
      for (const suggestion of state.skillSuggestions) {
        insertSuggestion.run(suggestion.messageId, JSON.stringify(suggestion.suggestion));
      }

      const insertSkill = this.db.prepare(
        `INSERT INTO skills (
          slug,display_name,summary,author,downloads,stars,version,tags_json,stats_json,categories_json,permissions_json,installed,last_fetched
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const skill of state.skills) {
        insertSkill.run(
          skill.slug,
          skill.name,
          skill.description,
          skill.author,
          skill.downloads,
          skill.stars ?? 0,
          skill.version,
          JSON.stringify([]),
          JSON.stringify({ downloads: skill.downloads, stars: skill.stars ?? 0 }),
          JSON.stringify(skill.categories),
          JSON.stringify(skill.permissions),
          skill.installed ? 1 : 0,
          now
        );
      }

      const insertAgentSkill = this.db.prepare(
        `INSERT INTO agent_skills (agent_id,skill_slug,enabled,assigned_at) VALUES (?, ?, ?, ?)`
      );
      for (const assignment of state.agentSkills) {
        insertAgentSkill.run(assignment.agentId, assignment.skillSlug, assignment.enabled ? 1 : 0, assignment.assignedAt);
      }

      const insertUsage = this.db.prepare(
        `INSERT INTO cost_snapshots (id,agent_id,model,prompt_tokens,completion_tokens,cost_usd,timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const usage of state.usageReports) {
        insertUsage.run(
          `${usage.agentId}-${usage.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
          usage.agentId,
          usage.model,
          usage.promptTokens,
          usage.completionTokens,
          usage.costUsd,
          usage.timestamp
        );
      }

      const insertBudget = this.db.prepare(
        `INSERT INTO budgets (agent_id,token_limit,cost_limit_usd,current_tokens,current_cost_usd,hard_kill,updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const budget of state.budgets) {
        insertBudget.run(
          budget.agentId,
          budget.tokenLimit,
          budget.costLimitUsd,
          budget.currentTokens,
          budget.currentCostUsd,
          budget.hardKill ? 1 : 0,
          budget.updatedAt
        );
      }

      const insertCheckpoint = this.db.prepare(
        `INSERT INTO checkpoints (id,swarm_id,step,state_json,prompt_snapshot,created_at) VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const checkpoint of state.checkpoints) {
        insertCheckpoint.run(
          checkpoint.id,
          checkpoint.swarmId,
          checkpoint.step,
          checkpoint.stateJson,
          checkpoint.promptSnapshot ?? null,
          checkpoint.createdAt
        );
      }

      const insertVaultEntry = this.db.prepare(
        `INSERT INTO vault_entries (
          id,type,title,markdown_summary,importance_score,tags_json,agent_id,task_id,version,blob_path,created_at,expires_at,encrypted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const entry of state.vaultEntries) {
        insertVaultEntry.run(
          entry.id,
          entry.type,
          entry.title,
          entry.markdownSummary,
          entry.importanceScore,
          JSON.stringify(entry.tags),
          entry.agentId,
          entry.taskId ?? null,
          entry.version,
          entry.blobPath ?? null,
          entry.createdAt,
          entry.expiresAt ?? null,
          entry.encrypted ? 1 : 0
        );
      }

      const insertVaultVersion = this.db.prepare(
        `INSERT INTO vault_versions (entry_id,version_num,blob_path,diff,created_at) VALUES (?, ?, ?, ?, ?)`
      );
      for (const version of state.vaultVersions) {
        insertVaultVersion.run(version.entryId, version.versionNum, version.blobPath ?? null, version.diff ?? null, version.createdAt);
      }

      const insertStorage = this.db.prepare(
        `INSERT INTO storage_stats (snapshot_time,archive_gb,files_gb,total_gb,free_gb) VALUES (?, ?, ?, ?, ?)`
      );
      for (const stat of state.storageStats) {
        insertStorage.run(stat.snapshotTime, stat.archiveGb, stat.filesGb, stat.totalGb, stat.freeGb);
      }

      const insertPermission = this.db.prepare(
        `INSERT INTO permissions (id,agent_id,capability,granted,created_at) VALUES (?, ?, ?, ?, ?)`
      );
      for (const grant of state.permissions) {
        insertPermission.run(grant.id, grant.agentId, grant.capability, grant.granted ? 1 : 0, grant.createdAt);
      }

      const insertAudit = this.db.prepare(
        `INSERT INTO audit_logs (id,category,action,actor,metadata_json,created_at) VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const log of state.auditLogs) {
        insertAudit.run(log.id, log.category, log.action, log.actor, JSON.stringify(log.metadata), log.createdAt);
      }

      this.db.exec("COMMIT;");
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
  }
}

export class Repository {
  constructor(
    private readonly db: DataStore,
    private readonly onMutation?: (snapshot: DataStore) => void,
    private readonly onFlush?: () => void
  ) {}

  private commit(): void {
    if (this.onMutation) {
      this.onMutation(cloneStore(this.db));
    }
  }

  flush(): void {
    if (this.onFlush) {
      this.onFlush();
    }
  }

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
    this.commit();
  }

  upsertAgent(agent: AgentProfile): void {
    const idx = this.db.agents.findIndex((item) => item.id === agent.id);
    if (idx === -1) {
      this.db.agents.push(agent);
      this.commit();
      return;
    }
    this.db.agents[idx] = agent;
    this.commit();
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
    this.commit();
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
    this.commit();
    return updated;
  }

  setEncryptedApiKey(agentId: string, encrypted: string): void {
    const idx = this.db.apiKeys.findIndex((item) => item.agentId === agentId);
    if (idx === -1) {
      this.db.apiKeys.push({ agentId, encrypted });
      this.commit();
      return;
    }
    this.db.apiKeys[idx] = { agentId, encrypted };
    this.commit();
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
    this.commit();
    return this.db.agents;
  }

  upsertAgentStats(stats: AgentStats): void {
    const idx = this.db.agentStats.findIndex((item) => item.agentId === stats.agentId);
    if (idx === -1) {
      this.db.agentStats.push(stats);
      this.commit();
      return;
    }
    this.db.agentStats[idx] = stats;
    this.commit();
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
    this.commit();
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
      this.commit();
      return;
    }
    this.db.tasks[idx] = task;
    this.commit();
  }

  deleteTask(taskId: string): void {
    this.db.tasks = this.db.tasks.filter((task) => task.id !== taskId);
    this.db.taskEvents = this.db.taskEvents.filter((event) => event.taskId !== taskId);
    this.commit();
  }

  appendChatMessage(message: ChatMessage): void {
    this.db.chatMessages.push(message);
    this.commit();
  }

  listChatThreads(): SwarmChatThread[] {
    return this.db.chatThreads;
  }

  upsertChatThread(thread: SwarmChatThread): void {
    const idx = this.db.chatThreads.findIndex((item) => item.id === thread.id);
    if (idx === -1) {
      this.db.chatThreads.push(thread);
      this.commit();
      return;
    }
    this.db.chatThreads[idx] = thread;
    this.commit();
  }

  appendSwarmMessage(message: SwarmChatMessage): void {
    this.db.swarmMessages.push(message);
    this.commit();
  }

  listSwarmMessages(threadId: string): SwarmChatMessage[] {
    return this.db.swarmMessages.filter((message) => message.threadId === threadId);
  }

  upsertDelegationPlan(messageId: string, steps: DelegationPlanStep[]): void {
    const idx = this.db.delegationPlans.findIndex((item) => item.messageId === messageId);
    if (idx === -1) {
      this.db.delegationPlans.push({ messageId, steps });
      this.commit();
      return;
    }
    this.db.delegationPlans[idx] = { messageId, steps };
    this.commit();
  }

  upsertSkillSuggestion(messageId: string, suggestion: SkillSuggestionPayload): void {
    const idx = this.db.skillSuggestions.findIndex((item) => item.messageId === messageId);
    if (idx === -1) {
      this.db.skillSuggestions.push({ messageId, suggestion });
      this.commit();
      return;
    }
    this.db.skillSuggestions[idx] = { messageId, suggestion };
    this.commit();
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
    this.commit();
  }

  listTaskTimeline(taskId: string): TaskEvent[] {
    return this.db.taskEvents.filter((event) => event.taskId === taskId);
  }

  addUsageReport(report: UsageReport): void {
    this.db.usageReports.push(report);
    this.commit();
  }

  listUsageReports(limit = 1000): UsageReport[] {
    if (limit <= 0) {
      return [];
    }
    return this.db.usageReports.slice(-limit);
  }

  getBudget(agentId: string): AgentBudget {
    const existing = this.db.budgets.find((item) => item.agentId === agentId);
    if (existing) {
      return existing;
    }
    const baseline: AgentBudget = {
      agentId,
      tokenLimit: agentId === "global" ? 500000 : 100000,
      costLimitUsd: agentId === "global" ? 250 : 40,
      currentTokens: 0,
      currentCostUsd: 0,
      hardKill: false,
      updatedAt: new Date().toISOString()
    };
    this.db.budgets.push(baseline);
    this.commit();
    return baseline;
  }

  setBudget(input: Omit<AgentBudget, "currentTokens" | "currentCostUsd" | "updatedAt">): AgentBudget {
    const current = this.getBudget(input.agentId);
    const next: AgentBudget = {
      ...current,
      tokenLimit: input.tokenLimit,
      costLimitUsd: input.costLimitUsd,
      hardKill: input.hardKill,
      updatedAt: new Date().toISOString()
    };
    const idx = this.db.budgets.findIndex((item) => item.agentId === input.agentId);
    this.db.budgets[idx] = next;
    this.commit();
    return next;
  }

  applyUsageToBudget(agentId: string, promptTokens: number, completionTokens: number, costUsd: number): AgentBudget {
    const current = this.getBudget(agentId);
    const next: AgentBudget = {
      ...current,
      currentTokens: current.currentTokens + promptTokens + completionTokens,
      currentCostUsd: Number((current.currentCostUsd + costUsd).toFixed(6)),
      updatedAt: new Date().toISOString()
    };
    const idx = this.db.budgets.findIndex((item) => item.agentId === agentId);
    this.db.budgets[idx] = next;
    this.commit();
    return next;
  }

  listBudgets(): AgentBudget[] {
    return this.db.budgets;
  }

  addCheckpoint(input: CheckpointRecord): void {
    this.db.checkpoints.push(input);
    this.commit();
  }

  listCheckpoints(swarmId: string, limit = 50): CheckpointRecord[] {
    return this.db.checkpoints.filter((item) => item.swarmId === swarmId).slice(-limit).reverse();
  }

  upsertVaultEntry(entry: VaultEntry): void {
    const idx = this.db.vaultEntries.findIndex((item) => item.id === entry.id);
    if (idx === -1) {
      this.db.vaultEntries.push(entry);
      this.commit();
      return;
    }
    this.db.vaultEntries[idx] = entry;
    this.commit();
  }

  listVaultEntries(limit = 200): VaultEntry[] {
    return [...this.db.vaultEntries]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  getVaultEntry(entryId: string): VaultEntry | null {
    return this.db.vaultEntries.find((item) => item.id === entryId) ?? null;
  }

  searchVaultEntries(query: string, limit = 80): VaultEntry[] {
    const lowered = query.trim().toLowerCase();
    if (!lowered) {
      return this.listVaultEntries(limit);
    }
    return this.listVaultEntries(1000)
      .filter((entry) => {
        return (
          entry.title.toLowerCase().includes(lowered) ||
          entry.markdownSummary.toLowerCase().includes(lowered) ||
          entry.tags.some((tag) => tag.toLowerCase().includes(lowered))
        );
      })
      .slice(0, limit);
  }

  addVaultVersion(version: VaultVersion): void {
    this.db.vaultVersions.push(version);
    this.commit();
  }

  listVaultVersions(entryId: string): VaultVersion[] {
    return this.db.vaultVersions
      .filter((item) => item.entryId === entryId)
      .sort((a, b) => b.versionNum - a.versionNum);
  }

  updateVaultEntry(
    entryId: string,
    patch: {
      title?: string;
      markdownSummary?: string;
      importanceScore?: number;
      tags?: string[];
      blobPath?: string;
      encrypted?: boolean;
    }
  ): VaultEntry {
    const current = this.getVaultEntry(entryId);
    if (!current) {
      throw new Error(`vault entry not found: ${entryId}`);
    }
    const next: VaultEntry = {
      ...current,
      title: patch.title ?? current.title,
      markdownSummary: patch.markdownSummary ?? current.markdownSummary,
      importanceScore: patch.importanceScore ?? current.importanceScore,
      tags: patch.tags ?? current.tags,
      encrypted: patch.encrypted ?? current.encrypted
    };
    if (patch.blobPath !== undefined) {
      next.blobPath = patch.blobPath;
    }
    this.upsertVaultEntry(next);
    this.commit();
    return next;
  }

  addStorageStat(snapshot: VaultStorageStats): void {
    this.db.storageStats.push(snapshot);
    this.commit();
  }

  listStorageStats(limit = 200): VaultStorageStats[] {
    if (limit <= 0) {
      return [];
    }
    return this.db.storageStats.slice(-limit);
  }

  latestStorageStat(): VaultStorageStats | null {
    return this.db.storageStats.length > 0 ? this.db.storageStats[this.db.storageStats.length - 1] ?? null : null;
  }

  vaultSummary(capacityGb = 128): VaultSummary {
    const entries = this.db.vaultEntries;
    const archivedItems = entries.filter((item) => item.type === "archive").length;
    const fileItems = entries.filter((item) => item.type === "file").length;
    const knowledgeItems = entries.filter((item) => item.type === "kb").length;
    const usedGb = Number(((archivedItems * 0.006) + (fileItems * 0.02) + (knowledgeItems * 0.004)).toFixed(3));
    return {
      usedGb,
      capacityGb,
      archivedItems,
      fileItems,
      knowledgeItems
    };
  }

  pruneVault(maxImportance = 3): { removed: number } {
    const before = this.db.vaultEntries.length;
    this.db.vaultEntries = this.db.vaultEntries.filter((entry) => entry.importanceScore > maxImportance);
    this.commit();
    return { removed: before - this.db.vaultEntries.length };
  }

  upsertSkill(skill: ClawHubSkill): void {
    const idx = this.db.skills.findIndex((item) => item.slug === skill.slug);
    if (idx === -1) {
      this.db.skills.push(skill);
      this.commit();
      return;
    }
    this.db.skills[idx] = skill;
    this.commit();
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
      this.commit();
      return;
    }
    this.db.agentSkills[idx] = record;
    this.commit();
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
      this.commit();
      return;
    }
    const current = this.db.agentSkills[idx]!;
    this.db.agentSkills[idx] = {
      agentId: current.agentId,
      skillSlug: current.skillSlug,
      assignedAt: current.assignedAt,
      enabled
    };
    this.commit();
  }

  addPermission(grant: PermissionGrant): void {
    const idx = this.db.permissions.findIndex((item) => item.id === grant.id);
    if (idx === -1) {
      this.db.permissions.push(grant);
    } else {
      this.db.permissions[idx] = grant;
    }
    this.commit();
  }

  removePermission(grantId: string): void {
    this.db.permissions = this.db.permissions.filter((item) => item.id !== grantId);
    this.commit();
  }

  listPermissions(): PermissionGrant[] {
    return this.db.permissions;
  }

  addAuditLog(log: AuditLog): void {
    this.db.auditLogs.push(log);
    this.commit();
  }

  listAuditLogs(limit = 100): AuditLog[] {
    return this.db.auditLogs.slice(-limit).reverse();
  }
}

export function createSqliteBackedRepository(
  persistence = new SqliteRuntimePersistence(),
  initialState = createInMemoryStore()
): Repository {
  const loaded = persistence.loadOrInit(initialState);
  return new Repository(
    loaded,
    (snapshot) => persistence.save(snapshot),
    () => persistence.flush()
  );
}
