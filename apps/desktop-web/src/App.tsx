import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentProfile, TaskRecord } from "@majorclaw/shared-types";
import { CenterPanel, type CenterTab } from "./components/CenterPanel.js";
import { HierarchyPanel } from "./components/HierarchyPanel.js";
import { NewAgentModal } from "./components/NewAgentModal.js";
import { PermissionApprovalModal } from "./components/PermissionApprovalModal.js";
import { RightPanel } from "./components/RightPanel.js";
import { TopBar } from "./components/TopBar.js";
import { useTelemetryStream } from "./hooks/useTelemetryStream.js";
import { emitAppError } from "./utils/errorBus.js";
import { normalizeError } from "./utils/errorMapper.js";
import {
  auditLogs,
  connectIntegration,
  createAgent,
  createTask,
  getAgentLogs,
  clawhubGetSkillDetails,
  clawhubInstall,
  getAgentConfig,
  getIntegrations,
  getIntegrationStatus,
  getConnectedModelProviders,
  mcpListServers,
  mcpRegisterServer,
  mcpConnectServer,
  mcpDisconnectServer,
  mcpListTools,
  mcpInvokeTool,
  getInstalledSkills,
  type IntegrationEntry,
  type ConnectedModelProvider,
  type McpServerEntry,
  type McpToolEntry,
  listAgents,
  listTasks,
  permissionsApprove,
  permissionsDeny,
  permissionsPending,
  reorderAgents,
  permissionsRequest,
  runAgentQuickAction,
  testAgentConnection,
  type AuditLogEntry,
  type AgentConnectionTestResult,
  type AgentQuickAction,
  type AgentFullConfig,
  type ClawHubSkill,
  type ClawHubSort,
  type PermissionGrant,
  getLiveSkills,
  getGatewayHealth,
  getGatewayStatus,
  getGatewayDaemonStatus,
  setGatewayDaemonEnabled,
  startGatewayDaemon,
  stopGatewayDaemon,
  restartGatewayDaemon,
  redPhoneShutdown,
  getBudgets,
  chatCheckpoints,
  chatRewind,
  startGateway,
  stopGateway,
  updateBudget,
  updateAgentConfig,
  updateTask,
  deleteTask,
  toggleSkill,
  type AgentBudget,
  type CheckpointRecord,
  vaultSummary,
  vaultRecent,
  vaultSearch,
  vaultCapacity,
  vaultDeposit,
  vaultPrune,
  vaultListVersions,
  vaultUpdateEntry,
  vaultCreateVersion,
  vaultStorageInfo,
  vaultRelocateStorage,
  type VaultEntry,
  type VaultSummary,
  type VaultStorageStats,
  type VaultVersion,
  type VaultStorageInfo,
  type GatewayDaemonStatus,
  getHealthSnapshot,
  getHealthEvents,
  exportHealthTelemetry,
  type HealthSnapshot,
  type HealthTelemetryEvent,
  getAnalyticsSnapshot,
  exportAnalyticsReport,
  type AnalyticsSnapshot as AnalyticsSnapshotData
} from "./tauriGateway.js";
import "./styles.css";

