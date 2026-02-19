import type { AgentProfile, TaskRecord } from "@majorclaw/shared-types";
import { type DragEvent, useEffect, useMemo, useState } from "react";
import type {
  AgentBudget,
  AuditLogEntry,
  ClawHubSkill,
  ClawHubSort,
  IntegrationEntry,
  McpServerEntry,
  McpToolEntry,
  VaultEntry,
  VaultStorageInfo,
  VaultVersion,
  VaultSummary,
  VaultStorageStats,
  AnalyticsSnapshot,
  HealthSnapshot,
  HealthTelemetryEvent
} from "../tauriGateway.js";
import { PanelCard } from "./ui/PanelCard.js";
import { IntegrationsPanel } from "./IntegrationsPanel.js";
import { ChatCommandPanel } from "./ChatCommandPanel.js";

export type CenterTab = "overview" | "warroom" | "kanban" | "chat" | "logs" | "analytics" | "health" | "integrations" | "marketplace";

type CenterPanelProps = {
  tab: CenterTab;
  setTab: (tab: CenterTab) => void;
  tasks: TaskRecord[];
  onCreateTask: (input: { title: string; assigneeAgentId?: string | null; status?: TaskRecord["status"] }) => Promise<void>;
  onUpdateTaskStatus: (taskId: string, status: TaskRecord["status"]) => Promise<void>;
  onUpdateTaskAssignee: (taskId: string, assigneeAgentId: string) => Promise<void>;
  onArchiveTask: (taskId: string) => Promise<void>;
  onDeleteTask: (task: TaskRecord) => Promise<void>;
  onBulkArchiveTasks: (taskIds: string[]) => Promise<void>;
  onBulkDeleteTasks: (taskIds: string[]) => Promise<void>;
  taskDeleteUndoCount: number;
  onUndoTaskDelete: () => Promise<void>;
  gatewayInstances: number | null;
  gatewayHealth: string;
  warRoomSpendToday: number;
  warRoomBudgetAlerts: number;
  draftMessage: string;
  setDraftMessage: (value: string) => void;
  logFilter: string;
  setLogFilter: (value: string) => void;
  auditTimeline: AuditLogEntry[];
  budgetSnapshot: { global: AgentBudget; agents: AgentBudget[] } | null;
  marketplaceQuery: string;
  setMarketplaceQuery: (value: string) => void;
  marketplaceSort: ClawHubSort;
  setMarketplaceSort: (value: ClawHubSort) => void;
  marketplaceSkills: ClawHubSkill[];
  selectedMarketplaceSkill: ClawHubSkill | null;
  onSelectMarketplaceSkill: (skill: ClawHubSkill) => void;
  onInstallSkill: (slug: string, targetAgent?: string) => Promise<void>;
  onRefreshMarketplace: () => Promise<void>;
  onLoadMoreMarketplace: () => Promise<void>;
  marketplaceHasMore: boolean;
  marketplaceSource: "live" | "cache";
  marketplaceNonSuspicious: boolean;
  onToggleMarketplaceNonSuspicious: () => void;
  marketplaceBusy: boolean;
  agents: AgentProfile[];
  integrationsQuery: string;
  setIntegrationsQuery: (value: string) => void;
  integrationsCategory: string;
  setIntegrationsCategory: (value: string) => void;
  integrationCategories: { name: string; connectedCount: number; totalCount: number }[];
  integrations: IntegrationEntry[];
  selectedIntegration: IntegrationEntry | null;
  selectedIntegrationTargetAgentId: string;
  setSelectedIntegrationTargetAgentId: (value: string) => void;
  onSelectIntegration: (integration: IntegrationEntry) => void;
  onConnectIntegration: (slug: string, targetAgentId: string, config?: Record<string, string>) => Promise<void>;
  integrationBusy: boolean;
  mcpServers: McpServerEntry[];
  mcpTools: McpToolEntry[];
  selectedMcpServerId: string | null;
  setSelectedMcpServerId: (id: string | null) => void;
  onRegisterMcpServer: (url: string, name?: string, capabilities?: string[]) => Promise<void>;
  onRequestMcpConnect: (serverId: string, targetAgentId: string, scopes: string[]) => Promise<void>;
  onDisconnectMcpServer: (serverId: string) => Promise<void>;
  onRequestMcpInvoke: (serverId: string, toolId: string, targetAgentId: string, scopes: string[]) => Promise<void>;
  onJumpToAgent: (agentId: string) => void;
  onInstallSuggestedSkill: (slug: string, targetAgentId: string) => Promise<void>;
  onOpenMarketplaceForSkill: (slug: string) => void;
  vaultSummary: VaultSummary | null;
  vaultCapacity: VaultStorageStats | null;
  vaultRecent: VaultEntry[];
  vaultSearchQuery: string;
  vaultSearchResults: VaultEntry[];
  onVaultSearch: (query: string) => void;
  onVaultOpenFull: () => void;
  onVaultSmartDeposit: (type: "archive" | "file" | "kb") => Promise<void>;
  onVaultPrune: () => Promise<void>;
  vaultBrowserOpen: boolean;
  onVaultBrowserClose: () => void;
  onVaultCreateEntry: (input: {
    type: "archive" | "file" | "kb";
    title: string;
    markdownSummary: string;
    importanceScore: number;
    tags: string[];
    blobPath?: string;
  }) => Promise<void>;
  onVaultUpdateEntry: (
    entryId: string,
    patch: { title?: string; markdownSummary?: string; importanceScore?: number; tags?: string[]; encrypted?: boolean }
  ) => Promise<void>;
  onVaultCreateVersion: (
    entryId: string,
    input: { markdownSummary?: string; blobPath?: string; diff?: string; importanceScore?: number; tags?: string[] }
  ) => Promise<void>;
  onVaultFetchVersions: (entryId: string) => Promise<void>;
  vaultVersionsByEntry: Record<string, VaultVersion[]>;
  vaultStorage: VaultStorageInfo | null;
  onVaultRelocateStorage: (path: string, moveExisting: boolean) => Promise<void>;
  healthSnapshot: HealthSnapshot | null;
  healthEvents: HealthTelemetryEvent[];
  healthCategoryFilter: "all" | "lifecycle" | "gateway" | "agent" | "vault" | "error" | "system";
  setHealthCategoryFilter: (value: "all" | "lifecycle" | "gateway" | "agent" | "vault" | "error" | "system") => void;
  onRefreshHealth: () => Promise<void>;
  onExportHealth: (format: "json" | "csv") => Promise<void>;
  healthStreamConnected: boolean;
  analyticsRange: "7d" | "30d" | "90d";
  setAnalyticsRange: (value: "7d" | "30d" | "90d") => void;
  analyticsSnapshot: AnalyticsSnapshot | null;
  onRefreshAnalytics: () => Promise<void>;
  onExportAnalytics: (format: "json" | "csv") => Promise<void>;
  onExportAnalyticsPdf: () => void;
};

const tabs: CenterTab[] = ["overview", "warroom", "kanban", "chat", "logs", "analytics", "health", "integrations", "marketplace"];
const statuses = ["inbox", "assigned", "in_progress", "review", "done"] as const;

