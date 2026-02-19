import { createInMemoryStore, createSqliteBackedRepository, Repository } from "@majorclaw/db";
import { CostTracker, ModelRouter, StubProviderAdapter } from "@majorclaw/router";
import type { GatewayEnvelope, OpenClawInstanceConfig } from "@majorclaw/shared-types";
import { UnifiedChatApi } from "./chatApi.js";
import { ChatLogService } from "./chatLogs.js";
import { ClawHubService } from "./clawhub.js";
import { OpenClawConnectionManager } from "./connectionManager.js";
import { loadInstanceRegistry } from "./configRegistry.js";
import { CsoOrchestrationEngine } from "./csoEngine.js";
import { EventBus } from "./eventBus.js";
import { PermissionService } from "./permissions.js";
import { SafetyWorkflow } from "./safetyWorkflow.js";
import { AgentManager } from "./agentManager.js";
import { IntegrationsService } from "./integrations.js";
import { ChatService } from "./chatService.js";
import { BudgetService } from "./budgetService.js";
import { GatewaySecretStore } from "./secretStore.js";
import { CheckpointService } from "./checkpointService.js";
import { McpService } from "./mcpService.js";
import { VaultService } from "./vaultService.js";
import { TelemetryService } from "./telemetry.js";
import { AnalyticsService } from "./analytics.js";
import type { GatewayEvent } from "./types.js";

export interface GatewayRuntime {
  events: EventBus<GatewayEvent>;
  connectionManager: OpenClawConnectionManager;
  orchestrator: CsoOrchestrationEngine;
  modelRouter: ModelRouter;
  permissions: PermissionService;
  safetyWorkflow: SafetyWorkflow;
  chatLogs: ChatLogService;
  chatApi: UnifiedChatApi;
  clawHub: ClawHubService;
  integrations: IntegrationsService;
  chatService: ChatService;
  budgets: BudgetService;
  checkpoints: CheckpointService;
  mcp: McpService;
  vault: VaultService;
  agentManager: AgentManager;
  telemetry: TelemetryService;
  analytics: AnalyticsService;
  repository: Repository;
  costTracker: CostTracker;
}