const seedTasks: TaskRecord[] = [
  { id: "task_1", title: "Benchmark routing cost", status: "inbox", priority: "high", assigneeAgentId: null, parentTaskId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "task_2", title: "Draft provider fallback policy", status: "assigned", priority: "normal", assigneeAgentId: "agent_research", parentTaskId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "task_3", title: "Validate output quality", status: "review", priority: "normal", assigneeAgentId: "agent_review", parentTaskId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
];

function filterMarketplaceSkills(skills: ClawHubSkill[], query: string): ClawHubSkill[] {
  const lowered = query.trim().toLowerCase();
  if (!lowered) {
    return skills;
  }
  return skills.filter(
    (skill) =>
      skill.name.toLowerCase().includes(lowered) ||
      skill.slug.toLowerCase().includes(lowered) ||
      skill.description.toLowerCase().includes(lowered)
  );
}

function mergeBySlug(previous: ClawHubSkill[], incoming: ClawHubSkill[]): ClawHubSkill[] {
  const map = new Map(previous.map((skill) => [skill.slug, skill]));
  for (const skill of incoming) {
    map.set(skill.slug, skill);
  }
  return [...map.values()];
}

function integrationSkills(items: IntegrationEntry[]): ClawHubSkill[] {
  return items
    .filter((item) => item.status === "connected")
    .filter((item) => item.category !== "AI Models")
    .map((item) => ({
      slug: `integration-${item.slug}`,
      name: `${item.name} Integration`,
      author: "openclaw",
      description: item.description,
      downloads: 0,
      version: "connected",
      categories: [item.category],
      permissions: item.permissions,
      installed: true
    }));
}

export default function App() {
  const seedDataEnabled = import.meta.env.VITE_SEED_DATA === "true";
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("agent_cso");
  const [selectedAgentConfig, setSelectedAgentConfig] = useState<AgentFullConfig | null>(null);
  const [newAgentModalOpen, setNewAgentModalOpen] = useState(false);
  const [newAgentBusy, setNewAgentBusy] = useState(false);
  const [tab, setTab] = useState<CenterTab>("kanban");
  const [tasks, setTasks] = useState<TaskRecord[]>(() => (seedDataEnabled ? seedTasks : []));
  const [taskDeleteUndoCount, setTaskDeleteUndoCount] = useState(0);
  const activeTaskDeleteBatchRef = useRef<{ id: string; tasks: TaskRecord[]; timer: number } | null>(null);
  const pendingDeletedTaskIdsRef = useRef<Set<string>>(new Set());
  const [draftMessage, setDraftMessage] = useState("");
  const [logFilter, setLogFilter] = useState("all");
  const [pendingApprovals, setPendingApprovals] = useState<PermissionGrant[]>([]);
  const [auditTimeline, setAuditTimeline] = useState<AuditLogEntry[]>([]);
  const [marketplaceQuery, setMarketplaceQuery] = useState("");
  const [marketplaceSort, setMarketplaceSort] = useState<ClawHubSort>("downloads");
  const [marketplaceNonSuspicious, setMarketplaceNonSuspicious] = useState(true);
  const [marketplaceSource, setMarketplaceSource] = useState<"live" | "cache">("live");
  const [marketplaceNextCursor, setMarketplaceNextCursor] = useState<string | null>(null);
  const [marketplaceRawSkills, setMarketplaceRawSkills] = useState<ClawHubSkill[]>([]);
  const [marketplaceSkills, setMarketplaceSkills] = useState<ClawHubSkill[]>([]);
  const [selectedMarketplaceSkill, setSelectedMarketplaceSkill] = useState<ClawHubSkill | null>(null);
  const [installIntent, setInstallIntent] = useState<{ slug: string; targetAgentId: string; skillName: string } | null>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalModalGrants, setApprovalModalGrants] = useState<PermissionGrant[]>([]);
  const [approvalModalBusy, setApprovalModalBusy] = useState(false);
  const [installedSkills, setInstalledSkills] = useState<ClawHubSkill[]>([]);
  const [marketplaceBusy, setMarketplaceBusy] = useState(false);
  const [integrationsQuery, setIntegrationsQuery] = useState("");
  const [integrationsCategory, setIntegrationsCategory] = useState("All Categories");
  const [integrations, setIntegrations] = useState<IntegrationEntry[]>([]);
  const [integrationCategories, setIntegrationCategories] = useState<{ name: string; connectedCount: number; totalCount: number }[]>([
    { name: "All Categories", connectedCount: 0, totalCount: 0 }
  ]);
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationEntry | null>(null);
  const [selectedIntegrationTargetAgentId, setSelectedIntegrationTargetAgentId] = useState("agent_cso");
  const [connectedModelProviders, setConnectedModelProviders] = useState<ConnectedModelProvider[]>([]);
  const [integrationBusy, setIntegrationBusy] = useState(false);
  const [integrationApprovalOpen, setIntegrationApprovalOpen] = useState(false);
  const [integrationApprovalGrants, setIntegrationApprovalGrants] = useState<PermissionGrant[]>([]);
  const [integrationIntent, setIntegrationIntent] = useState<{ slug: string; targetAgentId: string; name: string; config?: Record<string, string> } | null>(null);
  const [mcpServers, setMcpServers] = useState<McpServerEntry[]>([]);
  const [mcpTools, setMcpTools] = useState<McpToolEntry[]>([]);
  const [selectedMcpServerId, setSelectedMcpServerId] = useState<string | null>(null);
  const [mcpApprovalOpen, setMcpApprovalOpen] = useState(false);
  const [mcpApprovalGrants, setMcpApprovalGrants] = useState<PermissionGrant[]>([]);
  const [mcpApprovalBusy, setMcpApprovalBusy] = useState(false);
  const [mcpIntent, setMcpIntent] = useState<
    | { kind: "connect"; serverId: string; targetAgentId: string; scopes: string[]; label: string }
    | { kind: "invoke"; serverId: string; toolId: string; targetAgentId: string; scopes: string[]; label: string }
    | null
  >(null);
  const [gatewayRunning, setGatewayRunning] = useState(false);
  const [gatewayPort, setGatewayPort] = useState<number | null>(null);
  const [gatewayHealth, setGatewayHealth] = useState("excellent");
  const [gatewayInstances, setGatewayInstances] = useState<number | null>(null);
  const [gatewayDaemonStatus, setGatewayDaemonStatus] = useState<GatewayDaemonStatus | null>(null);
  const [gatewayDaemonBusy, setGatewayDaemonBusy] = useState(false);
  const [healthSnapshot, setHealthSnapshot] = useState<HealthSnapshot | null>(null);
  const [healthEvents, setHealthEvents] = useState<HealthTelemetryEvent[]>([]);
  const [healthCategoryFilter, setHealthCategoryFilter] = useState<
    "all" | "lifecycle" | "gateway" | "agent" | "vault" | "error" | "system"
  >("all");
  const [analyticsRange, setAnalyticsRange] = useState<"7d" | "30d" | "90d">("30d");
  const [analyticsSnapshot, setAnalyticsSnapshot] = useState<AnalyticsSnapshotData | null>(null);
  const [hierarchyActionMessage, setHierarchyActionMessage] = useState<string | null>(null);
  const [budgetSnapshot, setBudgetSnapshot] = useState<{ global: AgentBudget; agents: AgentBudget[] } | null>(null);
  const [checkpoints, setCheckpoints] = useState<CheckpointRecord[]>([]);
  const [vaultSummaryCard, setVaultSummaryCard] = useState<VaultSummary | null>(null);
  const [vaultCapacityStats, setVaultCapacityStats] = useState<VaultStorageStats | null>(null);
  const [vaultRecentItems, setVaultRecentItems] = useState<VaultEntry[]>([]);
  const [vaultSearchResults, setVaultSearchResults] = useState<VaultEntry[]>([]);
  const [vaultSearchQuery, setVaultSearchQuery] = useState("");
  const [vaultBrowserOpen, setVaultBrowserOpen] = useState(false);
  const [vaultDepositApprovalOpen, setVaultDepositApprovalOpen] = useState(false);
  const [vaultDepositGrants, setVaultDepositGrants] = useState<PermissionGrant[]>([]);
  const [vaultDepositBusy, setVaultDepositBusy] = useState(false);
  const [vaultDepositIntent, setVaultDepositIntent] = useState<{
    type: "archive" | "file" | "kb";
    title: string;
    markdownSummary: string;
    importanceScore: number;
    tags: string[];
  } | null>(null);
  const [vaultVersionsByEntry, setVaultVersionsByEntry] = useState<Record<string, VaultVersion[]>>({});
  const [vaultStorage, setVaultStorage] = useState<VaultStorageInfo | null>(null);
  const [redPhoneOpen, setRedPhoneOpen] = useState(false);
  const [redPhoneReason, setRedPhoneReason] = useState("");
  const [redPhoneBusy, setRedPhoneBusy] = useState(false);
  const [redPhoneResult, setRedPhoneResult] = useState<string | null>(null);
  const telemetryStream = useTelemetryStream(tab === "health");

  const selectedAgent = useMemo(() => agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null, [agents, selectedAgentId]);
  const reportActionError = (context: string, error: unknown, retry?: () => void) => {
    const detail: { context: string; error: ReturnType<typeof normalizeError>; retry?: () => void } = {
      context,
      error: normalizeError(error, context)
    };
    if (retry) {
      detail.retry = retry;
    }
    emitAppError(detail);
  };
  const safeAction = async <T,>(
    context: string,
    action: () => Promise<T>,
    retry?: () => void
  ): Promise<T | null> => {
    try {
      return await action();
    } catch (error) {
      reportActionError(context, error, retry);
      return null;
    }
  };

  useEffect(() => {
    const refreshGatewayState = async () => {
      const status = await safeAction("Refresh gateway state", () => getGatewayStatus());
      if (status) {
        setGatewayRunning(status.running);
        setGatewayPort(status.port);
      }
      const health = await safeAction("Refresh gateway health", () => getGatewayHealth());
      if (health) {
        setGatewayHealth(health.status || "excellent");
        setGatewayInstances(health.instanceCount ?? null);
      }
      const daemon = await safeAction("Refresh daemon status", () => getGatewayDaemonStatus());
      setGatewayDaemonStatus(daemon);
      const liveAgents = (await safeAction("Load agents", () => listAgents())) ?? [];
      if (liveAgents.length > 0) {
        setAgents(liveAgents);
        setSelectedAgentId((current) => (liveAgents.some((item) => item.id === current) ? current : liveAgents[0]!.id));
      }
      const initialAgentId = liveAgents[0]?.id ?? selectedAgentId;
      const runtimeTasks = (await safeAction("Load tasks", () => listTasks())) ?? [];
      const filteredRuntimeTasks = runtimeTasks.filter((task) => !pendingDeletedTaskIdsRef.current.has(task.id));
      setTasks(filteredRuntimeTasks.length > 0 ? filteredRuntimeTasks : seedDataEnabled ? seedTasks : []);
      const installed = (await safeAction("Load installed skills", () => getInstalledSkills(initialAgentId))) ?? [];
      setInstalledSkills(installed);
      const pending = (await safeAction("Load pending approvals", () => permissionsPending(initialAgentId))) ?? [];
      setPendingApprovals(pending);
      const logs = (await safeAction("Load audit timeline", () => auditLogs(120))) ?? [];
      setAuditTimeline(logs);
      const config = await safeAction("Load agent config", () => getAgentConfig(initialAgentId));
      setSelectedAgentConfig(config);
      const budgets = await safeAction("Load budgets", () => getBudgets());
      setBudgetSnapshot(budgets);
      const checkpointsSnapshot = (await safeAction("Load checkpoints", () => chatCheckpoints("swarm_main", 80))) ?? [];
      setCheckpoints(checkpointsSnapshot);
      const integrationsResult = await safeAction("Load integrations", () => getIntegrations("", "All Categories"));
      if (!integrationsResult) {
        return;
      }
      setIntegrations(integrationsResult.items);
      setIntegrationCategories(integrationsResult.categories);
      setSelectedIntegration(integrationsResult.items[0] ?? null);
      const providers = (await safeAction("Load model providers", () => getConnectedModelProviders())) ?? [];
      setConnectedModelProviders(providers);
      const servers = (await safeAction("Load MCP servers", () => mcpListServers(""))) ?? [];
      setMcpServers(servers);
      const firstServer = servers[0] ?? null;
      setSelectedMcpServerId(firstServer?.id ?? null);
      if (firstServer) {
        const tools = (await safeAction("Load MCP tools", () => mcpListTools(firstServer.id))) ?? [];
        setMcpTools(tools);
      } else {
        setMcpTools([]);
      }
      const [summary, capacity, recent] = await Promise.all([
        safeAction("Load vault summary", () => vaultSummary()),
        safeAction("Load vault capacity", () => vaultCapacity()),
        safeAction("Load vault activity", () => vaultRecent(30))
      ]);
      setVaultSummaryCard(summary);
      setVaultCapacityStats(capacity);
      setVaultRecentItems(recent ?? []);
      setVaultSearchResults((recent ?? []).slice(0, 8));
      const storage = await safeAction("Load vault storage info", () => vaultStorageInfo());
      setVaultStorage(storage);
      const [healthSnapshotData, events] = await Promise.all([
        safeAction("Load health snapshot", () => getHealthSnapshot()),
        safeAction("Load health events", () => getHealthEvents(120))
      ]);
      setHealthSnapshot(healthSnapshotData);
      setHealthEvents(events ?? []);
      const analytics = await safeAction("Load analytics snapshot", () => getAnalyticsSnapshot("30d"));
      setAnalyticsSnapshot(analytics);
    };
    void refreshGatewayState();
  }, []);

  useEffect(() => {
    const merged = mergeBySlug(marketplaceRawSkills, integrationSkills(integrations));
    const filtered = filterMarketplaceSkills(merged, marketplaceQuery);
    setMarketplaceSkills(filtered);
    setSelectedMarketplaceSkill((current) => {
      if (current && filtered.some((skill) => skill.slug === current.slug)) {
        return current;
      }
      return filtered[0] ?? null;
    });
  }, [marketplaceRawSkills, marketplaceQuery, integrations]);

  useEffect(() => {
    const refreshIntegrations = async () => {
      const [result, providers] = await Promise.all([
        safeAction("Refresh integrations", () => getIntegrations(integrationsQuery, integrationsCategory)),
        safeAction("Refresh model providers", () => getConnectedModelProviders())
      ]);
      if (!result) {
        return;
      }
      setIntegrations(result.items);
      setIntegrationCategories(result.categories);
      setConnectedModelProviders(providers ?? []);
      setSelectedIntegration((current) => {
        if (current) {
          return result.items.find((item) => item.slug === current.slug) ?? result.items[0] ?? null;
        }
        return result.items[0] ?? null;
      });
    };
    void refreshIntegrations();
  }, [integrationsQuery, integrationsCategory]);

  useEffect(() => {
    const refreshInstalledForAgent = async () => {
      const installed = (await safeAction("Reload installed skills", () => getInstalledSkills(selectedAgentId))) ?? [];
      setInstalledSkills(installed);
      const pending = (await safeAction("Reload pending approvals", () => permissionsPending(selectedAgentId))) ?? [];
      setPendingApprovals(pending);
      const logs = (await safeAction("Reload audit timeline", () => auditLogs(120))) ?? [];
      setAuditTimeline(logs);
      const config = await safeAction("Reload selected agent config", () => getAgentConfig(selectedAgentId));
      setSelectedAgentConfig(config ?? null);
      const budgets = await safeAction("Reload budgets", () => getBudgets());
      setBudgetSnapshot(budgets ?? null);
    };
    void refreshInstalledForAgent();
  }, [selectedAgentId]);

  useEffect(() => {
    const timer = setInterval(() => {
      void (async () => {
        const snapshot = await safeAction("Refresh checkpoints", () => chatCheckpoints("swarm_main", 80));
        setCheckpoints(snapshot ?? []);
        const liveTasks = await safeAction("Refresh tasks", () => listTasks());
        if (liveTasks) {
          const filteredLiveTasks = liveTasks.filter((task) => !pendingDeletedTaskIdsRef.current.has(task.id));
          setTasks(filteredLiveTasks.length > 0 ? filteredLiveTasks : seedDataEnabled ? seedTasks : []);
        }
      })();
    }, 4000);
    return () => clearInterval(timer);
  }, [seedDataEnabled]);

  useEffect(() => {
    setSelectedIntegrationTargetAgentId(selectedAgentId);
  }, [selectedAgentId]);

  useEffect(() => {
    if (tab !== "integrations") {
      return;
    }
    const timer = setInterval(() => {
      void (async () => {
        const [result, providers] = await Promise.all([
          safeAction("Poll integrations", () => getIntegrations(integrationsQuery, integrationsCategory)),
          safeAction("Poll model providers", () => getConnectedModelProviders())
        ]);
        if (!result) {
          return;
        }
        const statuses = await Promise.all(result.items.map((item) => getIntegrationStatus(item.slug)));
        const knownStatuses = statuses.filter(
          (status): status is { slug: string; status: IntegrationEntry["status"] } => status !== null
        );
        const statusMap = new Map(knownStatuses.map((status) => [status.slug, status.status]));
        const items = result.items.map((item) => ({
          ...item,
          status: statusMap.get(item.slug) ?? item.status
        }));
        setIntegrations(items);
        setIntegrationCategories(result.categories);
        setConnectedModelProviders(providers ?? []);
        const servers = (await safeAction("Poll MCP servers", () => mcpListServers(""))) ?? [];
        setMcpServers(servers);
        setSelectedIntegration((current) => {
          if (!current) {
            return items[0] ?? null;
          }
          return items.find((item) => item.slug === current.slug) ?? current;
        });
      })();
    }, 4000);
    return () => clearInterval(timer);
  }, [tab, integrationsQuery, integrationsCategory]);

  useEffect(() => {
    void fetchMarketplacePage("reset");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketplaceSort, marketplaceNonSuspicious]);

  useEffect(() => {
    if (!hierarchyActionMessage) {
      return;
    }
    const timer = setTimeout(() => setHierarchyActionMessage(null), 2200);
    return () => clearTimeout(timer);
  }, [hierarchyActionMessage]);

  useEffect(() => {
    const timer = setInterval(() => {
      void (async () => {
        const [summary, capacity, recent, storage] = await Promise.all([
          safeAction("Poll vault summary", () => vaultSummary()),
          safeAction("Poll vault capacity", () => vaultCapacity()),
          safeAction("Poll vault activity", () => vaultRecent(30)),
          safeAction("Poll vault storage", () => vaultStorageInfo())
        ]);
        setVaultSummaryCard(summary);
        setVaultCapacityStats(capacity);
        setVaultRecentItems(recent ?? []);
        setVaultStorage(storage);
      })();
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleStartGateway = async () => {
    const status = await startGateway();
    if (!status) {
      reportActionError("Start gateway", new Error("gateway did not return a start response"), () => {
        void handleStartGateway();
      });
      return;
    }
    setGatewayRunning(status.running);
    setGatewayPort(status.port);
    const daemon = await safeAction("Refresh daemon status", () => getGatewayDaemonStatus());
    setGatewayDaemonStatus(daemon ?? null);
  };

  const handleStopGateway = async () => {
    const status = await stopGateway();
    if (!status) {
      reportActionError("Stop gateway", new Error("gateway did not return a stop response"), () => {
        void handleStopGateway();
      });
      return;
    }
    setGatewayRunning(status.running);
    setGatewayPort(status.port);
    const daemon = await safeAction("Refresh daemon status", () => getGatewayDaemonStatus());
    setGatewayDaemonStatus(daemon ?? null);
  };

  const handleToggleAlwaysOnDaemon = async (enabled: boolean) => {
    setGatewayDaemonBusy(true);
    const result = await safeAction("Update always-on daemon", () => setGatewayDaemonEnabled(enabled), () => {
      void handleToggleAlwaysOnDaemon(enabled);
    });
    setGatewayDaemonStatus(result ?? null);
    setGatewayDaemonBusy(false);
  };

  const handleDaemonStart = async () => {
    setGatewayDaemonBusy(true);
    const result = await safeAction("Start always-on daemon", () => startGatewayDaemon(), () => {
      void handleDaemonStart();
    });
    if (result) {
      setGatewayDaemonStatus(result);
      setHierarchyActionMessage("Always-on daemon start requested");
    }
    setGatewayDaemonBusy(false);
  };

  const handleDaemonStop = async () => {
    setGatewayDaemonBusy(true);
    const result = await safeAction("Stop always-on daemon", () => stopGatewayDaemon(), () => {
      void handleDaemonStop();
    });
    if (result) {
      setGatewayDaemonStatus(result);
      setHierarchyActionMessage("Always-on daemon stop requested");
    }
    setGatewayDaemonBusy(false);
  };

  const handleDaemonRestart = async () => {
    setGatewayDaemonBusy(true);
    const result = await safeAction("Restart always-on daemon", () => restartGatewayDaemon(), () => {
      void handleDaemonRestart();
    });
    if (result) {
      setGatewayDaemonStatus(result);
      setHierarchyActionMessage("Always-on daemon restart requested");
    }
    setGatewayDaemonBusy(false);
  };

  const handleDaemonLogs = async () => {
    const status = await safeAction("Load daemon log hint", () => getGatewayDaemonStatus(), () => {
      void handleDaemonLogs();
    });
    if (!status) {
      return;
    }
    setGatewayDaemonStatus(status);
    setHierarchyActionMessage(status.logHint ? `Daemon logs: ${status.logHint}` : "Daemon log hint unavailable");
  };

  const handleRedPhoneConfirm = async () => {
    const reason = redPhoneReason.trim();
    if (!reason) {
      return;
    }
    setRedPhoneBusy(true);
    const result = await redPhoneShutdown(reason);
    if (result) {
      setGatewayRunning(false);
      setGatewayHealth("shutdown");
      setRedPhoneResult(`Emergency stop executed: ${result.reason}`);
      if (result.auditLog) {
        setAuditTimeline((current) => [result.auditLog!, ...current].slice(0, 120));
      } else {
        const logs = await auditLogs(120);
        setAuditTimeline(logs);
      }
    } else {
      reportActionError("Red Phone", new Error("red phone shutdown returned empty result"), () => {
        void handleRedPhoneConfirm();
      });
      setRedPhoneResult("Emergency stop failed");
    }
    setRedPhoneBusy(false);
    setRedPhoneOpen(false);
    setRedPhoneReason("");
  };

  const handleSelectMarketplaceSkill = async (skill: ClawHubSkill) => {
    setSelectedMarketplaceSkill(skill);
    const details = await clawhubGetSkillDetails(skill.slug);
    if (!details) {
      reportActionError("Load skill details", new Error(`failed to load skill details for ${skill.slug}`), () => {
        void handleSelectMarketplaceSkill(skill);
      });
      return;
    }
    setSelectedMarketplaceSkill(details);
  };

  const handleJumpToAgentFromChat = (agentId: string) => {
    setSelectedAgentId(agentId);
  };

  const handleInstallSuggestedSkillFromChat = async (slug: string, targetAgentId: string) => {
    await handleInstallSkill(slug, targetAgentId);
  };

  const handleOpenMarketplaceForSkillFromChat = (slug: string) => {
    setTab("marketplace");
    setMarketplaceQuery(slug);
  };

  const handleInstallSkill = async (slug: string, targetAgent?: string) => {
    const target = targetAgent ?? selectedAgentId;
    const skill = marketplaceSkills.find((item) => item.slug === slug) ?? selectedMarketplaceSkill;
    if (!skill) {
      return;
    }
    setMarketplaceBusy(true);
    const grants = await safeAction("Request install permissions", () =>
      permissionsRequest(target, skill.permissions, { skillSlug: slug, action: "install_preview" })
    );
    if (!grants) {
      setMarketplaceBusy(false);
      return;
    }
    setApprovalModalGrants(grants);
    setInstallIntent({ slug, targetAgentId: target, skillName: skill.name });
    setApprovalModalOpen(true);
    setMarketplaceBusy(false);
  };

  const handleToggleSkill = async (slug: string, enabled: boolean) => {
    const toggled = await safeAction("Toggle skill", () => toggleSkill(selectedAgentId, slug, enabled), () => {
      void handleToggleSkill(slug, enabled);
    });
    if (!toggled) {
      return;
    }
    const installed = (await safeAction("Reload installed skills", () => getInstalledSkills(selectedAgentId))) ?? [];
    setInstalledSkills(installed);
  };

  const handleCreateAgent = async (payload: Parameters<typeof createAgent>[0]) => {
    setNewAgentBusy(true);
    const created = await safeAction("Create agent", () => createAgent(payload), () => {
      void handleCreateAgent(payload);
    });
    const updated = (await safeAction("Reload agents", () => listAgents())) ?? [];
    if (updated.length > 0) {
      setAgents(updated);
    }
    if (created) {
      setSelectedAgentId(created.id);
    }
    setNewAgentBusy(false);
    if (created) {
      setNewAgentModalOpen(false);
    }
  };

  const handleReorderAgents = async (order: string[]) => {
    const reordered = await safeAction("Reorder agents", () => reorderAgents(order), () => {
      void handleReorderAgents(order);
    });
    if (!reordered) {
      return;
    }
    if (reordered.length > 0) {
      setAgents(reordered);
    }
  };

  const handleUpdateSelectedAgentConfig = async (patch: Parameters<typeof updateAgentConfig>[1]) => {
    const updatedConfig = await safeAction("Update agent config", () => updateAgentConfig(selectedAgentId, patch), () => {
      void handleUpdateSelectedAgentConfig(patch);
    });
    if (!updatedConfig) {
      return;
    }
    const [updatedAgents, config] = await Promise.all([
      safeAction("Reload agents", () => listAgents()),
      safeAction("Reload selected agent config", () => getAgentConfig(selectedAgentId))
    ]);
    if ((updatedAgents ?? []).length > 0) {
      setAgents(updatedAgents ?? []);
    }
    setSelectedAgentConfig(config ?? null);
  };

  const handleQuickAgentAction = async (agentId: string, action: AgentQuickAction) => {
    const result = await runAgentQuickAction(agentId, action);
    if (!result) {
      reportActionError("Agent quick action", new Error(`failed to run ${action} for ${agentId}`), () => {
        void handleQuickAgentAction(agentId, action);
      });
      return;
    }
    setHierarchyActionMessage(result.message);
    const updatedAgents = (await safeAction("Reload agents after action", () => listAgents())) ?? [];
    if (updatedAgents.length > 0) {
      setAgents(updatedAgents);
      if (!updatedAgents.some((agent) => agent.id === selectedAgentId)) {
        setSelectedAgentId(updatedAgents[0]!.id);
      }
    }
    if (action === "logs") {
      const logs = (await safeAction("Load agent logs", () => getAgentLogs(agentId, 50))) ?? [];
      setAuditTimeline(logs);
      return;
    }
    const config = await safeAction("Reload selected agent config", () => getAgentConfig(selectedAgentId));
    setSelectedAgentConfig(config);
  };

  const handleTestAgentConnection = async (apiKey?: string): Promise<AgentConnectionTestResult | null> => {
    const result = await testAgentConnection(selectedAgentId, apiKey);
    if (!result) {
      reportActionError("Test agent connection", new Error("connection test returned no result"), () => {
        void handleTestAgentConnection(apiKey);
      });
    }
    const [updatedAgents, config] = await Promise.all([
      safeAction("Reload agents after connection test", () => listAgents()),
      safeAction("Reload selected agent config", () => getAgentConfig(selectedAgentId))
    ]);
    if ((updatedAgents ?? []).length > 0) {
      setAgents(updatedAgents ?? []);
    }
    setSelectedAgentConfig(config ?? null);
    return result;
  };

  const handleUpdateAgentBudget = async (input: { tokenLimit: number; costLimitUsd: number; hardKill: boolean }) => {
    const changed = await safeAction("Update budget", () =>
      updateBudget(selectedAgentId, input.tokenLimit, input.costLimitUsd, input.hardKill)
    );
    if (!changed) {
      return;
    }
    const refreshed = await safeAction("Reload budgets", () => getBudgets());
    setBudgetSnapshot(refreshed ?? null);
  };

  const handleRewindCheckpoint = async (checkpointId: string, editPrompt?: string) => {
    const rewinded = await safeAction("Rewind checkpoint", () => chatRewind("thread_cso_default", checkpointId, editPrompt));
    if (!rewinded) {
      return;
    }
    const [snapshot, logs] = await Promise.all([
      safeAction("Reload checkpoints", () => chatCheckpoints("swarm_main", 80)),
      safeAction("Reload audit timeline", () => auditLogs(120))
    ]);
    setCheckpoints(snapshot ?? []);
    setAuditTimeline(logs ?? []);
    setTab("chat");
  };

  const handleSelectIntegration = (integration: IntegrationEntry) => {
    setSelectedIntegration(integration);
  };

  const refreshTasks = async () => {
    const liveTasks = await safeAction("Reload tasks", () => listTasks());
    if (liveTasks) {
      const filtered = liveTasks.filter((task) => !pendingDeletedTaskIdsRef.current.has(task.id));
      setTasks(filtered.length > 0 ? filtered : seedDataEnabled ? seedTasks : []);
    }
  };

  const mergeTasksById = (base: TaskRecord[], add: TaskRecord[]) => {
    const map = new Map(base.map((item) => [item.id, item] as const));
    for (const task of add) {
      map.set(task.id, task);
    }
    return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  };

  const finalizeTaskDeleteBatch = async (batchId: string) => {
    const active = activeTaskDeleteBatchRef.current;
    if (!active || active.id !== batchId) {
      return;
    }
    activeTaskDeleteBatchRef.current = null;
    setTaskDeleteUndoCount(0);
    const deleted = await safeAction("Delete tasks", async () => {
      for (const task of active.tasks) {
        await deleteTask(task.id);
      }
      return true;
    });
    if (!deleted) {
      for (const task of active.tasks) {
        pendingDeletedTaskIdsRef.current.delete(task.id);
      }
      setTasks((current) => mergeTasksById(current, active.tasks));
      return;
    }
    for (const task of active.tasks) {
      pendingDeletedTaskIdsRef.current.delete(task.id);
    }
    await refreshTasks();
  };

  const scheduleTaskDeleteBatch = async (deleteTasksBatch: TaskRecord[]) => {
    if (deleteTasksBatch.length === 0) {
      return;
    }
    const existing = activeTaskDeleteBatchRef.current;
    if (existing) {
      window.clearTimeout(existing.timer);
      await finalizeTaskDeleteBatch(existing.id);
    }
    const taskIds = new Set(deleteTasksBatch.map((item) => item.id));
    setTasks((current) => current.filter((task) => !taskIds.has(task.id)));
    for (const task of deleteTasksBatch) {
      pendingDeletedTaskIdsRef.current.add(task.id);
    }
    const batchId = `delete_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const timer = window.setTimeout(() => {
      void finalizeTaskDeleteBatch(batchId);
    }, 7000);
    activeTaskDeleteBatchRef.current = { id: batchId, tasks: deleteTasksBatch, timer };
    setTaskDeleteUndoCount(deleteTasksBatch.length);
  };

  const handleUndoTaskDelete = async () => {
    const active = activeTaskDeleteBatchRef.current;
    if (!active) {
      return;
    }
    window.clearTimeout(active.timer);
    activeTaskDeleteBatchRef.current = null;
    for (const task of active.tasks) {
      pendingDeletedTaskIdsRef.current.delete(task.id);
    }
    setTasks((current) => mergeTasksById(current, active.tasks));
    setTaskDeleteUndoCount(0);
  };

  useEffect(() => {
    return () => {
      const active = activeTaskDeleteBatchRef.current;
      if (active) {
        window.clearTimeout(active.timer);
      }
    };
  }, []);

  const handleCreateTask = async (input: { title: string; assigneeAgentId?: string | null; status?: TaskRecord["status"] }) => {
    const created = await safeAction("Create task", () =>
      createTask({
        title: input.title,
        assigneeAgentId: input.assigneeAgentId ?? null,
        status: input.status ?? "inbox",
        priority: "normal"
      })
    );
    if (!created) {
      return;
    }
    await refreshTasks();
  };

  const handleUpdateTaskStatus = async (taskId: string, status: TaskRecord["status"]) => {
    const updated = await safeAction("Update task status", () => updateTask(taskId, { status }));
    if (!updated) {
      return;
    }
    await refreshTasks();
  };

  const handleUpdateTaskAssignee = async (taskId: string, assigneeAgentId: string) => {
    const updated = await safeAction("Update task assignee", () => updateTask(taskId, { assigneeAgentId }));
    if (!updated) {
      return;
    }
    await refreshTasks();
  };

  const handleArchiveTask = async (taskId: string) => {
    const archived = await safeAction("Archive task", () => updateTask(taskId, { status: "done" }));
    if (!archived) {
      return;
    }
    await refreshTasks();
  };

  const handleBulkArchiveTasks = async (taskIds: string[]) => {
    if (taskIds.length === 0) {
      return;
    }
    const archived = await safeAction("Archive tasks", async () => {
      for (const taskId of taskIds) {
        await updateTask(taskId, { status: "done" });
      }
      return true;
    });
    if (!archived) {
      return;
    }
    await refreshTasks();
  };

  const handleDeleteTask = async (task: TaskRecord) => {
    await scheduleTaskDeleteBatch([task]);
  };

  const handleBulkDeleteTasks = async (taskIds: string[]) => {
    const batch = tasks.filter((task) => taskIds.includes(task.id));
    await scheduleTaskDeleteBatch(batch);
  };

  const handleConnectIntegration = async (slug: string, targetAgentId: string, config?: Record<string, string>) => {
    const integration = integrations.find((item) => item.slug === slug) ?? selectedIntegration;
    if (!integration) {
      return;
    }
    setIntegrationBusy(true);
    const grants = await safeAction("Request integration permissions", () =>
      permissionsRequest(targetAgentId, integration.permissions, {
        integrationSlug: slug,
        action: "integration_connect"
      })
    );
    if (!grants) {
      setIntegrationBusy(false);
      return;
    }
    setIntegrationApprovalGrants(grants);
    const intent: { slug: string; targetAgentId: string; name: string; config?: Record<string, string> } = {
      slug,
      targetAgentId,
      name: integration.name
    };
    if (config && Object.keys(config).length > 0) {
      intent.config = config;
    }
    setIntegrationIntent(intent);
    setIntegrationApprovalOpen(true);
    setIntegrationBusy(false);
  };

  useEffect(() => {
    if (!selectedMcpServerId) {
      setMcpTools([]);
      return;
    }
    void (async () => {
      const tools = (await safeAction("Load MCP tools", () => mcpListTools(selectedMcpServerId))) ?? [];
      setMcpTools(tools);
    })();
  }, [selectedMcpServerId]);

  const refreshMcpServers = async () => {
    const servers = (await safeAction("Refresh MCP servers", () => mcpListServers(""))) ?? [];
    setMcpServers(servers);
    setSelectedMcpServerId((current) => {
      if (current && servers.some((server) => server.id === current)) {
        return current;
      }
      return servers[0]?.id ?? null;
    });
  };

  const handleRegisterMcpServer = async (url: string, name?: string, capabilities?: string[]) => {
    const created = await safeAction("Register MCP server", () => mcpRegisterServer(url, name, capabilities), () => {
      void handleRegisterMcpServer(url, name, capabilities);
    });
    if (!created) {
      return;
    }
    await refreshMcpServers();
  };

  const handleRequestMcpConnect = async (serverId: string, targetAgentId: string, scopes: string[]) => {
    const grants = await safeAction("Request MCP connect permissions", () =>
      permissionsRequest(targetAgentId, scopes.length > 0 ? scopes : ["tools.invoke"], {
        action: "mcp_connect",
        mcpServerId: serverId
      })
    );
    if (!grants) {
      return;
    }
    const server = mcpServers.find((item) => item.id === serverId);
    setMcpApprovalGrants(grants);
    setMcpIntent({
      kind: "connect",
      serverId,
      targetAgentId,
      scopes,
      label: server?.name ?? "MCP Server"
    });
    setMcpApprovalOpen(true);
  };

  const handleDisconnectMcpServer = async (serverId: string) => {
    const disconnected = await safeAction("Disconnect MCP server", () => mcpDisconnectServer(serverId), () => {
      void handleDisconnectMcpServer(serverId);
    });
    if (!disconnected) {
      return;
    }
    await refreshMcpServers();
  };

  const handleRequestMcpInvoke = async (serverId: string, toolId: string, targetAgentId: string, scopes: string[]) => {
    const grants = await safeAction("Request MCP invoke permissions", () =>
      permissionsRequest(targetAgentId, scopes.length > 0 ? scopes : ["tools.invoke"], {
        action: "mcp_invoke",
        mcpServerId: serverId,
        toolId
      })
    );
    if (!grants) {
      return;
    }
    const tool = mcpTools.find((item) => item.id === toolId);
    setMcpApprovalGrants(grants);
    setMcpIntent({
      kind: "invoke",
      serverId,
      toolId,
      targetAgentId,
      scopes,
      label: tool?.name ?? "MCP Tool"
    });
    setMcpApprovalOpen(true);
  };

  const handleMcpApprovalApproveAll = async () => {
    if (!mcpIntent) {
      return;
    }
    setMcpApprovalBusy(true);
    for (const grant of mcpApprovalGrants) {
      await safeAction("Approve MCP permission", () => permissionsApprove(grant.id));
    }
    const executed =
      mcpIntent.kind === "connect"
        ? await safeAction("Connect MCP server", () => mcpConnectServer(mcpIntent.serverId, mcpIntent.scopes))
        : await safeAction("Invoke MCP tool", () =>
            mcpInvokeTool(mcpIntent.serverId, mcpIntent.toolId, mcpIntent.targetAgentId, {
              source: "major-claw-ui"
            })
          );
    if (!executed) {
      setMcpApprovalBusy(false);
      return;
    }
    await refreshMcpServers();
    if (selectedMcpServerId) {
      const tools = (await safeAction("Reload MCP tools", () => mcpListTools(selectedMcpServerId))) ?? [];
      setMcpTools(tools);
    }
    const [pending, logs] = await Promise.all([
      safeAction("Reload pending approvals", () => permissionsPending(selectedAgentId)),
      safeAction("Reload audit timeline", () => auditLogs(120))
    ]);
    setPendingApprovals(pending ?? []);
    setAuditTimeline(logs ?? []);
    setMcpApprovalBusy(false);
    setMcpApprovalOpen(false);
    setMcpApprovalGrants([]);
    setMcpIntent(null);
  };

  const handleMcpApprovalDenyAll = async () => {
    setMcpApprovalBusy(true);
    for (const grant of mcpApprovalGrants) {
      await safeAction("Deny MCP permission", () => permissionsDeny(grant.id));
    }
    const [pending, logs] = await Promise.all([
      safeAction("Reload pending approvals", () => permissionsPending(selectedAgentId)),
      safeAction("Reload audit timeline", () => auditLogs(120))
    ]);
    setPendingApprovals(pending ?? []);
    setAuditTimeline(logs ?? []);
    setMcpApprovalBusy(false);
    setMcpApprovalOpen(false);
    setMcpApprovalGrants([]);
    setMcpIntent(null);
  };

  const handleVaultSearch = async (query: string) => {
    setVaultSearchQuery(query);
    const items = query.trim() ? await safeAction("Search vault", () => vaultSearch(query, 30)) : vaultRecentItems.slice(0, 8);
    setVaultSearchResults(items ?? []);
  };

  const handleRequestSmartDeposit = async (type: "archive" | "file" | "kb") => {
    const titleByType: Record<"archive" | "file" | "kb", string> = {
      archive: "CSO Smart Deposit Snapshot",
      file: "Generated Artifact Package",
      kb: "Operational Knowledge Entry"
    };
    const summaryByType: Record<"archive" | "file" | "kb", string> = {
      archive: "Captured completed outcome and decision notes for future replay.",
      file: "Stored generated asset with metadata and retrievable path.",
      kb: "Saved reusable procedure and semantic memory for future runs."
    };
    const intent = {
      type,
      title: titleByType[type],
      markdownSummary: summaryByType[type],
      importanceScore: type === "kb" ? 8 : 7,
      tags: ["smart-deposit", type]
    };
    const grants = await safeAction("Request smart deposit permissions", () =>
      permissionsRequest(selectedAgentId, ["vault.deposit", "storage.write"], {
        action: "vault_smart_deposit",
        type
      })
    );
    if (!grants) {
      return;
    }
    setVaultDepositIntent(intent);
    setVaultDepositGrants(grants);
    setVaultDepositApprovalOpen(true);
  };

  const handleVaultDepositApproveAll = async () => {
    if (!vaultDepositIntent) {
      return;
    }
    setVaultDepositBusy(true);
    for (const grant of vaultDepositGrants) {
      await safeAction("Approve vault permission", () => permissionsApprove(grant.id));
    }
    const deposited = await safeAction("Deposit to vault", () =>
      vaultDeposit({
      ...vaultDepositIntent,
      agentId: selectedAgentId
      })
    );
    if (!deposited) {
      setVaultDepositBusy(false);
      return;
    }
    const [summary, capacity, recent, logs, pending] = await Promise.all([
      safeAction("Reload vault summary", () => vaultSummary()),
      safeAction("Reload vault capacity", () => vaultCapacity()),
      safeAction("Reload vault activity", () => vaultRecent(30)),
      safeAction("Reload audit timeline", () => auditLogs(120)),
      safeAction("Reload pending approvals", () => permissionsPending(selectedAgentId))
    ]);
    setVaultSummaryCard(summary);
    setVaultCapacityStats(capacity);
    setVaultRecentItems(recent ?? []);
    setVaultSearchResults((recent ?? []).slice(0, 8));
    setAuditTimeline(logs ?? []);
    setPendingApprovals(pending ?? []);
    setVaultDepositBusy(false);
    setVaultDepositApprovalOpen(false);
    setVaultDepositGrants([]);
    setVaultDepositIntent(null);
  };

  const handleVaultDepositDenyAll = async () => {
    setVaultDepositBusy(true);
    for (const grant of vaultDepositGrants) {
      await safeAction("Deny vault permission", () => permissionsDeny(grant.id));
    }
    const [logs, pending] = await Promise.all([
      safeAction("Reload audit timeline", () => auditLogs(120)),
      safeAction("Reload pending approvals", () => permissionsPending(selectedAgentId))
    ]);
    setAuditTimeline(logs ?? []);
    setPendingApprovals(pending ?? []);
    setVaultDepositBusy(false);
    setVaultDepositApprovalOpen(false);
    setVaultDepositGrants([]);
    setVaultDepositIntent(null);
  };

  const handleVaultPrune = async () => {
    const pruned = await safeAction("Prune vault", () => vaultPrune(3), () => {
      void handleVaultPrune();
    });
    if (!pruned) {
      return;
    }
    const [summary, capacity, recent] = await Promise.all([
      safeAction("Reload vault summary", () => vaultSummary()),
      safeAction("Reload vault capacity", () => vaultCapacity()),
      safeAction("Reload vault activity", () => vaultRecent(30))
    ]);
    setVaultSummaryCard(summary);
    setVaultCapacityStats(capacity);
    setVaultRecentItems(recent ?? []);
    setVaultSearchResults((recent ?? []).slice(0, 8));
  };

  const handleVaultCreateEntry = async (input: {
    type: "archive" | "file" | "kb";
    title: string;
    markdownSummary: string;
    importanceScore: number;
    tags: string[];
    blobPath?: string;
  }) => {
    const created = await safeAction("Create vault entry", () =>
      vaultDeposit({
      ...input,
      agentId: selectedAgentId
      })
    );
    if (!created) {
      return;
    }
    if (created && input.blobPath) {
      const versionInput: {
        diff: string;
        markdownSummary: string;
        importanceScore: number;
        tags: string[];
        blobPath?: string;
      } = {
        diff: "file upload",
        markdownSummary: input.markdownSummary,
        importanceScore: input.importanceScore,
        tags: input.tags
      };
      if (input.blobPath) {
        versionInput.blobPath = input.blobPath;
      }
      await safeAction("Create vault version", () =>
        vaultCreateVersion(created.id, versionInput)
      );
    }
    const [summary, capacity, recent] = await Promise.all([
      safeAction("Reload vault summary", () => vaultSummary()),
      safeAction("Reload vault capacity", () => vaultCapacity()),
      safeAction("Reload vault activity", () => vaultRecent(30))
    ]);
    setVaultSummaryCard(summary);
    setVaultCapacityStats(capacity);
    setVaultRecentItems(recent ?? []);
    setVaultSearchResults((recent ?? []).slice(0, 8));
  };

  const handleVaultUpdateEntry = async (
    entryId: string,
    patch: { title?: string; markdownSummary?: string; importanceScore?: number; tags?: string[]; encrypted?: boolean }
  ) => {
    const updated = await safeAction("Update vault entry", () => vaultUpdateEntry(entryId, patch));
    if (!updated) {
      return;
    }
    const recent = await safeAction("Reload vault activity", () => vaultRecent(30));
    setVaultRecentItems(recent ?? []);
    setVaultSearchResults((recent ?? []).slice(0, 8));
  };

  const handleVaultCreateVersion = async (
    entryId: string,
    input: { markdownSummary?: string; blobPath?: string; diff?: string; importanceScore?: number; tags?: string[] }
  ) => {
    const created = await safeAction("Create vault version", () => vaultCreateVersion(entryId, input));
    if (!created) {
      return;
    }
    const [versions, recent] = await Promise.all([
      safeAction("Reload vault versions", () => vaultListVersions(entryId)),
      safeAction("Reload vault activity", () => vaultRecent(30))
    ]);
    setVaultVersionsByEntry((current) => ({ ...current, [entryId]: versions ?? [] }));
    setVaultRecentItems(recent ?? []);
    setVaultSearchResults((recent ?? []).slice(0, 8));
  };

  const handleVaultFetchVersions = useCallback(
    async (entryId: string) => {
      if (!entryId.trim() || !gatewayRunning) {
        return;
      }
      const versions = await vaultListVersions(entryId);
      setVaultVersionsByEntry((current) => ({ ...current, [entryId]: versions }));
    },
    [gatewayRunning]
  );

  const handleVaultRelocateStorage = async (path: string, moveExisting: boolean) => {
    const info = await vaultRelocateStorage(path, moveExisting);
    if (!info) {
      reportActionError("Relocate vault storage", new Error("vault relocation did not return storage info"), () => {
        void handleVaultRelocateStorage(path, moveExisting);
      });
      return;
    }
    setVaultStorage(info);
  };

  const fetchMarketplacePage = async (mode: "reset" | "append" = "reset") => {
    setMarketplaceBusy(true);
    const cursor = mode === "append" ? marketplaceNextCursor : null;
    const result = await safeAction("Refresh marketplace", () =>
      getLiveSkills(marketplaceSort, marketplaceNonSuspicious, cursor)
    );
    if (!result) {
      setMarketplaceBusy(false);
      return;
    }
    if (result.source === "cache" && result.skills.length === 0) {
      reportActionError("Marketplace sync", new Error("live marketplace unavailable and local cache is empty"), () => {
        void fetchMarketplacePage(mode);
      });
    }
    const merged = mode === "append" ? mergeBySlug(marketplaceRawSkills, result.skills) : result.skills;
    setMarketplaceRawSkills(merged);
    setMarketplaceSource(result.source);
    setMarketplaceNextCursor(result.nextCursor);
    setMarketplaceBusy(false);
  };

  const handleRefreshMarketplace = async () => {
    await fetchMarketplacePage("reset");
  };

  const handleLoadMoreMarketplace = async () => {
    if (!marketplaceNextCursor) {
      return;
    }
    await fetchMarketplacePage("append");
  };

  const handleApproveSingle = async (grantId: string) => {
    await safeAction("Approve permission", () => permissionsApprove(grantId));
    const pending = await safeAction("Reload pending approvals", () => permissionsPending(selectedAgentId));
    setPendingApprovals(pending ?? []);
    const logs = await safeAction("Reload audit timeline", () => auditLogs(120));
    setAuditTimeline(logs ?? []);
  };

  const handleDenySingle = async (grantId: string) => {
    await safeAction("Deny permission", () => permissionsDeny(grantId));
    const pending = await safeAction("Reload pending approvals", () => permissionsPending(selectedAgentId));
    setPendingApprovals(pending ?? []);
    const logs = await safeAction("Reload audit timeline", () => auditLogs(120));
    setAuditTimeline(logs ?? []);
  };

  const handleApprovalModalApproveAll = async () => {
    if (!installIntent) {
      return;
    }
    setApprovalModalBusy(true);
    for (const grant of approvalModalGrants) {
      await safeAction("Approve install permission", () => permissionsApprove(grant.id));
    }
    const result = await safeAction("Install skill", () => clawhubInstall(installIntent.slug, installIntent.targetAgentId));
    if (result?.installed) {
      const installed = (await safeAction("Reload installed skills", () => getInstalledSkills(installIntent.targetAgentId))) ?? [];
      setInstalledSkills(installed);
      const refreshed = await safeAction("Refresh marketplace", () => getLiveSkills(marketplaceSort, marketplaceNonSuspicious, null));
      if (!refreshed) {
        setApprovalModalBusy(false);
        return;
      }
      setMarketplaceRawSkills(refreshed.skills);
      setMarketplaceSource(refreshed.source);
      setMarketplaceNextCursor(refreshed.nextCursor);
      const filtered = filterMarketplaceSkills(refreshed.skills, marketplaceQuery);
      setMarketplaceSkills(filtered);
      const match = filtered.find((skill) => skill.slug === installIntent.slug) ?? null;
      if (match) {
        setSelectedMarketplaceSkill(match);
      }
    }
    const pending = await safeAction("Reload pending approvals", () => permissionsPending(selectedAgentId));
    setPendingApprovals(pending ?? []);
    const logs = await safeAction("Reload audit timeline", () => auditLogs(120));
    setAuditTimeline(logs ?? []);
    setApprovalModalBusy(false);
    setApprovalModalOpen(false);
    setApprovalModalGrants([]);
    setInstallIntent(null);
  };

  const handleApprovalModalDenyAll = async () => {
    setApprovalModalBusy(true);
    for (const grant of approvalModalGrants) {
      await safeAction("Deny install permission", () => permissionsDeny(grant.id));
    }
    const pending = await safeAction("Reload pending approvals", () => permissionsPending(selectedAgentId));
    setPendingApprovals(pending ?? []);
    const logs = await safeAction("Reload audit timeline", () => auditLogs(120));
    setAuditTimeline(logs ?? []);
    setApprovalModalBusy(false);
    setApprovalModalOpen(false);
    setApprovalModalGrants([]);
    setInstallIntent(null);
  };

  const handleIntegrationApprovalApproveAll = async () => {
    if (!integrationIntent) {
      return;
    }
    setApprovalModalBusy(true);
    for (const grant of integrationApprovalGrants) {
      await safeAction("Approve integration permission", () => permissionsApprove(grant.id));
    }
    const connected = await safeAction("Connect integration", () =>
      connectIntegration(integrationIntent.slug, [integrationIntent.targetAgentId], integrationIntent.config)
    );
    if (!connected) {
      setApprovalModalBusy(false);
      return;
    }
    const [result, providers] = await Promise.all([
      safeAction("Reload integrations", () => getIntegrations(integrationsQuery, integrationsCategory)),
      safeAction("Reload model providers", () => getConnectedModelProviders())
    ]);
    if (!result) {
      setApprovalModalBusy(false);
      return;
    }
    setIntegrations(result.items);
    setIntegrationCategories(result.categories);
    setConnectedModelProviders(providers ?? []);
    setSelectedIntegration(result.items.find((item) => item.slug === integrationIntent.slug) ?? result.items[0] ?? null);
    const pending = await safeAction("Reload pending approvals", () => permissionsPending(selectedAgentId));
    setPendingApprovals(pending ?? []);
    const logs = await safeAction("Reload audit timeline", () => auditLogs(120));
    setAuditTimeline(logs ?? []);
    setApprovalModalBusy(false);
    setIntegrationApprovalOpen(false);
    setIntegrationApprovalGrants([]);
    setIntegrationIntent(null);
  };

  const handleIntegrationApprovalDenyAll = async () => {
    setApprovalModalBusy(true);
    for (const grant of integrationApprovalGrants) {
      await safeAction("Deny integration permission", () => permissionsDeny(grant.id));
    }
    const pending = await safeAction("Reload pending approvals", () => permissionsPending(selectedAgentId));
    setPendingApprovals(pending ?? []);
    const logs = await safeAction("Reload audit timeline", () => auditLogs(120));
    setAuditTimeline(logs ?? []);
    setApprovalModalBusy(false);
    setIntegrationApprovalOpen(false);
    setIntegrationApprovalGrants([]);
    setIntegrationIntent(null);
  };

  useEffect(() => {
    if (!redPhoneResult) {
      return;
    }
    const timer = setTimeout(() => setRedPhoneResult(null), 2800);
    return () => clearTimeout(timer);
  }, [redPhoneResult]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "h") {
        event.preventDefault();
        setTab("health");
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  const refreshHealth = async () => {
    const [snapshot, events] = await Promise.all([
      safeAction("Refresh health snapshot", () => getHealthSnapshot()),
      safeAction("Refresh health events", () => getHealthEvents(200))
    ]);
    setHealthSnapshot(snapshot);
    setHealthEvents(events ?? []);
  };

  const handleExportHealth = async (format: "json" | "csv") => {
    const exported = await safeAction("Export health telemetry", () => exportHealthTelemetry(format, 500));
    if (!exported) {
      return;
    }
    const blob = new Blob([exported.payload], { type: format === "json" ? "application/json" : "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `major-claw-telemetry-${new Date().toISOString().replaceAll(":", "-")}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const refreshAnalytics = async (range = analyticsRange) => {
    const next = await safeAction("Refresh analytics snapshot", () => getAnalyticsSnapshot(range));
    setAnalyticsSnapshot(next);
  };

  const handleExportAnalytics = async (format: "json" | "csv") => {
    const exported = await safeAction("Export analytics report", () => exportAnalyticsReport(analyticsRange, format));
    if (!exported) {
      return;
    }
    const blob = new Blob([exported.payload], { type: format === "json" ? "application/json" : "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `major-claw-analytics-${analyticsRange}-${new Date().toISOString().replaceAll(":", "-")}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportAnalyticsPdf = () => {
    if (!analyticsSnapshot) {
      return;
    }
    const html = `
      <html>
        <head><title>Major Claw Analytics Report</title></head>
        <body style="font-family: Inter, Arial, sans-serif; padding: 24px; color: #111;">
          <h1>Major Claw Analytics Report (${analyticsSnapshot.range})</h1>
          <p>Generated: ${new Date().toLocaleString()}</p>
          <h2>KPIs</h2>
          <ul>
            <li>Spend: $${analyticsSnapshot.kpis.spend.value.toFixed(2)} (${analyticsSnapshot.kpis.spend.deltaPct.toFixed(1)}%)</li>
            <li>Vault Growth: ${analyticsSnapshot.kpis.vaultGrowth.value.toFixed(2)} GB (${analyticsSnapshot.kpis.vaultGrowth.deltaPct.toFixed(1)}%)</li>
            <li>Active Agents: ${analyticsSnapshot.kpis.activeAgents.value.toFixed(0)} (${analyticsSnapshot.kpis.activeAgents.deltaPct.toFixed(1)}%)</li>
          </ul>
          <h2>Recommendations</h2>
          <ul>${analyticsSnapshot.recommendations.map((item) => `<li>${item}</li>`).join("") || "<li>No immediate actions.</li>"}</ul>
        </body>
      </html>
    `;
    const win = window.open("", "_blank");
    if (!win) {
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  useEffect(() => {
    if (tab !== "health") {
      return;
    }
    void refreshHealth();
  }, [tab]);

  useEffect(() => {
    if (tab !== "analytics") {
      return;
    }
    void refreshAnalytics();
  }, [tab, analyticsRange]);

  useEffect(() => {
    if (telemetryStream.latestSnapshot) {
      setHealthSnapshot(telemetryStream.latestSnapshot);
    }
  }, [telemetryStream.latestSnapshot]);

  useEffect(() => {
    if (telemetryStream.events.length === 0) {
      return;
    }
    setHealthEvents((current) => {
      const byId = new Map(current.map((item) => [item.id, item] as const));
      for (const event of telemetryStream.events) {
        byId.set(event.id, event);
      }
      return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200);
    });
  }, [telemetryStream.events]);

  const filteredHealthEvents = useMemo(() => {
    if (healthCategoryFilter === "all") {
      return healthEvents;
    }
    return healthEvents.filter((item) => item.category === healthCategoryFilter);
  }, [healthEvents, healthCategoryFilter]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-void text-text-primary">
      <div className="starfield" />
      <div className="pointer-events-none absolute -left-36 top-24 h-80 w-80 rounded-full bg-lobster/15 blur-[120px]" />
      <div className="pointer-events-none absolute -right-24 top-40 h-72 w-72 rounded-full bg-cyan/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-120px] left-1/2 h-80 w-[520px] -translate-x-1/2 rounded-full bg-lobster/10 blur-[140px]" />
      <div className="relative z-10 flex h-full flex-col">
        <TopBar
          gatewayRunning={gatewayRunning}
          gatewayPort={gatewayPort}
          health={gatewayHealth}
          spendToday={budgetSnapshot?.global.currentCostUsd ?? 0}
          onStartGateway={handleStartGateway}
          onStopGateway={handleStopGateway}
          onBrowseSkills={() => setTab("marketplace")}
          onRedPhone={() => setRedPhoneOpen(true)}
        />
        <div className="flex min-h-0 flex-1">
          <HierarchyPanel
            agents={agents}
            selectedAgentId={selectedAgentId}
            onSelectAgent={setSelectedAgentId}
            onNewAgent={() => setNewAgentModalOpen(true)}
            onReorderAgents={handleReorderAgents}
            onQuickAction={handleQuickAgentAction}
          />
          <CenterPanel
            tab={tab}
            setTab={setTab}
            tasks={tasks}
            onCreateTask={handleCreateTask}
            onUpdateTaskStatus={handleUpdateTaskStatus}
            onUpdateTaskAssignee={handleUpdateTaskAssignee}
            onArchiveTask={handleArchiveTask}
            onDeleteTask={handleDeleteTask}
            onBulkArchiveTasks={handleBulkArchiveTasks}
            onBulkDeleteTasks={handleBulkDeleteTasks}
            taskDeleteUndoCount={taskDeleteUndoCount}
            onUndoTaskDelete={handleUndoTaskDelete}
            gatewayInstances={gatewayInstances}
            gatewayHealth={gatewayHealth}
            warRoomSpendToday={budgetSnapshot?.global.currentCostUsd ?? 0}
            warRoomBudgetAlerts={(budgetSnapshot?.agents ?? []).filter((item) => item.currentCostUsd >= item.costLimitUsd * 0.9).length}
            draftMessage={draftMessage}
            setDraftMessage={setDraftMessage}
            logFilter={logFilter}
            setLogFilter={setLogFilter}
            auditTimeline={auditTimeline}
            budgetSnapshot={budgetSnapshot}
            marketplaceQuery={marketplaceQuery}
            setMarketplaceQuery={setMarketplaceQuery}
            marketplaceSort={marketplaceSort}
            setMarketplaceSort={setMarketplaceSort}
            marketplaceSkills={marketplaceSkills}
            selectedMarketplaceSkill={selectedMarketplaceSkill}
            onSelectMarketplaceSkill={handleSelectMarketplaceSkill}
            onInstallSkill={handleInstallSkill}
            onRefreshMarketplace={handleRefreshMarketplace}
            onLoadMoreMarketplace={handleLoadMoreMarketplace}
            marketplaceHasMore={Boolean(marketplaceNextCursor)}
            marketplaceSource={marketplaceSource}
            marketplaceNonSuspicious={marketplaceNonSuspicious}
            onToggleMarketplaceNonSuspicious={() => setMarketplaceNonSuspicious((value) => !value)}
            marketplaceBusy={marketplaceBusy}
            agents={agents}
            integrationsQuery={integrationsQuery}
            setIntegrationsQuery={setIntegrationsQuery}
            integrationsCategory={integrationsCategory}
            setIntegrationsCategory={setIntegrationsCategory}
            integrationCategories={integrationCategories}
            integrations={integrations}
            selectedIntegration={selectedIntegration}
            selectedIntegrationTargetAgentId={selectedIntegrationTargetAgentId}
            setSelectedIntegrationTargetAgentId={setSelectedIntegrationTargetAgentId}
            onSelectIntegration={handleSelectIntegration}
            onConnectIntegration={handleConnectIntegration}
            integrationBusy={integrationBusy}
            mcpServers={mcpServers}
            mcpTools={mcpTools}
            selectedMcpServerId={selectedMcpServerId}
            setSelectedMcpServerId={setSelectedMcpServerId}
            onRegisterMcpServer={handleRegisterMcpServer}
            onRequestMcpConnect={handleRequestMcpConnect}
            onDisconnectMcpServer={handleDisconnectMcpServer}
            onRequestMcpInvoke={handleRequestMcpInvoke}
            onJumpToAgent={handleJumpToAgentFromChat}
            onInstallSuggestedSkill={handleInstallSuggestedSkillFromChat}
            onOpenMarketplaceForSkill={handleOpenMarketplaceForSkillFromChat}
            vaultSummary={vaultSummaryCard}
            vaultCapacity={vaultCapacityStats}
            vaultRecent={vaultRecentItems}
            vaultSearchQuery={vaultSearchQuery}
            vaultSearchResults={vaultSearchResults}
            onVaultSearch={handleVaultSearch}
            onVaultOpenFull={() => setVaultBrowserOpen(true)}
            onVaultSmartDeposit={handleRequestSmartDeposit}
            onVaultPrune={handleVaultPrune}
            vaultBrowserOpen={vaultBrowserOpen}
            onVaultBrowserClose={() => setVaultBrowserOpen(false)}
            onVaultCreateEntry={handleVaultCreateEntry}
            onVaultUpdateEntry={handleVaultUpdateEntry}
            onVaultCreateVersion={handleVaultCreateVersion}
            onVaultFetchVersions={handleVaultFetchVersions}
            vaultVersionsByEntry={vaultVersionsByEntry}
            vaultStorage={vaultStorage}
            onVaultRelocateStorage={handleVaultRelocateStorage}
            healthSnapshot={healthSnapshot}
            healthEvents={filteredHealthEvents}
            healthCategoryFilter={healthCategoryFilter}
            setHealthCategoryFilter={setHealthCategoryFilter}
            onRefreshHealth={refreshHealth}
            onExportHealth={handleExportHealth}
            healthStreamConnected={telemetryStream.connected}
            analyticsRange={analyticsRange}
            setAnalyticsRange={setAnalyticsRange}
            analyticsSnapshot={analyticsSnapshot}
            onRefreshAnalytics={refreshAnalytics}
            onExportAnalytics={handleExportAnalytics}
            onExportAnalyticsPdf={handleExportAnalyticsPdf}
          />
          <RightPanel
            selectedAgent={selectedAgent}
            selectedAgentConfig={selectedAgentConfig}
            pendingApprovals={pendingApprovals}
            auditTimeline={auditTimeline}
            installedSkills={installedSkills}
            onToggleSkill={handleToggleSkill}
            onApprove={handleApproveSingle}
            onDeny={handleDenySingle}
            onUpdateAgentConfig={handleUpdateSelectedAgentConfig}
            onTestAgentConnection={handleTestAgentConnection}
            modelProviderOptions={connectedModelProviders}
            budgetSnapshot={budgetSnapshot}
            onUpdateAgentBudget={handleUpdateAgentBudget}
            checkpoints={checkpoints}
            onRewindCheckpoint={handleRewindCheckpoint}
            daemonStatus={gatewayDaemonStatus}
            daemonBusy={gatewayDaemonBusy}
            onToggleDaemon={handleToggleAlwaysOnDaemon}
            onDaemonStart={handleDaemonStart}
            onDaemonStop={handleDaemonStop}
            onDaemonRestart={handleDaemonRestart}
            onDaemonLogs={handleDaemonLogs}
          />
        </div>
      </div>
      {hierarchyActionMessage ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-lobster/30 bg-black/80 px-4 py-2 text-xs text-text-primary shadow-lobster-glow">
          {hierarchyActionMessage}
        </div>
      ) : null}
      {redPhoneResult ? (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-20 -translate-x-1/2 rounded-full border border-red-400/40 bg-black/85 px-4 py-2 text-xs text-red-100 shadow-[0_0_18px_rgba(239,68,68,0.35)]">
          {redPhoneResult}
        </div>
      ) : null}
      {redPhoneOpen ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-400/40 bg-[#0f0f12] p-4 shadow-[0_0_24px_rgba(239,68,68,0.28)]">
            <p className="text-xs uppercase tracking-[0.14em] text-red-200">Red Phone</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">Emergency swarm stop</p>
            <p className="mt-2 text-xs text-text-secondary">This immediately stops the Major Claw gateway. Provide a reason for the audit timeline.</p>
            <textarea
              value={redPhoneReason}
              onChange={(event) => setRedPhoneReason(event.target.value)}
              rows={3}
              placeholder="Reason (required)"
              className="mt-3 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-text-primary outline-none focus:border-red-400/50"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button className="lobster-button" type="button" onClick={() => setRedPhoneOpen(false)} disabled={redPhoneBusy}>
                Cancel
              </button>
              <button
                className="rounded-lg border border-red-400/60 bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-100 disabled:opacity-60"
                type="button"
                onClick={() => void handleRedPhoneConfirm()}
                disabled={redPhoneBusy || !redPhoneReason.trim()}
              >
                {redPhoneBusy ? "Stopping..." : "Trigger Stop"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <PermissionApprovalModal
        open={approvalModalOpen}
        grants={approvalModalGrants}
        skillName={installIntent?.skillName ?? "Selected Skill"}
        targetAgentName={installIntent?.targetAgentId ?? selectedAgentId}
        busy={approvalModalBusy}
        onApproveAll={() => void handleApprovalModalApproveAll()}
        onDenyAll={() => void handleApprovalModalDenyAll()}
        onClose={() => {
          setApprovalModalOpen(false);
          setInstallIntent(null);
          setApprovalModalGrants([]);
        }}
      />
      <PermissionApprovalModal
        open={integrationApprovalOpen}
        grants={integrationApprovalGrants}
        skillName={integrationIntent?.name ?? "Selected Integration"}
        targetAgentName={integrationIntent?.targetAgentId ?? selectedAgentId}
        busy={approvalModalBusy}
        onApproveAll={() => void handleIntegrationApprovalApproveAll()}
        onDenyAll={() => void handleIntegrationApprovalDenyAll()}
        onClose={() => {
          setIntegrationApprovalOpen(false);
          setIntegrationIntent(null);
          setIntegrationApprovalGrants([]);
        }}
      />
      <PermissionApprovalModal
        open={mcpApprovalOpen}
        grants={mcpApprovalGrants}
        skillName={mcpIntent?.label ?? "MCP Action"}
        targetAgentName={mcpIntent?.targetAgentId ?? selectedAgentId}
        busy={mcpApprovalBusy}
        onApproveAll={() => void handleMcpApprovalApproveAll()}
        onDenyAll={() => void handleMcpApprovalDenyAll()}
        onClose={() => {
          setMcpApprovalOpen(false);
          setMcpIntent(null);
          setMcpApprovalGrants([]);
        }}
      />
      <PermissionApprovalModal
        open={vaultDepositApprovalOpen}
        grants={vaultDepositGrants}
        skillName={vaultDepositIntent?.title ?? "Smart Deposit"}
        targetAgentName={selectedAgentId}
        busy={vaultDepositBusy}
        onApproveAll={() => void handleVaultDepositApproveAll()}
        onDenyAll={() => void handleVaultDepositDenyAll()}
        onClose={() => {
          setVaultDepositApprovalOpen(false);
          setVaultDepositIntent(null);
          setVaultDepositGrants([]);
        }}
      />
      <NewAgentModal
        open={newAgentModalOpen}
        busy={newAgentBusy}
        agents={agents}
        onClose={() => setNewAgentModalOpen(false)}
        onCreate={handleCreateAgent}
      />
    </div>
  );
}
