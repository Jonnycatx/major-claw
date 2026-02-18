import { useEffect, useMemo, useState } from "react";
import type { AgentProfile, TaskRecord } from "@majorclaw/shared-types";
import { CenterPanel, type CenterTab } from "./components/CenterPanel.js";
import { HierarchyPanel } from "./components/HierarchyPanel.js";
import { NewAgentModal } from "./components/NewAgentModal.js";
import { PermissionApprovalModal } from "./components/PermissionApprovalModal.js";
import { RightPanel } from "./components/RightPanel.js";
import { TopBar } from "./components/TopBar.js";
import {
  auditLogs,
  connectIntegration,
  createAgent,
  getAgentLogs,
  clawhubGetSkillDetails,
  clawhubInstall,
  getAgentConfig,
  getIntegrations,
  getIntegrationStatus,
  getConnectedModelProviders,
  getInstalledSkills,
  type IntegrationEntry,
  type ConnectedModelProvider,
  listAgents,
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
  startGateway,
  stopGateway,
  updateAgentConfig,
  toggleSkill
} from "./tauriGateway.js";
import "./styles.css";

const fallbackAgents: AgentProfile[] = [
  { id: "agent_cso", name: "CSO", role: "chief_orchestration", modelProfileId: "model_cso", status: "online", parentId: null }
];

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
  const [agents, setAgents] = useState<AgentProfile[]>(fallbackAgents);
  const [selectedAgentId, setSelectedAgentId] = useState("agent_cso");
  const [selectedAgentConfig, setSelectedAgentConfig] = useState<AgentFullConfig | null>(null);
  const [newAgentModalOpen, setNewAgentModalOpen] = useState(false);
  const [newAgentBusy, setNewAgentBusy] = useState(false);
  const [tab, setTab] = useState<CenterTab>("kanban");
  const [tasks] = useState(seedTasks);
  const [draftMessage, setDraftMessage] = useState("@cso status update");
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
  const [gatewayRunning, setGatewayRunning] = useState(false);
  const [gatewayPort, setGatewayPort] = useState<number | null>(null);
  const [gatewayHealth, setGatewayHealth] = useState("excellent");
  const [gatewayInstances, setGatewayInstances] = useState<number | null>(null);
  const [hierarchyActionMessage, setHierarchyActionMessage] = useState<string | null>(null);

  const selectedAgent = useMemo(() => agents.find((agent) => agent.id === selectedAgentId) ?? agents[0]!, [agents, selectedAgentId]);

  useEffect(() => {
    const refreshGatewayState = async () => {
      const status = await getGatewayStatus();
      if (status) {
        setGatewayRunning(status.running);
        setGatewayPort(status.port);
      }
      const health = await getGatewayHealth();
      if (health) {
        setGatewayHealth(health.status || "excellent");
        setGatewayInstances(health.instanceCount ?? null);
      }
      const liveAgents = await listAgents();
      if (liveAgents.length > 0) {
        setAgents(liveAgents);
        setSelectedAgentId((current) => (liveAgents.some((item) => item.id === current) ? current : liveAgents[0]!.id));
      }
      const initialAgentId = liveAgents[0]?.id ?? selectedAgentId;
      const installed = await getInstalledSkills(initialAgentId);
      setInstalledSkills(installed);
      const pending = await permissionsPending(initialAgentId);
      setPendingApprovals(pending);
      const logs = await auditLogs(120);
      setAuditTimeline(logs);
      const config = await getAgentConfig(initialAgentId);
      setSelectedAgentConfig(config);
      const integrationsResult = await getIntegrations("", "All Categories");
      setIntegrations(integrationsResult.items);
      setIntegrationCategories(integrationsResult.categories);
      setSelectedIntegration(integrationsResult.items[0] ?? null);
      const providers = await getConnectedModelProviders();
      setConnectedModelProviders(providers);
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
        getIntegrations(integrationsQuery, integrationsCategory),
        getConnectedModelProviders()
      ]);
      setIntegrations(result.items);
      setIntegrationCategories(result.categories);
      setConnectedModelProviders(providers);
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
      const installed = await getInstalledSkills(selectedAgentId);
      setInstalledSkills(installed);
      const pending = await permissionsPending(selectedAgentId);
      setPendingApprovals(pending);
      const logs = await auditLogs(120);
      setAuditTimeline(logs);
      const config = await getAgentConfig(selectedAgentId);
      setSelectedAgentConfig(config);
    };
    void refreshInstalledForAgent();
  }, [selectedAgentId]);

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
          getIntegrations(integrationsQuery, integrationsCategory),
          getConnectedModelProviders()
        ]);
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
        setConnectedModelProviders(providers);
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

  const handleStartGateway = async () => {
    const status = await startGateway();
    if (status) {
      setGatewayRunning(status.running);
      setGatewayPort(status.port);
    }
  };

  const handleStopGateway = async () => {
    const status = await stopGateway();
    if (status) {
      setGatewayRunning(status.running);
      setGatewayPort(status.port);
    }
  };

  const handleSelectMarketplaceSkill = async (skill: ClawHubSkill) => {
    setSelectedMarketplaceSkill(skill);
    const details = await clawhubGetSkillDetails(skill.slug);
    if (details) {
      setSelectedMarketplaceSkill(details);
    }
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
    const grants = await permissionsRequest(target, skill.permissions, { skillSlug: slug, action: "install_preview" });
    setApprovalModalGrants(grants);
    setInstallIntent({ slug, targetAgentId: target, skillName: skill.name });
    setApprovalModalOpen(true);
    setMarketplaceBusy(false);
  };

  const handleToggleSkill = async (slug: string, enabled: boolean) => {
    await toggleSkill(selectedAgentId, slug, enabled);
    const installed = await getInstalledSkills(selectedAgentId);
    setInstalledSkills(installed);
  };

  const handleCreateAgent = async (payload: Parameters<typeof createAgent>[0]) => {
    setNewAgentBusy(true);
    const created = await createAgent(payload);
    const updated = await listAgents();
    if (updated.length > 0) {
      setAgents(updated);
    }
    if (created) {
      setSelectedAgentId(created.id);
    }
    setNewAgentBusy(false);
    setNewAgentModalOpen(false);
  };

  const handleReorderAgents = async (order: string[]) => {
    const reordered = await reorderAgents(order);
    if (reordered.length > 0) {
      setAgents(reordered);
    }
  };

  const handleUpdateSelectedAgentConfig = async (patch: Parameters<typeof updateAgentConfig>[1]) => {
    await updateAgentConfig(selectedAgentId, patch);
    const [updatedAgents, config] = await Promise.all([listAgents(), getAgentConfig(selectedAgentId)]);
    if (updatedAgents.length > 0) {
      setAgents(updatedAgents);
    }
    setSelectedAgentConfig(config);
  };

  const handleQuickAgentAction = async (agentId: string, action: AgentQuickAction) => {
    const result = await runAgentQuickAction(agentId, action);
    if (!result) {
      return;
    }
    setHierarchyActionMessage(result.message);
    const updatedAgents = await listAgents();
    if (updatedAgents.length > 0) {
      setAgents(updatedAgents);
      if (!updatedAgents.some((agent) => agent.id === selectedAgentId)) {
        setSelectedAgentId(updatedAgents[0]!.id);
      }
    }
    if (action === "logs") {
      const logs = await getAgentLogs(agentId, 50);
      setAuditTimeline(logs);
      return;
    }
    const config = await getAgentConfig(selectedAgentId);
    setSelectedAgentConfig(config);
  };

  const handleTestAgentConnection = async (apiKey?: string): Promise<AgentConnectionTestResult | null> => {
    const result = await testAgentConnection(selectedAgentId, apiKey);
    const [updatedAgents, config] = await Promise.all([listAgents(), getAgentConfig(selectedAgentId)]);
    if (updatedAgents.length > 0) {
      setAgents(updatedAgents);
    }
    setSelectedAgentConfig(config);
    return result;
  };

  const handleSelectIntegration = (integration: IntegrationEntry) => {
    setSelectedIntegration(integration);
  };

  const handleConnectIntegration = async (slug: string, targetAgentId: string, config?: Record<string, string>) => {
    const integration = integrations.find((item) => item.slug === slug) ?? selectedIntegration;
    if (!integration) {
      return;
    }
    setIntegrationBusy(true);
    const grants = await permissionsRequest(targetAgentId, integration.permissions, {
      integrationSlug: slug,
      action: "integration_connect"
    });
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

  const fetchMarketplacePage = async (mode: "reset" | "append" = "reset") => {
    setMarketplaceBusy(true);
    const cursor = mode === "append" ? marketplaceNextCursor : null;
    const result = await getLiveSkills(marketplaceSort, marketplaceNonSuspicious, cursor);
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
    await permissionsApprove(grantId);
    const pending = await permissionsPending(selectedAgentId);
    setPendingApprovals(pending);
    const logs = await auditLogs(120);
    setAuditTimeline(logs);
  };

  const handleDenySingle = async (grantId: string) => {
    await permissionsDeny(grantId);
    const pending = await permissionsPending(selectedAgentId);
    setPendingApprovals(pending);
    const logs = await auditLogs(120);
    setAuditTimeline(logs);
  };

  const handleApprovalModalApproveAll = async () => {
    if (!installIntent) {
      return;
    }
    setApprovalModalBusy(true);
    for (const grant of approvalModalGrants) {
      await permissionsApprove(grant.id);
    }
    const result = await clawhubInstall(installIntent.slug, installIntent.targetAgentId);
    if (result?.installed) {
      const installed = await getInstalledSkills(installIntent.targetAgentId);
      setInstalledSkills(installed);
      const refreshed = await getLiveSkills(marketplaceSort, marketplaceNonSuspicious, null);
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
    const pending = await permissionsPending(selectedAgentId);
    setPendingApprovals(pending);
    const logs = await auditLogs(120);
    setAuditTimeline(logs);
    setApprovalModalBusy(false);
    setApprovalModalOpen(false);
    setApprovalModalGrants([]);
    setInstallIntent(null);
  };

  const handleApprovalModalDenyAll = async () => {
    setApprovalModalBusy(true);
    for (const grant of approvalModalGrants) {
      await permissionsDeny(grant.id);
    }
    const pending = await permissionsPending(selectedAgentId);
    setPendingApprovals(pending);
    const logs = await auditLogs(120);
    setAuditTimeline(logs);
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
      await permissionsApprove(grant.id);
    }
    await connectIntegration(integrationIntent.slug, [integrationIntent.targetAgentId], integrationIntent.config);
    const [result, providers] = await Promise.all([
      getIntegrations(integrationsQuery, integrationsCategory),
      getConnectedModelProviders()
    ]);
    setIntegrations(result.items);
    setIntegrationCategories(result.categories);
    setConnectedModelProviders(providers);
    setSelectedIntegration(result.items.find((item) => item.slug === integrationIntent.slug) ?? result.items[0] ?? null);
    const pending = await permissionsPending(selectedAgentId);
    setPendingApprovals(pending);
    const logs = await auditLogs(120);
    setAuditTimeline(logs);
    setApprovalModalBusy(false);
    setIntegrationApprovalOpen(false);
    setIntegrationApprovalGrants([]);
    setIntegrationIntent(null);
  };

  const handleIntegrationApprovalDenyAll = async () => {
    setApprovalModalBusy(true);
    for (const grant of integrationApprovalGrants) {
      await permissionsDeny(grant.id);
    }
    const pending = await permissionsPending(selectedAgentId);
    setPendingApprovals(pending);
    const logs = await auditLogs(120);
    setAuditTimeline(logs);
    setApprovalModalBusy(false);
    setIntegrationApprovalOpen(false);
    setIntegrationApprovalGrants([]);
    setIntegrationIntent(null);
  };

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
          spendToday={1.42}
          onStartGateway={handleStartGateway}
          onStopGateway={handleStopGateway}
          onBrowseSkills={() => setTab("marketplace")}
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
            gatewayInstances={gatewayInstances}
            draftMessage={draftMessage}
            setDraftMessage={setDraftMessage}
            logFilter={logFilter}
            setLogFilter={setLogFilter}
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
            onJumpToAgent={handleJumpToAgentFromChat}
            onInstallSuggestedSkill={handleInstallSuggestedSkillFromChat}
            onOpenMarketplaceForSkill={handleOpenMarketplaceForSkillFromChat}
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
          />
        </div>
      </div>
      {hierarchyActionMessage ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-lobster/30 bg-black/80 px-4 py-2 text-xs text-text-primary shadow-lobster-glow">
          {hierarchyActionMessage}
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