export function createGatewayRuntime(configs: OpenClawInstanceConfig[]): GatewayRuntime {
  const events = new EventBus<GatewayEvent>();
  const connectionManager = new OpenClawConnectionManager(events, configs);
  const orchestrator = new CsoOrchestrationEngine();
  const modelRouter = new ModelRouter();
  const permissions = new PermissionService();
  const chatLogs = new ChatLogService();
  const chatApi = new UnifiedChatApi(chatLogs);
  const repository = createSqliteBackedRepository(undefined, createInMemoryStore());
  if (repository.listAgents().length === 0) {
    repository.upsertAgent({
      id: "agent_cso",
      name: "CSO",
      role: "chief_orchestration",
      modelProfileId: "anthropic:claude-3-5-sonnet",
      modelProvider: "anthropic",
      modelName: "claude-3-5-sonnet",
      temperature: 0.4,
      maxTokens: 8192,
      status: "online",
      parentId: null,
      lastHeartbeat: new Date().toISOString()
    });
    repository.upsertAgent({
      id: "agent_research",
      name: "Web Researcher",
      role: "research",
      modelProfileId: "local:llama3.1:70b",
      modelProvider: "local",
      modelName: "llama3.1:70b",
      temperature: 0.7,
      maxTokens: 8192,
      status: "busy",
      parentId: "agent_cso",
      lastHeartbeat: new Date().toISOString()
    });
    repository.upsertAgent({
      id: "agent_data",
      name: "Data Analyst",
      role: "analysis",
      modelProfileId: "google:gemini-2.0-flash",
      modelProvider: "google",
      modelName: "gemini-2.0-flash",
      temperature: 0.3,
      maxTokens: 8192,
      status: "idle",
      parentId: "agent_cso",
      lastHeartbeat: new Date().toISOString()
    });
    repository.upsertAgent({
      id: "agent_review",
      name: "Review & Polish",
      role: "review",
      modelProfileId: "xai:grok-3",
      modelProvider: "xai",
      modelName: "grok-3",
      temperature: 0.2,
      maxTokens: 8192,
      status: "error",
      parentId: "agent_cso",
      lastHeartbeat: new Date().toISOString()
    });
    repository.upsertAgentStats({
      agentId: "agent_cso",
      tokensToday: 21742,
      tasksCompleted: 12,
      lastUpdated: new Date().toISOString()
    });
    repository.upsertAgentStats({
      agentId: "agent_research",
      tokensToday: 18409,
      tasksCompleted: 21,
      lastUpdated: new Date().toISOString()
    });
    repository.upsertAgentStats({
      agentId: "agent_data",
      tokensToday: 9362,
      tasksCompleted: 9,
      lastUpdated: new Date().toISOString()
    });
    repository.upsertAgentStats({
      agentId: "agent_review",
      tokensToday: 4851,
      tasksCompleted: 8,
      lastUpdated: new Date().toISOString()
    });
  }
  const safetyWorkflow = new SafetyWorkflow(permissions, repository);
  const clawHub = new ClawHubService(repository, safetyWorkflow, () => {
    events.emit({
      type: "skills.reload",
      timestamp: new Date().toISOString(),
      payload: { source: "clawhub" }
    });
  });
  const costTracker = new CostTracker();
  const secretStore = new GatewaySecretStore();
  const agentManager = new AgentManager(repository, events, secretStore);
  const integrations = new IntegrationsService(events);
  const budgets = new BudgetService(repository, events);
  const checkpoints = new CheckpointService(repository, events);
  const vault = new VaultService(repository, events);
  const chatService = new ChatService(repository, orchestrator, budgets, checkpoints, vault);
  const mcp = new McpService(repository, events);
  const telemetry = new TelemetryService(repository);
  const analytics = new AnalyticsService(repository);
  if (repository.listVaultEntries(1).length === 0) {
    vault.deposit({
      type: "archive",
      title: "Q1 Pricing Research Completed",
      markdownSummary: "CSO archived the final pricing matrix and recommendation memo.",
      importanceScore: 8,
      tags: ["pricing", "q1", "strategy"],
      agentId: "agent_research",
      taskId: "task_2"
    });
    vault.deposit({
      type: "file",
      title: "Competitor Cost Breakdown CSV",
      markdownSummary: "Structured export for competitor benchmarks and model spend bands.",
      importanceScore: 6,
      tags: ["csv", "benchmark"],
      agentId: "agent_data",
      taskId: "task_1"
    });
    vault.deposit({
      type: "kb",
      title: "Runbook: Weekly Executive Brief",
      markdownSummary: "Procedure for generating Monday briefing with metrics + risk highlights.",
      importanceScore: 9,
      tags: ["runbook", "briefing"],
      agentId: "agent_cso"
    });
  }

  orchestrator.registerRule({ taskType: "default", defaultAgentId: "agent_research" });
  modelRouter.registerAdapter(new StubProviderAdapter("local"));
  modelRouter.registerAdapter(new StubProviderAdapter("anthropic"));
  modelRouter.registerAdapter(new StubProviderAdapter("google"));
  modelRouter.registerAdapter(new StubProviderAdapter("xai"));

  modelRouter.setBinding({
    agentId: "agent_cso",
    primary: "claude-3.5-sonnet",
    fallbackChain: ["grok-3"],
    provider: "anthropic"
  });
  modelRouter.setBinding({
    agentId: "agent_research",
    primary: "llama3.1:70b",
    fallbackChain: ["gemini-2.0-flash"],
    provider: "local"
  });
  modelRouter.setBinding({
    agentId: "agent_data",
    primary: "gemini-2.0-flash",
    fallbackChain: ["llama3.1:8b"],
    provider: "google"
  });
  modelRouter.setBinding({
    agentId: "agent_review",
    primary: "grok-3",
    fallbackChain: ["claude-3.5-sonnet"],
    provider: "xai"
  });

  permissions.setCapabilities("agent_cso", { can_read: true, can_write: true, can_exec: true, scopes: ["*"] });
  permissions.setCapabilities("agent_research", { can_read: true, can_write: false, can_exec: false, scopes: ["web.read"] });
  permissions.setCapabilities("agent_data", { can_read: true, can_write: false, can_exec: false, scopes: ["dataset.read"] });
  permissions.setCapabilities("agent_review", { can_read: true, can_write: false, can_exec: false, scopes: ["docs.read"] });
  permissions.restorePending(repository.listPermissions().filter((grant) => !grant.granted));

  return {
    events,
    connectionManager,
    orchestrator,
    modelRouter,
    permissions,
    safetyWorkflow,
    chatLogs,
    chatApi,
    clawHub,
    integrations,
    chatService,
    budgets,
    checkpoints,
    mcp,
    vault,
    agentManager,
    telemetry,
    analytics,
    repository,
    costTracker
  };
}

export function runGatewayDemo(runtime: GatewayRuntime): void {
  runtime.events.on("usage.report", (event: GatewayEnvelope) => {
    const payload = event.payload as {
      agentId: string;
      model: string;
      promptTokens: number;
      completionTokens: number;
      costUsd: number;
    };
    runtime.costTracker.append({
      ...payload,
      timestamp: event.timestamp
    });
  });

  runtime.connectionManager.connectAll();
}

export function bootGatewayFromRegistry(configPath?: string): GatewayRuntime {
  const configs = loadInstanceRegistry(configPath);
  const runtime = createGatewayRuntime(configs);
  runGatewayDemo(runtime);
  return runtime;
}