export function CenterPanel({
  tab,
  setTab,
  tasks,
  onCreateTask,
  onUpdateTaskStatus,
  onUpdateTaskAssignee,
  onArchiveTask,
  onDeleteTask,
  onBulkArchiveTasks,
  onBulkDeleteTasks,
  taskDeleteUndoCount,
  onUndoTaskDelete,
  gatewayInstances,
  gatewayHealth,
  warRoomSpendToday,
  warRoomBudgetAlerts,
  draftMessage,
  setDraftMessage,
  logFilter,
  setLogFilter,
  auditTimeline,
  budgetSnapshot,
  marketplaceQuery,
  setMarketplaceQuery,
  marketplaceSort,
  setMarketplaceSort,
  marketplaceSkills,
  selectedMarketplaceSkill,
  onSelectMarketplaceSkill,
  onInstallSkill,
  onRefreshMarketplace,
  onLoadMoreMarketplace,
  marketplaceHasMore,
  marketplaceSource,
  marketplaceNonSuspicious,
  onToggleMarketplaceNonSuspicious,
  marketplaceBusy,
  agents,
  integrationsQuery,
  setIntegrationsQuery,
  integrationsCategory,
  setIntegrationsCategory,
  integrationCategories,
  integrations,
  selectedIntegration,
  selectedIntegrationTargetAgentId,
  setSelectedIntegrationTargetAgentId,
  onSelectIntegration,
  onConnectIntegration,
  integrationBusy,
  mcpServers,
  mcpTools,
  selectedMcpServerId,
  setSelectedMcpServerId,
  onRegisterMcpServer,
  onRequestMcpConnect,
  onDisconnectMcpServer,
  onRequestMcpInvoke,
  onJumpToAgent,
  onInstallSuggestedSkill,
  onOpenMarketplaceForSkill,
  vaultSummary,
  vaultCapacity,
  vaultRecent,
  vaultSearchQuery,
  vaultSearchResults,
  onVaultSearch,
  onVaultOpenFull,
  onVaultSmartDeposit,
  onVaultPrune,
  vaultBrowserOpen,
  onVaultBrowserClose,
  onVaultCreateEntry,
  onVaultUpdateEntry,
  onVaultCreateVersion,
  onVaultFetchVersions,
  vaultVersionsByEntry,
  vaultStorage,
  onVaultRelocateStorage,
  healthSnapshot,
  healthEvents,
  healthCategoryFilter,
  setHealthCategoryFilter,
  onRefreshHealth,
  onExportHealth,
  healthStreamConnected,
  analyticsRange,
  setAnalyticsRange,
  analyticsSnapshot,
  onRefreshAnalytics,
  onExportAnalytics,
  onExportAnalyticsPdf
}: CenterPanelProps) {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [vaultTab, setVaultTab] = useState<"archive" | "file" | "kb">("archive");
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null);
  const [vaultTitleDraft, setVaultTitleDraft] = useState("");
  const [vaultSummaryDraft, setVaultSummaryDraft] = useState("");
  const [vaultTagsDraft, setVaultTagsDraft] = useState("");
  const [vaultImportanceDraft, setVaultImportanceDraft] = useState(7);
  const [vaultEncryptedDraft, setVaultEncryptedDraft] = useState(false);
  const [versionNote, setVersionNote] = useState("");
  const [newKbTitle, setNewKbTitle] = useState("");
  const [newKbSummary, setNewKbSummary] = useState("");
  const [newKbTags, setNewKbTags] = useState("knowledge,runbook");
  const [newKbImportance, setNewKbImportance] = useState(8);
  const [uploadPreviewName, setUploadPreviewName] = useState("");
  const [uploadPreviewBody, setUploadPreviewBody] = useState<string | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [fileDropActive, setFileDropActive] = useState(false);
  const [vaultToast, setVaultToast] = useState<string | null>(null);
  const [vaultLocationDraft, setVaultLocationDraft] = useState("");
  const [vaultMoveExisting, setVaultMoveExisting] = useState(true);
  const selectedVault = useMemo(
    () => vaultRecent.find((item) => item.id === selectedVaultId) ?? vaultRecent[0] ?? null,
    [selectedVaultId, vaultRecent]
  );
  const filteredVaultForTab = useMemo(() => {
    const map = { archive: "archive", file: "file", kb: "kb" } as const;
    return vaultRecent.filter((entry) => entry.type === map[vaultTab]);
  }, [vaultRecent, vaultTab]);
  const usagePct = vaultSummary ? Math.min(100, (vaultSummary.usedGb / Math.max(vaultSummary.capacityGb, 1)) * 100) : 0;
  const selectedVersions = selectedVault ? vaultVersionsByEntry[selectedVault.id] ?? [] : [];
  const warningClass =
    vaultStorage?.warningLevel === "critical_95"
      ? "text-red-300 border-red-400/40 bg-red-500/15"
      : vaultStorage?.warningLevel === "warning_85"
        ? "text-amber-200 border-amber-300/40 bg-amber-400/15"
        : vaultStorage?.warningLevel === "warning_70"
          ? "text-amber-100 border-amber-200/30 bg-amber-300/10"
          : "text-cyan border-cyan/30 bg-cyan/10";

  const parseTags = (raw: string) =>
    raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const renderSparkline = (points: Array<{ date: string; value: number }>, strokeClass = "stroke-cyan") => {
    if (points.length === 0) {
      return <div className="h-14 rounded-lg border border-white/10 bg-black/30" />;
    }
    const width = 220;
    const height = 56;
    const values = points.map((item) => item.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(0.0001, max - min);
    const path = points
      .map((point, index) => {
        const x = (index / Math.max(1, points.length - 1)) * width;
        const y = height - ((point.value - min) / span) * height;
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="h-14 w-full">
        <path d={path} className={`${strokeClass} fill-none`} strokeWidth="2.2" />
      </svg>
    );
  };
  useEffect(() => {
    setSelectedTaskIds((current) => current.filter((id) => tasks.some((task) => task.id === id)));
  }, [tasks]);

  const detectCodeLanguage = (path: string): string => {
    if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      return "TypeScript";
    }
    if (path.endsWith(".js")) {
      return "JavaScript";
    }
    if (path.endsWith(".py")) {
      return "Python";
    }
    if (path.endsWith(".rs")) {
      return "Rust";
    }
    if (path.endsWith(".json")) {
      return "JSON";
    }
    return "Code";
  };

  const renderMarkdownPreview = (body: string) => {
    const lines = body.split("\n").slice(0, 32);
    return (
      <div className="space-y-1">
        {lines.map((line, idx) => {
          if (line.startsWith("# ")) {
            return (
              <p key={idx} className="text-sm font-semibold text-text-primary">
                {line.slice(2)}
              </p>
            );
          }
          if (line.startsWith("## ")) {
            return (
              <p key={idx} className="text-xs font-semibold text-cyan">
                {line.slice(3)}
              </p>
            );
          }
          if (line.startsWith("- ") || line.startsWith("* ")) {
            return (
              <p key={idx} className="text-[11px] text-text-secondary">
                • {line.slice(2)}
              </p>
            );
          }
          return (
            <p key={idx} className="text-[11px] text-text-secondary">
              {line || "\u00A0"}
            </p>
          );
        })}
      </div>
    );
  };

  const handleFileIngest = (file: File) => {
    const fileName = file.name;
    setUploadPreviewName(fileName);
    if (file.type.startsWith("image/")) {
      setUploadPreviewUrl(URL.createObjectURL(file));
      setUploadPreviewBody(null);
    } else if (file.type.includes("text") || fileName.endsWith(".md") || fileName.endsWith(".ts") || fileName.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = () => {
        setUploadPreviewBody(String(reader.result ?? "").slice(0, 4000));
        setUploadPreviewUrl(null);
      };
      reader.readAsText(file);
    } else {
      setUploadPreviewBody(`Binary artifact: ${fileName}`);
      setUploadPreviewUrl(null);
    }
    void onVaultCreateEntry({
      type: "file",
      title: fileName,
      markdownSummary: `Uploaded artifact ${fileName}`,
      importanceScore: 6,
      tags: ["upload", "artifact"],
      blobPath: `~/.major-claw/vault/swarm_main/${new Date().toISOString().slice(0, 7)}/file/${fileName}`
    });
  };

  const handleSelectVault = (entry: VaultEntry) => {
    setSelectedVaultId(entry.id);
    setVaultTitleDraft(entry.title);
    setVaultSummaryDraft(entry.markdownSummary);
    setVaultTagsDraft(entry.tags.join(", "));
    setVaultImportanceDraft(entry.importanceScore);
    setVaultEncryptedDraft(entry.encrypted);
    void onVaultFetchVersions(entry.id);
  };

  const renderVaultPreview = () => {
    if (!selectedVault) {
      return <p className="text-xs text-text-secondary">Select a vault entry to preview.</p>;
    }
    const path = selectedVault.blobPath?.toLowerCase() ?? "";
    const isImage = path.endsWith(".png") || path.endsWith(".jpg") || path.endsWith(".jpeg") || path.endsWith(".gif") || path.endsWith(".webp");
    const isMarkdown = path.endsWith(".md") || path.endsWith(".markdown");
    const isCode = path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".js") || path.endsWith(".py") || path.endsWith(".rs") || path.endsWith(".json");
    const isPdf = path.endsWith(".pdf");

    if (uploadPreviewUrl && isImage) {
      return <img src={uploadPreviewUrl} alt={selectedVault.title} className="max-h-48 w-full rounded-lg border border-white/10 object-contain" />;
    }
    if (isPdf) {
      return <p className="rounded-lg border border-white/10 bg-black/30 p-2 text-[11px] text-cyan">PDF preview thumbnail available in native Tauri layer.</p>;
    }
    if (isMarkdown && (uploadPreviewBody || selectedVault.markdownSummary)) {
      return (
        <div className="max-h-44 overflow-auto rounded-lg border border-cyan/20 bg-black/35 p-2">
          <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-cyan">Markdown Preview</p>
          {renderMarkdownPreview(uploadPreviewBody ?? selectedVault.markdownSummary)}
        </div>
      );
    }
    if (isCode && (uploadPreviewBody || selectedVault.markdownSummary)) {
      return (
        <div className="max-h-44 overflow-auto rounded-lg border border-white/10 bg-black/35 p-2">
          <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-cyan">{detectCodeLanguage(path)}</p>
          <pre className="text-[11px] text-text-secondary">{uploadPreviewBody ?? selectedVault.markdownSummary}</pre>
        </div>
      );
    }
    if (uploadPreviewBody) {
      return (
        <pre className="max-h-44 overflow-auto rounded-lg border border-white/10 bg-black/35 p-2 text-[11px] text-text-secondary">{uploadPreviewBody}</pre>
      );
    }
    return <p className="text-[11px] text-text-secondary">{selectedVault.markdownSummary}</p>;
  };

  const pushVaultToast = (message: string) => {
    setVaultToast(message);
    window.setTimeout(() => setVaultToast(null), 1700);
  };

  const handleSaveMetadata = async () => {
    if (!selectedVault) {
      return;
    }
    try {
      await onVaultUpdateEntry(selectedVault.id, {
        title: vaultTitleDraft.trim(),
        markdownSummary: vaultSummaryDraft.trim(),
        tags: parseTags(vaultTagsDraft),
        importanceScore: vaultImportanceDraft,
        encrypted: vaultEncryptedDraft
      });
      pushVaultToast("Vault metadata saved");
    } catch {
      pushVaultToast("Save failed");
    }
  };

  const handleCreateVersion = async (diffLabel?: string) => {
    if (!selectedVault) {
      return;
    }
    try {
      await onVaultCreateVersion(selectedVault.id, {
        markdownSummary: vaultSummaryDraft.trim(),
        diff: diffLabel ?? (versionNote.trim() || "manual revision"),
        importanceScore: vaultImportanceDraft,
        tags: parseTags(vaultTagsDraft)
      });
      pushVaultToast("New version created");
    } catch {
      pushVaultToast("Version creation failed");
    }
  };

  const handleRestoreVersion = async (version: VaultVersion) => {
    if (!selectedVault) {
      return;
    }
    try {
      const restoreInput: {
        markdownSummary?: string;
        blobPath?: string;
        diff?: string;
        importanceScore?: number;
        tags?: string[];
      } = {
        markdownSummary: vaultSummaryDraft.trim(),
        diff: `restore v${version.versionNum}`,
        importanceScore: vaultImportanceDraft,
        tags: parseTags(vaultTagsDraft)
      };
      if (version.blobPath) {
        restoreInput.blobPath = version.blobPath;
      }
      await onVaultCreateVersion(selectedVault.id, restoreInput);
      pushVaultToast(`Restored v${version.versionNum}`);
    } catch {
      pushVaultToast("Restore failed");
    }
  };

  const handleRelocateStorage = async () => {
    if (!vaultLocationDraft.trim()) {
      pushVaultToast("Enter a storage path first");
      return;
    }
    try {
      await onVaultRelocateStorage(vaultLocationDraft.trim(), vaultMoveExisting);
      pushVaultToast("Vault location updated");
    } catch {
      pushVaultToast("Relocation failed");
    }
  };

  useEffect(() => {
    if (!selectedVault || !vaultBrowserOpen) {
      return;
    }
    setVaultTitleDraft(selectedVault.title);
    setVaultSummaryDraft(selectedVault.markdownSummary);
    setVaultTagsDraft(selectedVault.tags.join(", "));
    setVaultImportanceDraft(selectedVault.importanceScore);
    setVaultEncryptedDraft(selectedVault.encrypted);
    void onVaultFetchVersions(selectedVault.id);
  }, [onVaultFetchVersions, selectedVault, vaultBrowserOpen]);

  useEffect(() => {
    if (!vaultBrowserOpen) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;
      if (!isMeta || !selectedVault) {
        return;
      }
      const active = document.activeElement;
      const isTypingTarget =
        active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement;
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSaveMetadata();
        return;
      }
      if (event.key.toLowerCase() === "v" && event.shiftKey && !isTypingTarget) {
        event.preventDefault();
        void handleCreateVersion("shortcut revision");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedVault, vaultBrowserOpen, vaultEncryptedDraft, vaultImportanceDraft, vaultSummaryDraft, vaultTagsDraft, vaultTitleDraft, versionNote]);

  useEffect(() => {
    if (vaultStorage?.rootPath) {
      setVaultLocationDraft(vaultStorage.rootPath);
    }
  }, [vaultStorage?.rootPath]);

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-4 border-b border-lobster/20 pb-2">
        {tabs.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            className={`relative px-1.5 pb-2 text-sm font-medium capitalize transition-all duration-200 ${
              tab === name ? "text-lobster" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {name}
            {tab === name ? <span className="absolute -bottom-px left-0 h-0.5 w-full animate-tabSlide bg-lobster shadow-lobster-glow-strong" /> : null}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid h-full grid-cols-4 gap-4">
          <PanelCard title="Connected Instances">{gatewayInstances ?? 0}</PanelCard>
          <PanelCard title="Tasks Active">{tasks.filter((item) => item.status !== "done").length}</PanelCard>
          <PanelCard title="Swarm Energy">
            {gatewayHealth === "excellent" ? "High stability" : gatewayHealth === "degraded" ? "Needs attention" : "Monitoring"}
          </PanelCard>
          <section className="glass-panel border border-lobster/30 bg-panel/80 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-lobster">Vault</p>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-xl font-semibold text-text-primary">{vaultSummary?.usedGb.toFixed(1) ?? "0.0"} GB</p>
              <p className="text-[11px] text-text-secondary">/ {vaultSummary?.capacityGb ?? 128} GB</p>
            </div>
            <div className="mt-2 h-2 rounded-full bg-black/40">
              <div className="h-2 rounded-full bg-gradient-to-r from-cyan via-lobster to-lobster" style={{ width: `${usagePct}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-text-secondary">
              {vaultSummary?.archivedItems ?? 0} archived · {vaultSummary?.fileItems ?? 0} files · {vaultSummary?.knowledgeItems ?? 0} knowledge
            </p>
            <p className="mt-1 text-[10px] text-cyan">
              {vaultStorage ? `${vaultStorage.volumeName} · ${vaultStorage.freeGb.toFixed(1)} GB free` : "Detecting storage..."}
            </p>
            <button className="lobster-button mt-2 w-full" type="button" onClick={onVaultOpenFull}>
              Open Full Vault
            </button>
          </section>
          <section className="glass-panel col-span-4 grid min-h-[300px] grid-cols-[1.2fr_0.9fr] gap-4 border border-lobster/20 bg-panel/75 p-4">
            <div className="min-h-0 overflow-hidden">
              <div className="mb-2 flex items-center justify-between">
                <p className="section-title">Recent Vault Activity</p>
                <p className="text-[11px] text-text-secondary">
                  {vaultCapacity ? `${vaultCapacity.freeGb.toFixed(1)} GB free` : "Syncing capacity..."}
                </p>
              </div>
              <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                {vaultRecent.slice(0, 12).map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-text-primary">{entry.title}</p>
                      <span className="rounded-full border border-cyan/20 bg-cyan/10 px-2 py-0.5 text-[10px] text-cyan">
                        I{entry.importanceScore}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-text-secondary">{entry.markdownSummary}</p>
                  </div>
                ))}
                {vaultRecent.length === 0 ? (
                  <p className="text-xs text-text-secondary">No vault activity yet. Complete a task or deposit a file to populate this feed.</p>
                ) : null}
              </div>
            </div>
            <div className="min-h-0 overflow-hidden rounded-xl border border-lobster/20 bg-black/25 p-3">
              <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-lobster">Quick Search + Actions</p>
              <input
                value={vaultSearchQuery}
                onChange={(event) => onVaultSearch(event.target.value)}
                placeholder="Search archive, files, knowledge..."
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs text-text-primary outline-none focus:border-lobster/70"
              />
              <div className="mt-2 max-h-[160px] space-y-1 overflow-y-auto">
                {vaultSearchResults.slice(0, 6).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      handleSelectVault(entry);
                      onVaultOpenFull();
                    }}
                    className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-left text-[11px] transition-colors hover:border-lobster/40"
                  >
                    <p className="truncate text-text-primary">{entry.title}</p>
                    <p className="truncate text-text-secondary">{entry.type} · {entry.tags.join(", ") || "untagged"}</p>
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-1.5">
                <button className="lobster-button" type="button" onClick={() => void onVaultSmartDeposit("archive")}>
                  Smart Deposit
                </button>
                <button className="lobster-button" type="button" onClick={onVaultOpenFull}>
                  Search Vault
                </button>
                <button className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-2 py-2 text-xs text-amber-100" type="button" onClick={() => void onVaultPrune()}>
                  Prune Low-Importance
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {tab === "kanban" ? (
        <div className="grid min-h-0 flex-1 grid-cols-5 gap-3 overflow-hidden">
          <section className="glass-panel col-span-5 flex items-center gap-2 border border-lobster/20 p-2">
            <input
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              placeholder="Create task..."
              className="w-full rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-xs text-text-primary outline-none focus:border-lobster/50"
            />
            <button
              type="button"
              className="lobster-button-filled whitespace-nowrap"
              disabled={!newTaskTitle.trim()}
              onClick={() => {
                if (!newTaskTitle.trim()) {
                  return;
                }
                void onCreateTask({ title: newTaskTitle.trim(), status: "inbox" });
                setNewTaskTitle("");
              }}
            >
              Add Task
            </button>
            {selectedTaskIds.length > 0 ? (
              <>
                <div className="h-6 w-px bg-white/15" />
                <p className="text-xs text-text-secondary">{selectedTaskIds.length} selected</p>
                <button
                  type="button"
                  className="rounded-md border border-cyan/40 bg-cyan/10 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-cyan"
                  onClick={() => {
                    void onBulkArchiveTasks(selectedTaskIds);
                    setSelectedTaskIds([]);
                  }}
                >
                  Archive Selected
                </button>
                <button
                  type="button"
                  className="rounded-md border border-red-400/40 bg-red-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-red-200"
                  onClick={() => {
                    if (!window.confirm(`Delete ${selectedTaskIds.length} selected tasks?`)) {
                      return;
                    }
                    void onBulkDeleteTasks(selectedTaskIds);
                    setSelectedTaskIds([]);
                  }}
                >
                  Delete Selected
                </button>
                <button
                  type="button"
                  className="rounded-md border border-white/20 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-text-secondary"
                  onClick={() => setSelectedTaskIds([])}
                >
                  Clear
                </button>
              </>
            ) : null}
            {taskDeleteUndoCount > 0 ? (
              <>
                <div className="h-6 w-px bg-white/15" />
                <div className="flex items-center gap-2 rounded-lg border border-lobster/35 bg-black/35 px-2 py-1 text-xs text-text-secondary">
                  <span>{taskDeleteUndoCount} task{taskDeleteUndoCount === 1 ? "" : "s"} deleted</span>
                  <button type="button" className="text-lobster underline decoration-dotted" onClick={() => void onUndoTaskDelete()}>
                    Undo
                  </button>
                </div>
              </>
            ) : null}
          </section>
          {statuses.map((status) => (
            <section
              key={status}
              className="glass-panel min-h-0 overflow-y-auto border border-lobster/10 p-2"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const taskId = event.dataTransfer.getData("text/task-id");
                if (!taskId) {
                  return;
                }
                void onUpdateTaskStatus(taskId, status);
              }}
            >
              <h4 className="section-title">{status}</h4>
              <div className="space-y-2">
                {tasks
                  .filter((task) => task.status === status)
                  .map((task) => (
                    <PanelCard key={task.id} className="bg-panel/70">
                      <div
                        className="cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(event: DragEvent<HTMLDivElement>) => {
                          event.dataTransfer.setData("text/task-id", task.id);
                        }}
                      >
                        <label className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] text-text-secondary">
                          <input
                            type="checkbox"
                            checked={selectedTaskIds.includes(task.id)}
                            onChange={(event) => {
                              setSelectedTaskIds((current) => {
                                if (event.target.checked) {
                                  return current.includes(task.id) ? current : [...current, task.id];
                                }
                                return current.filter((id) => id !== task.id);
                              });
                            }}
                          />
                          Select
                        </label>
                        <p className="text-sm font-medium text-text-primary">{task.title}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <select
                            value={task.assigneeAgentId ?? ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (!value || value === task.assigneeAgentId) {
                                return;
                              }
                              void onUpdateTaskAssignee(task.id, value);
                            }}
                            className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/45 px-2 py-1 text-[11px] text-text-primary"
                          >
                            <option value="">Unassigned</option>
                            {agents.map((agent) => (
                              <option key={agent.id} value={agent.id}>
                                {agent.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="rounded-md border border-cyan/40 bg-cyan/10 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-cyan"
                            onClick={() => void onArchiveTask(task.id)}
                          >
                            Archive
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-red-400/40 bg-red-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-red-200"
                            onClick={() => {
                              if (!window.confirm(`Delete task "${task.title}"? This cannot be undone.`)) {
                                return;
                              }
                              void onDeleteTask(task);
                              setSelectedTaskIds((current) => current.filter((id) => id !== task.id));
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </PanelCard>
                  ))}
              </div>
            </section>
          ))}
          {tasks.length === 0 ? (
            <section className="glass-panel col-span-5 flex items-center justify-center border border-dashed border-lobster/35 p-6 text-center">
              <p className="text-sm text-text-secondary">No tasks yet. Ask the CSO to delegate a task from Chat to populate Kanban.</p>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === "warroom" ? (
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px] gap-4">
          <section className="glass-panel min-h-0 overflow-hidden border border-lobster/20 bg-panel/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-lobster">War Room</p>
                <p className="text-sm text-text-secondary">Always-on swarm command surface</p>
              </div>
              <div className="rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 text-xs text-cyan">
                Health: {gatewayHealth}
              </div>
            </div>
            <div className="mb-3 grid grid-cols-4 gap-2 text-xs">
              <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                <p className="text-text-secondary">Online Agents</p>
                <p className="text-lg font-semibold text-text-primary">{agents.filter((agent) => agent.status === "online" || agent.status === "busy").length}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                <p className="text-text-secondary">Active Tasks</p>
                <p className="text-lg font-semibold text-text-primary">{tasks.filter((item) => item.status !== "done").length}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                <p className="text-text-secondary">Spend Today</p>
                <p className="text-lg font-semibold text-text-primary">${warRoomSpendToday.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                <p className="text-text-secondary">Budget Alerts</p>
                <p className="text-lg font-semibold text-text-primary">{warRoomBudgetAlerts}</p>
              </div>
            </div>
            <div className="grid max-h-[calc(100%-140px)] grid-cols-2 gap-2 overflow-y-auto pr-1">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => onJumpToAgent(agent.id)}
                  className="rounded-xl border border-white/10 bg-black/30 p-3 text-left transition-all hover:border-lobster/40 hover:shadow-lobster-glow"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-text-primary">{agent.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${
                        agent.status === "online"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : agent.status === "busy"
                            ? "bg-cyan/15 text-cyan"
                            : agent.status === "error"
                              ? "bg-red-500/20 text-red-200"
                              : "bg-white/10 text-text-secondary"
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">{agent.role}</p>
                  <p className="mt-1 text-[11px] text-cyan">{agent.modelProvider ?? "provider"} · {agent.modelName ?? "model"}</p>
                  <p className="mt-1 text-[10px] text-text-secondary">Heartbeat: {agent.lastHeartbeat ? "live" : "pending"}</p>
                </button>
              ))}
            </div>
          </section>
          <aside className="glass-panel border border-cyan/20 bg-black/35 p-3">
            <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-cyan">Delegation Lanes</p>
            <div className="space-y-2 text-xs">
              {tasks
                .filter((task) => task.status !== "done")
                .slice(0, 10)
                .map((task) => (
                  <div key={task.id} className="rounded-lg border border-white/10 bg-black/30 p-2">
                    <p className="font-medium text-text-primary">{task.title}</p>
                    <p className="mt-1 text-text-secondary">{task.assigneeAgentId ?? "Unassigned"} · {task.status}</p>
                  </div>
                ))}
              {tasks.filter((task) => task.status !== "done").length === 0 ? (
                <p className="rounded-lg border border-dashed border-white/15 px-2 py-3 text-center text-text-secondary">
                  No active delegations.
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}

      {tab === "chat" ? (
        <ChatCommandPanel
          agents={agents}
          onJumpToAgent={onJumpToAgent}
          onInstallSuggestedSkill={onInstallSuggestedSkill}
          onOpenMarketplaceForSkill={onOpenMarketplaceForSkill}
        />
      ) : null}

      {tab === "logs" ? (
        <div className="glass-panel scanline-panel border border-cyan/20 p-3">
          <div className="mb-3 flex items-center justify-between">
            <label className="text-xs text-text-secondary">
              Filter{" "}
              <select
                value={logFilter}
                onChange={(event) => setLogFilter(event.target.value)}
                className="rounded border border-white/10 bg-black/50 px-2 py-1 text-xs"
              >
                <option value="all">all</option>
                <option value="task">task</option>
                <option value="usage">usage</option>
              </select>
            </label>
            <button className="lobster-button" type="button">
              Export
            </button>
          </div>
          <div className="space-y-2 font-mono text-xs">
            {auditTimeline
              .filter((entry) => {
                if (logFilter === "all") {
                  return true;
                }
                if (logFilter === "task") {
                  return entry.category === "task" || entry.action.includes("task");
                }
                if (logFilter === "usage") {
                  return entry.category === "usage" || entry.action.includes("usage") || entry.action.includes("budget");
                }
                return true;
              })
              .slice(0, 80)
              .map((entry) => (
                <div key={entry.id}>
                  <span className="text-cyan">{new Date(entry.createdAt).toLocaleTimeString()}</span>{" "}
                  {entry.category}.{entry.action}
                </div>
              ))}
            {auditTimeline.length === 0 ? <p className="text-xs text-text-secondary">No logs yet. Events appear here as your swarm runs.</p> : null}
          </div>
        </div>
      ) : null}

      {tab === "analytics" ? (
        <div className="grid min-h-0 flex-1 grid-cols-[1.3fr_1fr] gap-4">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="section-title">Actionable Analytics</p>
              <div className="flex items-center gap-2">
                <select
                  value={analyticsRange}
                  onChange={(event) => setAnalyticsRange(event.target.value as "7d" | "30d" | "90d")}
                  className="rounded border border-white/10 bg-black/50 px-2 py-1 text-xs"
                >
                  <option value="7d">7 days</option>
                  <option value="30d">30 days</option>
                  <option value="90d">90 days</option>
                </select>
                <button className="lobster-button" type="button" onClick={() => void onRefreshAnalytics()}>
                  Refresh
                </button>
                <button className="lobster-button" type="button" onClick={() => void onExportAnalytics("json")}>
                  JSON
                </button>
                <button className="lobster-button" type="button" onClick={() => void onExportAnalytics("csv")}>
                  CSV
                </button>
                <button className="lobster-button" type="button" onClick={onExportAnalyticsPdf}>
                  PDF
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <PanelCard title="Spend (period)">
                <p className="text-lg font-semibold text-text-primary">${(analyticsSnapshot?.kpis.spend.value ?? 0).toFixed(2)}</p>
                <p className={`text-xs ${(analyticsSnapshot?.kpis.spend.deltaPct ?? 0) >= 0 ? "text-lobster" : "text-cyan"}`}>
                  {(analyticsSnapshot?.kpis.spend.deltaPct ?? 0) >= 0 ? "▲" : "▼"}{" "}
                  {Math.abs(analyticsSnapshot?.kpis.spend.deltaPct ?? 0).toFixed(1)}%
                </p>
              </PanelCard>
              <PanelCard title="Vault Growth">
                <p className="text-lg font-semibold text-text-primary">{(analyticsSnapshot?.kpis.vaultGrowth.value ?? 0).toFixed(2)} GB</p>
                <p className={`text-xs ${(analyticsSnapshot?.kpis.vaultGrowth.deltaPct ?? 0) >= 0 ? "text-lobster" : "text-cyan"}`}>
                  {(analyticsSnapshot?.kpis.vaultGrowth.deltaPct ?? 0) >= 0 ? "▲" : "▼"}{" "}
                  {Math.abs(analyticsSnapshot?.kpis.vaultGrowth.deltaPct ?? 0).toFixed(1)}%
                </p>
              </PanelCard>
              <PanelCard title="Active Agent Activity">
                <p className="text-lg font-semibold text-text-primary">{(analyticsSnapshot?.kpis.activeAgents.value ?? 0).toFixed(0)}</p>
                <p className={`text-xs ${(analyticsSnapshot?.kpis.activeAgents.deltaPct ?? 0) >= 0 ? "text-lobster" : "text-cyan"}`}>
                  {(analyticsSnapshot?.kpis.activeAgents.deltaPct ?? 0) >= 0 ? "▲" : "▼"}{" "}
                  {Math.abs(analyticsSnapshot?.kpis.activeAgents.deltaPct ?? 0).toFixed(1)}%
                </p>
              </PanelCard>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <section className="glass-panel border border-cyan/20 bg-black/30 p-3">
                <p className="mb-1 text-xs uppercase tracking-[0.12em] text-cyan">Spend Trend</p>
                {renderSparkline(analyticsSnapshot?.trends.spend ?? [])}
              </section>
              <section className="glass-panel border border-lobster/20 bg-black/30 p-3">
                <p className="mb-1 text-xs uppercase tracking-[0.12em] text-lobster">Vault Usage Trend</p>
                {renderSparkline(analyticsSnapshot?.trends.vaultUsage ?? [])}
              </section>
              <section className="glass-panel border border-white/20 bg-black/30 p-3">
                <p className="mb-1 text-xs uppercase tracking-[0.12em] text-text-secondary">Agent Activity Trend</p>
                {renderSparkline(analyticsSnapshot?.trends.activeAgents ?? [])}
              </section>
            </div>

            <section className="glass-panel border border-white/15 bg-black/30 p-3">
              <p className="mb-2 text-xs uppercase tracking-[0.12em] text-cyan">Per-Agent Deltas</p>
              <div className="space-y-1">
                {(analyticsSnapshot?.perAgent ?? []).slice(0, 8).map((agent) => (
                  <div key={agent.agentId} className="grid grid-cols-[1.2fr_1fr_1fr_1fr] rounded-md border border-white/10 bg-black/35 px-2 py-1.5 text-xs">
                    <span className="text-text-primary">{agent.name}</span>
                    <span className={agent.tokensDeltaPct >= 0 ? "text-lobster" : "text-cyan"}>
                      tokens {agent.tokensDeltaPct >= 0 ? "+" : ""}
                      {agent.tokensDeltaPct.toFixed(1)}%
                    </span>
                    <span className={agent.spendDeltaPct >= 0 ? "text-lobster" : "text-cyan"}>
                      spend {agent.spendDeltaPct >= 0 ? "+" : ""}
                      {agent.spendDeltaPct.toFixed(1)}%
                    </span>
                    <span className="text-text-secondary">tasks +{agent.tasksCompletedDelta}</span>
                  </div>
                ))}
              </div>
            </section>
          </section>
          <section className="glass-panel border border-lobster/20 bg-black/30 p-3">
            <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-lobster">Budget Forecasting</p>
            <div className="space-y-2">
              {(analyticsSnapshot?.forecasts ?? []).slice(0, 6).map((item) => (
                <div key={item.agentId} className="rounded-lg border border-white/10 bg-black/35 p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-text-primary">{item.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        item.risk === "high"
                          ? "border border-red-300/40 bg-red-500/20 text-red-100"
                          : item.risk === "watch"
                            ? "border border-amber-300/40 bg-amber-400/20 text-amber-100"
                            : "border border-cyan/30 bg-cyan/10 text-cyan"
                      }`}
                    >
                      {item.risk}
                    </span>
                  </div>
                  <p className="mt-1 text-text-secondary">
                    ${item.currentCostUsd.toFixed(2)} / ${item.costLimitUsd.toFixed(2)} ({item.daysUntilLimit ?? "∞"} days to limit)
                  </p>
                  <p className="text-text-secondary">Projected 30d: ${item.projectedCost30dUsd.toFixed(2)}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 mb-2 text-[11px] uppercase tracking-[0.12em] text-cyan">Recommendations</p>
            <div className="space-y-1">
              {(analyticsSnapshot?.recommendations ?? []).map((line) => (
                <div key={line} className="rounded border border-amber-300/30 bg-amber-400/10 px-2 py-1 text-xs text-amber-100">
                  {line}
                </div>
              ))}
              {(analyticsSnapshot?.recommendations ?? []).length === 0 ? (
                <div className="rounded border border-cyan/25 bg-cyan/10 px-2 py-1 text-xs text-cyan">
                  No immediate action recommended.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "health" ? (
        <div className="grid min-h-0 flex-1 grid-cols-[1.3fr_1fr] gap-4">
          <section className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <PanelCard title="System Pulse">{healthSnapshot?.gatewayStatus ?? "unknown"}</PanelCard>
              <PanelCard title="Uptime">{healthSnapshot ? `${Math.floor(healthSnapshot.uptimeSeconds / 3600)}h` : "--"}</PanelCard>
              <PanelCard title="Active Agents">
                {healthSnapshot?.activeAgents ?? 0}/{healthSnapshot?.totalAgents ?? 0}
              </PanelCard>
              <PanelCard title="Vault Usage">{healthSnapshot ? `${healthSnapshot.vaultUsagePct}%` : "--"}</PanelCard>
            </div>
            <section className="glass-panel min-h-0 border border-lobster/20 bg-panel/70 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="section-title">Live Metrics</p>
                <div className="flex gap-2">
                  <span
                    className={`rounded-full border px-2 py-1 text-[11px] ${
                      healthStreamConnected
                        ? "border-cyan/40 bg-cyan/15 text-cyan"
                        : "border-amber-300/40 bg-amber-400/15 text-amber-100"
                    }`}
                  >
                    SSE {healthStreamConnected ? "connected" : "reconnecting"}
                  </span>
                  <button className="lobster-button" type="button" onClick={() => setTab("analytics")}>
                    View Trends
                  </button>
                  <button className="lobster-button" type="button" onClick={() => void onRefreshHealth()}>
                    Refresh
                  </button>
                  <button className="lobster-button" type="button" onClick={() => void onExportHealth("json")}>
                    Export JSON
                  </button>
                  <button className="lobster-button" type="button" onClick={() => void onExportHealth("csv")}>
                    Export CSV
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg border border-white/10 bg-black/35 p-2">
                  <p className="text-text-secondary">Spend Today</p>
                  <p className="text-lg font-semibold text-text-primary">${(healthSnapshot?.spendTodayUsd ?? 0).toFixed(2)}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/35 p-2">
                  <p className="text-text-secondary">Pending Approvals</p>
                  <p className="text-lg font-semibold text-text-primary">{healthSnapshot?.pendingApprovals ?? 0}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/35 p-2">
                  <p className="text-text-secondary">Error Agents</p>
                  <p className="text-lg font-semibold text-text-primary">{healthSnapshot?.errorAgents ?? 0}</p>
                </div>
              </div>
            </section>
            <section className="glass-panel min-h-0 flex-1 border border-cyan/20 bg-panel/70 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="section-title">Recent Events</p>
                <select
                  value={healthCategoryFilter}
                  onChange={(event) =>
                    setHealthCategoryFilter(
                      event.target.value as "all" | "lifecycle" | "gateway" | "agent" | "vault" | "error" | "system"
                    )
                  }
                  className="rounded border border-white/10 bg-black/50 px-2 py-1 text-xs"
                >
                  <option value="all">all</option>
                  <option value="lifecycle">lifecycle</option>
                  <option value="gateway">gateway</option>
                  <option value="agent">agent</option>
                  <option value="vault">vault</option>
                  <option value="error">error</option>
                  <option value="system">system</option>
                </select>
              </div>
              <div className="health-timeline max-h-[360px] space-y-1 overflow-y-auto font-mono text-xs">
                {healthEvents.map((item) => (
                  <div key={item.id} className="rounded-md border border-white/10 bg-black/35 px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-cyan">{new Date(item.createdAt).toLocaleTimeString()}</span>
                      <span className="text-text-secondary">{item.category}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                          item.severity === "critical"
                            ? "border border-red-300/40 bg-red-500/20 text-red-100"
                            : item.severity === "warning"
                              ? "border border-amber-300/40 bg-amber-400/20 text-amber-100"
                              : "border border-cyan/30 bg-cyan/10 text-cyan"
                        }`}
                      >
                        {item.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-text-primary">{item.message}</p>
                    <p className="truncate text-[10px] text-text-secondary">{item.source}</p>
                  </div>
                ))}
                {healthEvents.length === 0 ? <p className="text-text-secondary">No telemetry events yet.</p> : null}
              </div>
            </section>
          </section>
          <section className="glass-panel border border-lobster/20 bg-black/30 p-3">
            <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-lobster">Alerts & Recommendations</p>
            <div className="space-y-2">
              {(healthSnapshot?.alerts ?? []).map((alert) => (
                <div key={alert} className="rounded-lg border border-amber-300/35 bg-amber-400/15 px-3 py-2 text-xs text-amber-100">
                  {alert}
                </div>
              ))}
              {(healthSnapshot?.alerts ?? []).length === 0 ? (
                <div className="rounded-lg border border-cyan/20 bg-cyan/10 px-3 py-2 text-xs text-cyan">
                  No active alerts. System health looks stable.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "integrations" ? (
        <IntegrationsPanel
          agents={agents}
          query={integrationsQuery}
          setQuery={setIntegrationsQuery}
          category={integrationsCategory}
          setCategory={setIntegrationsCategory}
          categories={integrationCategories}
          items={integrations}
          selected={selectedIntegration}
          onSelect={onSelectIntegration}
          selectedTargetAgentId={selectedIntegrationTargetAgentId}
          setSelectedTargetAgentId={setSelectedIntegrationTargetAgentId}
          busy={integrationBusy}
          onConnect={onConnectIntegration}
          mcpServers={mcpServers}
          mcpTools={mcpTools}
          selectedMcpServerId={selectedMcpServerId}
          setSelectedMcpServerId={setSelectedMcpServerId}
          onRegisterMcpServer={onRegisterMcpServer}
          onRequestMcpConnect={onRequestMcpConnect}
          onDisconnectMcpServer={onDisconnectMcpServer}
          onRequestMcpInvoke={onRequestMcpInvoke}
        />
      ) : null}

      {tab === "marketplace" ? (
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_340px] gap-4">
          <section className="glass-panel min-h-0 overflow-y-auto border border-lobster/20 p-3">
            <div className="mb-3 flex items-center gap-2">
              <input
                value={marketplaceQuery}
                onChange={(event) => setMarketplaceQuery(event.target.value)}
                placeholder="Search ClawHub skills..."
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-text-primary outline-none focus:border-lobster/70"
              />
              <select
                value={marketplaceSort}
                onChange={(event) => setMarketplaceSort(event.target.value as ClawHubSort)}
                className="rounded-lg border border-white/10 bg-black/50 px-2 py-2 text-xs text-text-secondary"
              >
                <option value="downloads">Trending</option>
                <option value="newest">Newest</option>
              </select>
              <button className="lobster-button whitespace-nowrap" type="button" onClick={() => void onRefreshMarketplace()}>
                Refresh from ClawHub
              </button>
            </div>
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={onToggleMarketplaceNonSuspicious}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  marketplaceNonSuspicious
                    ? "border-lobster/50 bg-lobster/20 text-lobster"
                    : "border-white/20 bg-black/40 text-text-secondary"
                }`}
              >
                {marketplaceNonSuspicious ? "Non-suspicious only: On" : "Non-suspicious only: Off"}
              </button>
              {marketplaceSource === "cache" ? (
                <span className="rounded-full border border-amber-300/40 bg-amber-400/15 px-2.5 py-1 text-[11px] text-amber-100">
                  Offline cached
                </span>
              ) : (
                <span className="rounded-full border border-cyan/30 bg-cyan/10 px-2.5 py-1 text-[11px] text-cyan">Live API</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {marketplaceSkills.map((skill) => (
                <button
                  key={skill.slug}
                  type="button"
                  onClick={() => onSelectMarketplaceSkill(skill)}
                  className={`glass-panel border p-3 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lobster-glow ${
                    selectedMarketplaceSkill?.slug === skill.slug ? "border-lobster shadow-lobster-glow-strong" : "border-white/10"
                  }`}
                >
                  <p className="text-sm font-semibold text-text-primary">{skill.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{skill.description}</p>
                  <p className="mt-2 text-[11px] text-cyan">{skill.downloads.toLocaleString()} downloads</p>
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-center">
              <button
                className="lobster-button"
                type="button"
                onClick={() => void onLoadMoreMarketplace()}
                disabled={!marketplaceHasMore || marketplaceBusy || marketplaceSource === "cache"}
              >
                {marketplaceBusy ? "Loading..." : marketplaceHasMore ? "Load More" : "No More Results"}
              </button>
            </div>
          </section>

          <section className="glass-panel border border-lobster/25 p-3">
            <h4 className="section-title">Skill Details</h4>
            {selectedMarketplaceSkill ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{selectedMarketplaceSkill.name}</p>
                  <p className="text-xs text-text-secondary">
                    by {selectedMarketplaceSkill.author} · v{selectedMarketplaceSkill.version}
                  </p>
                </div>
                <p className="text-xs text-text-secondary">{selectedMarketplaceSkill.description}</p>
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-lobster">Permissions</p>
                  <div className="space-y-1">
                    {selectedMarketplaceSkill.permissions.map((permission) => (
                      <div key={permission} className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-text-secondary">
                        {permission}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-lobster">Assign To</p>
                  <div className="flex gap-1 text-xs text-text-secondary">
                    <span className="rounded-full border border-white/10 px-2 py-1">CSO</span>
                    <span className="rounded-full border border-white/10 px-2 py-1">Research</span>
                    <span className="rounded-full border border-white/10 px-2 py-1">Data</span>
                  </div>
                </div>
                <button
                  className="lobster-button-filled w-full"
                  type="button"
                  onClick={() => void onInstallSkill(selectedMarketplaceSkill.slug, "agent_cso")}
                  disabled={marketplaceBusy}
                >
                  {marketplaceBusy ? "Installing..." : "Install for CSO"}
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-lobster/35 p-5 text-center">
                <p className="text-xl">🦞</p>
                <p className="mt-2 text-sm text-text-secondary">Pick a skill to preview permissions and install.</p>
              </div>
            )}
          </section>
        </div>
      ) : null}
      {vaultBrowserOpen ? (
        <div className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm" onClick={onVaultBrowserClose}>
          <div
            className="absolute right-0 top-0 h-full w-[78vw] min-w-[860px] max-w-[1200px] border-l border-lobster/35 bg-[#0c0c0e] p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-lobster">Vault Browser</p>
                <p className="text-sm text-text-secondary">Archive · File Library · Knowledge Base</p>
              </div>
              <button className="lobster-button" type="button" onClick={onVaultBrowserClose}>
                Close
              </button>
            </div>
            <div className="mb-3 flex gap-2">
              {([
                ["archive", "Archive"],
                ["file", "File Library"],
                ["kb", "Knowledge Base"]
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setVaultTab(key)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    vaultTab === key ? "border-lobster/60 bg-lobster/20 text-lobster" : "border-white/15 bg-black/40 text-text-secondary"
                  }`}
                >
                  {label}
                </button>
              ))}
              <div className="ml-auto rounded-full border border-cyan/20 bg-cyan/10 px-3 py-1 text-[10px] uppercase tracking-[0.1em] text-cyan">
                Cmd/Ctrl+S save - Cmd/Ctrl+Shift+V new version
              </div>
            </div>
            {vaultStorage?.isOfflineFallback ? (
              <div className="mb-3 rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs text-red-100">
                External Vault offline. Running on temporary cache: {vaultStorage.tempCachePath ?? "cache unavailable"}
              </div>
            ) : null}
            <div className="mb-3 rounded-xl border border-white/10 bg-black/25 p-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.12em] text-lobster">Storage Control</p>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${warningClass}`}>
                  {vaultStorage?.warningLevel ?? "normal"}
                </span>
              </div>
              <p className="mb-2 text-[11px] text-text-secondary">
                {vaultStorage
                  ? `${vaultStorage.volumeName} · ${vaultStorage.vaultUsedGb.toFixed(2)} GB used of ${vaultStorage.totalGb.toFixed(2)} GB`
                  : "Reading volume telemetry..."}
              </p>
              <div className="flex gap-2">
                <input
                  value={vaultLocationDraft}
                  onChange={(event) => setVaultLocationDraft(event.target.value)}
                  placeholder="Vault storage path..."
                  className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-text-primary outline-none focus:border-lobster/60"
                />
                <button className="lobster-button whitespace-nowrap" type="button" onClick={() => void handleRelocateStorage()}>
                  Relocate
                </button>
              </div>
              <label className="mt-2 flex items-center gap-2 text-[11px] text-text-secondary">
                <input type="checkbox" checked={vaultMoveExisting} onChange={(event) => setVaultMoveExisting(event.target.checked)} />
                Move existing data
              </label>
            </div>
            <div className="mb-3 grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-2">
              <input
                value={vaultSearchQuery}
                onChange={(event) => onVaultSearch(event.target.value)}
                placeholder="Search Vault..."
                className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-text-primary outline-none focus:border-lobster/60"
              />
              <button className="lobster-button" type="button" onClick={() => void onVaultSmartDeposit(vaultTab)}>
                Smart Deposit
              </button>
              {vaultTab === "file" ? (
                <label className="lobster-button cursor-pointer">
                  Upload File
                  <input type="file" className="hidden" onChange={(event) => event.target.files?.[0] && handleFileIngest(event.target.files[0]!)} />
                </label>
              ) : (
                <button
                  className="lobster-button"
                  type="button"
                  onClick={() =>
                    void onVaultCreateEntry({
                      type: "kb",
                      title: newKbTitle.trim() || "New Knowledge Entry",
                      markdownSummary: newKbSummary.trim(),
                      importanceScore: newKbImportance,
                      tags: parseTags(newKbTags)
                    })
                  }
                  disabled={!newKbTitle.trim() || !newKbSummary.trim()}
                >
                  Add KB Entry
                </button>
              )}
            </div>
            {vaultTab === "file" ? (
              <div
                className={`mb-3 rounded-xl border border-dashed p-3 text-center text-xs transition-all ${
                  fileDropActive ? "border-lobster/70 bg-lobster/15 text-lobster shadow-lobster-glow" : "border-white/20 bg-black/25 text-text-secondary"
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setFileDropActive(true);
                }}
                onDragLeave={() => setFileDropActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setFileDropActive(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file) {
                    handleFileIngest(file);
                  }
                }}
              >
                Drop files here to deposit into Vault File Library
              </div>
            ) : null}
            {vaultTab === "kb" ? (
              <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-cyan/20 bg-black/25 p-2 text-xs">
                <input
                  value={newKbTitle}
                  onChange={(event) => setNewKbTitle(event.target.value)}
                  placeholder="Knowledge title"
                  className="rounded border border-white/10 bg-black/40 px-2 py-1.5 text-text-primary outline-none focus:border-cyan/50"
                />
                <input
                  value={newKbTags}
                  onChange={(event) => setNewKbTags(event.target.value)}
                  placeholder="tags (comma separated)"
                  className="rounded border border-white/10 bg-black/40 px-2 py-1.5 text-text-primary outline-none focus:border-cyan/50"
                />
                <textarea
                  value={newKbSummary}
                  onChange={(event) => setNewKbSummary(event.target.value)}
                  placeholder="Procedure, context, recall notes..."
                  rows={3}
                  className="col-span-2 rounded border border-white/10 bg-black/40 px-2 py-1.5 text-text-primary outline-none focus:border-cyan/50"
                />
                <label className="col-span-2 flex items-center gap-2 text-text-secondary">
                  Importance
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={newKbImportance}
                    onChange={(event) => setNewKbImportance(Number(event.target.value))}
                    className="w-full accent-lobster"
                  />
                  <span className="text-cyan">{newKbImportance}</span>
                </label>
              </div>
            ) : null}
            <div className="grid h-[calc(100%-88px)] grid-cols-[260px_1fr_320px] gap-3">
              <aside className="rounded-xl border border-white/10 bg-black/35 p-2">
                <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-cyan">Navigator</p>
                <div className="space-y-1">
                  {filteredVaultForTab.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => handleSelectVault(entry)}
                      className={`w-full rounded-lg border px-2 py-1.5 text-left text-xs ${
                        selectedVault?.id === entry.id ? "border-lobster/50 bg-lobster/10 text-text-primary" : "border-white/10 bg-black/25 text-text-secondary"
                      }`}
                    >
                      <p className="truncate">{entry.title}</p>
                      <p className="mt-0.5 text-[10px]">I{entry.importanceScore}</p>
                    </button>
                  ))}
                </div>
              </aside>
              <section className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-cyan">Items</p>
                <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {filteredVaultForTab.map((entry) => (
                    <button
                      key={`${entry.id}_card`}
                      type="button"
                      onClick={() => handleSelectVault(entry)}
                      className="rounded-xl border border-white/10 bg-black/30 p-3 text-left transition-colors hover:border-lobster/35"
                    >
                      <p className="text-sm font-medium text-text-primary">{entry.title}</p>
                      <p className="mt-1 line-clamp-3 text-xs text-text-secondary">{entry.markdownSummary}</p>
                      <p className="mt-2 text-[10px] text-cyan">{entry.tags.join(", ") || "untagged"}</p>
                    </button>
                  ))}
                </div>
              </section>
              <aside className="rounded-xl border border-lobster/20 bg-black/35 p-3">
                <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-lobster">Preview</p>
                {selectedVault ? (
                  <div className="space-y-2 text-xs">
                    <input
                      value={vaultTitleDraft}
                      onChange={(event) => setVaultTitleDraft(event.target.value)}
                      className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-sm font-semibold text-text-primary outline-none focus:border-lobster/50"
                    />
                    <textarea
                      value={vaultSummaryDraft}
                      onChange={(event) => setVaultSummaryDraft(event.target.value)}
                      rows={5}
                      className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-text-secondary outline-none focus:border-lobster/50"
                    />
                    <input
                      value={vaultTagsDraft}
                      onChange={(event) => setVaultTagsDraft(event.target.value)}
                      className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-text-secondary outline-none focus:border-lobster/50"
                    />
                    <label className="flex items-center gap-2 text-text-secondary">
                      Importance
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={vaultImportanceDraft}
                        onChange={(event) => setVaultImportanceDraft(Number(event.target.value))}
                        className="w-full accent-lobster"
                      />
                      <span className="text-cyan">{vaultImportanceDraft}</span>
                    </label>
                    <label className="flex items-center gap-2 text-text-secondary">
                      <input type="checkbox" checked={vaultEncryptedDraft} onChange={(event) => setVaultEncryptedDraft(event.target.checked)} />
                      Encrypted private sub-vault
                    </label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="lobster-button w-full"
                        onClick={() => void handleSaveMetadata()}
                      >
                        Save Metadata
                      </button>
                      <button
                        type="button"
                        className="lobster-button w-full"
                        onClick={() => void handleCreateVersion()}
                      >
                        New Version
                      </button>
                    </div>
                    <input
                      value={versionNote}
                      onChange={(event) => setVersionNote(event.target.value)}
                      placeholder="version note (diff label)"
                      className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-text-secondary outline-none focus:border-cyan/50"
                    />
                    <div className="rounded-lg border border-white/10 bg-black/30 p-2">{renderVaultPreview()}</div>
                    <p className="text-cyan">{selectedVault.blobPath ?? (uploadPreviewName || "No artifact path")}</p>
                    <div className="rounded-lg border border-cyan/20 bg-cyan/10 p-2">
                      <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-cyan">Version History</p>
                      <div className="max-h-24 space-y-1 overflow-y-auto">
                        {selectedVersions.map((version) => (
                          <div key={`${version.entryId}_${version.versionNum}`} className="rounded border border-white/10 bg-black/30 px-2 py-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-[10px] text-text-primary">v{version.versionNum}</p>
                              <button
                                type="button"
                                className="rounded border border-cyan/30 bg-cyan/10 px-1.5 py-0.5 text-[10px] text-cyan"
                                onClick={() => void handleRestoreVersion(version)}
                              >
                                Restore
                              </button>
                            </div>
                            <p className="truncate text-[10px] text-text-secondary">{version.diff ?? "revision"}</p>
                          </div>
                        ))}
                        {selectedVersions.length === 0 ? <p className="text-[10px] text-text-secondary">No versions yet.</p> : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary">Select a vault entry to preview.</p>
                )}
              </aside>
            </div>
          </div>
          {vaultToast ? (
            <div className="pointer-events-none absolute bottom-4 right-6 rounded-full border border-lobster/40 bg-black/80 px-3 py-1 text-xs text-text-primary shadow-lobster-glow">
              {vaultToast}
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
