import type { AgentProfile } from "@majorclaw/shared-types";
import { useEffect, useState } from "react";
import type {
  AgentConfigPatch,
  ConnectedModelProvider,
  AgentConnectionTestResult,
  AgentFullConfig,
  AgentBudget,
  CheckpointRecord,
  AuditLogEntry,
  ClawHubSkill,
  PermissionGrant,
  GatewayDaemonStatus
} from "../tauriGateway.js";
import { PanelCard } from "./ui/PanelCard.js";

type RightPanelProps = {
  selectedAgent: AgentProfile | null;
  selectedAgentConfig: AgentFullConfig | null;
  pendingApprovals: PermissionGrant[];
  auditTimeline: AuditLogEntry[];
  installedSkills: ClawHubSkill[];
  onToggleSkill: (slug: string, enabled: boolean) => void;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  onUpdateAgentConfig: (patch: AgentConfigPatch) => Promise<void>;
  onTestAgentConnection: (apiKey?: string) => Promise<AgentConnectionTestResult | null>;
  modelProviderOptions: ConnectedModelProvider[];
  budgetSnapshot: { global: AgentBudget; agents: AgentBudget[] } | null;
  onUpdateAgentBudget: (input: { tokenLimit: number; costLimitUsd: number; hardKill: boolean }) => Promise<void>;
  checkpoints: CheckpointRecord[];
  onRewindCheckpoint: (checkpointId: string, editPrompt?: string) => Promise<void>;
  daemonStatus: GatewayDaemonStatus | null;
  daemonBusy: boolean;
  onToggleDaemon: (enabled: boolean) => Promise<void>;
  onDaemonStart: () => Promise<void>;
  onDaemonStop: () => Promise<void>;
  onDaemonRestart: () => Promise<void>;
  onDaemonLogs: () => Promise<void>;
};

export function RightPanel({
  selectedAgent,
  selectedAgentConfig,
  pendingApprovals,
  auditTimeline,
  installedSkills,
  onToggleSkill,
  onApprove,
  onDeny,
  onUpdateAgentConfig,
  onTestAgentConnection,
  modelProviderOptions,
  budgetSnapshot,
  onUpdateAgentBudget,
  checkpoints,
  onRewindCheckpoint,
  daemonStatus,
  daemonBusy,
  onToggleDaemon,
  onDaemonStart,
  onDaemonStop,
  onDaemonRestart,
  onDaemonLogs
}: RightPanelProps) {
  const selectedAgentId = selectedAgent?.id ?? null;
  const [tab, setTab] = useState<"overview" | "model" | "skills" | "limits" | "activity">("overview");
  const [modelProvider, setModelProvider] = useState(selectedAgentConfig?.modelProvider ?? "anthropic");
  const [modelName, setModelName] = useState(selectedAgentConfig?.modelName ?? "claude-3-5-sonnet");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(String(selectedAgentConfig?.temperature ?? 0.7));
  const [maxTokens, setMaxTokens] = useState(String(selectedAgentConfig?.maxTokens ?? 8192));
  const [connectionTest, setConnectionTest] = useState<AgentConnectionTestResult | null>(null);
  const [tokenLimit, setTokenLimit] = useState("100000");
  const [costLimit, setCostLimit] = useState("40");
  const [hardKill, setHardKill] = useState(false);
  const [rewindPrompt, setRewindPrompt] = useState("");

  useEffect(() => {
    setModelProvider(selectedAgentConfig?.modelProvider ?? "anthropic");
    setModelName(selectedAgentConfig?.modelName ?? "claude-3-5-sonnet");
    setTemperature(String(selectedAgentConfig?.temperature ?? 0.7));
    setMaxTokens(String(selectedAgentConfig?.maxTokens ?? 8192));
    setApiKey("");
    setConnectionTest(null);
  }, [selectedAgentConfig]);

  useEffect(() => {
    const currentBudget = selectedAgentId ? budgetSnapshot?.agents.find((item) => item.agentId === selectedAgentId) : null;
    if (!currentBudget) {
      setTokenLimit("100000");
      setCostLimit("40");
      setHardKill(false);
      return;
    }
    setTokenLimit(String(currentBudget.tokenLimit));
    setCostLimit(String(currentBudget.costLimitUsd));
    setHardKill(currentBudget.hardKill);
  }, [budgetSnapshot, selectedAgentId]);

  return (
    <aside className="h-full w-[320px] space-y-3 border-l border-lobster/20 p-4">
      <PanelCard title="Agent Context">
        {!selectedAgent ? (
          <div className="rounded-xl border border-dashed border-lobster/35 p-5 text-center">
            <p className="text-xl">🦞</p>
            <p className="mt-2 text-sm text-text-secondary">No agents available yet. Create your first AI employee to configure this panel.</p>
          </div>
        ) : null}
        {selectedAgent ? (
          <>
        <div className="mb-2 flex flex-wrap gap-1">
          {[
            ["overview", "Overview"],
            ["model", "Model & Provider"],
            ["skills", "Skills"],
            ["limits", "Limits"],
            ["activity", "Activity"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value as "overview" | "model" | "skills" | "limits" | "activity")}
              className={`rounded-full border px-2 py-1 text-[10px] ${
                tab === value ? "border-lobster/60 bg-lobster/20 text-lobster" : "border-white/15 text-text-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "overview" ? (
          <div>
            <p className="text-sm font-medium text-text-primary">{selectedAgent.name}</p>
            <p className="text-xs text-text-secondary">Role: {selectedAgent.role}</p>
            <p className="mt-1 text-xs text-text-secondary">
              Tokens today: {selectedAgentConfig?.stats.tokensToday.toLocaleString() ?? 0}
            </p>
            <p className="text-xs text-text-secondary">Tasks completed: {selectedAgentConfig?.stats.tasksCompleted ?? 0}</p>
          </div>
        ) : null}
        {tab === "model" ? (
          <div className="space-y-2">
            <label className="text-[11px] text-text-secondary">
              Provider
              <select
                value={modelProvider}
                onChange={(event) => setModelProvider(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs"
              >
                {Array.from(
                  new Set(["anthropic", "openai", "google", "xai", "local", ...modelProviderOptions.map((item) => item.provider)])
                ).map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] text-text-secondary">
              Model
              <input
                value={modelName}
                onChange={(event) => setModelName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs"
              />
            </label>
            <label className="text-[11px] text-text-secondary">
              API Key
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={selectedAgentConfig?.apiKeyMasked || "not set"}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs"
              />
            </label>
            <button
              type="button"
              className="lobster-button-filled w-full"
              onClick={() => {
                const patch: AgentConfigPatch = {
                  modelProvider,
                  modelName
                };
                if (apiKey.trim()) {
                  patch.apiKey = apiKey.trim();
                }
                void onUpdateAgentConfig(patch);
              }}
            >
              Save Model Config
            </button>
            <button
              type="button"
              className="lobster-button w-full"
              onClick={async () => {
                const result = await onTestAgentConnection(apiKey.trim() || undefined);
                setConnectionTest(result);
              }}
            >
              Test Connection
            </button>
            {connectionTest ? (
              <p className={`text-xs ${connectionTest.ok ? "text-cyan" : "text-lobster"}`}>{connectionTest.message}</p>
            ) : null}
          </div>
        ) : null}
        {tab === "skills" ? (
          <div className="space-y-1">
            {(selectedAgentConfig?.installedSkills ?? []).slice(0, 8).map((skill) => (
              <div key={skill} className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-text-secondary">
                {skill}
              </div>
            ))}
            {(selectedAgentConfig?.installedSkills ?? []).length === 0 ? (
              <p className="text-xs text-text-secondary">No skills installed for this agent.</p>
            ) : null}
          </div>
        ) : null}
        {tab === "limits" ? (
          <div className="space-y-2">
            <label className="text-[11px] text-text-secondary">
              Temperature
              <input
                value={temperature}
                onChange={(event) => setTemperature(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs"
              />
            </label>
            <label className="text-[11px] text-text-secondary">
              Max Tokens
              <input
                value={maxTokens}
                onChange={(event) => setMaxTokens(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs"
              />
            </label>
            <button
              type="button"
              className="lobster-button-filled w-full"
              onClick={() =>
                void onUpdateAgentConfig({
                  temperature: Number(temperature),
                  maxTokens: Number(maxTokens)
                })
              }
            >
              Save Limits
            </button>
            <div className="rounded-xl border border-lobster/20 bg-black/25 p-2">
              <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-lobster">Fuel Budget</p>
              <label className="text-[11px] text-text-secondary">
                Token Limit
                <input
                  value={tokenLimit}
                  onChange={(event) => setTokenLimit(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs"
                />
              </label>
              <label className="mt-2 block text-[11px] text-text-secondary">
                Cost Limit (USD)
                <input
                  value={costLimit}
                  onChange={(event) => setCostLimit(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs"
                />
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={hardKill}
                  onChange={(event) => setHardKill(event.target.checked)}
                />
                Hard kill switch on limit exceed
              </label>
              {(() => {
                const budget = budgetSnapshot?.agents.find((item) => item.agentId === selectedAgent.id);
                if (!budget) {
                  return null;
                }
                const tokenPct = Math.min(100, Math.round((budget.currentTokens / Math.max(1, budget.tokenLimit)) * 100));
                const costPct = Math.min(100, Math.round((budget.currentCostUsd / Math.max(0.01, budget.costLimitUsd)) * 100));
                return (
                  <div className="mt-2 space-y-2">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[11px] text-text-secondary">
                        <span>Tokens</span>
                        <span>{budget.currentTokens.toLocaleString()} / {budget.tokenLimit.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className={`h-full ${tokenPct >= 90 ? "bg-lobster" : "bg-cyan"}`} style={{ width: `${tokenPct}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[11px] text-text-secondary">
                        <span>Cost</span>
                        <span>${budget.currentCostUsd.toFixed(2)} / ${budget.costLimitUsd.toFixed(2)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className={`h-full ${costPct >= 90 ? "bg-lobster" : "bg-cyan"}`} style={{ width: `${costPct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })()}
              <button
                type="button"
                className="lobster-button mt-2 w-full"
                onClick={() =>
                  void onUpdateAgentBudget({
                    tokenLimit: Number(tokenLimit),
                    costLimitUsd: Number(costLimit),
                    hardKill
                  })
                }
              >
                Save Budget Policy
              </button>
            </div>
          </div>
        ) : null}
        {tab === "activity" ? (
          <div className="space-y-1 text-xs text-text-secondary">
            <p>Status: {selectedAgent.status}</p>
            <p>Last heartbeat: {selectedAgentConfig?.lastHeartbeat ? new Date(selectedAgentConfig.lastHeartbeat).toLocaleTimeString() : "n/a"}</p>
            <div className="mt-2 rounded-xl border border-lobster/20 bg-black/25 p-2">
              <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-lobster">Always-On Service</p>
              <p className="text-[11px] text-text-secondary">
                {daemonStatus?.message ?? "Checking daemon status..."}
              </p>
              {daemonStatus?.servicePath ? (
                <p className="mt-1 truncate text-[10px] text-text-secondary/80">{daemonStatus.servicePath}</p>
              ) : null}
              <div className="mt-2 flex items-center justify-between">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    daemonStatus?.enabled ? "border border-cyan/40 bg-cyan/15 text-cyan" : "border border-white/20 text-text-secondary"
                  }`}
                >
                  {daemonStatus?.enabled ? "Enabled" : "Disabled"}
                </span>
                <button
                  type="button"
                  className="lobster-button"
                  disabled={daemonBusy || !daemonStatus?.supported}
                  onClick={() => void onToggleDaemon(!(daemonStatus?.enabled ?? false))}
                >
                  {daemonBusy ? "Updating..." : daemonStatus?.enabled ? "Disable" : "Enable"}
                </button>
              </div>
              {daemonStatus?.supported ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] ${
                      daemonStatus.running ? "border-cyan/40 bg-cyan/15 text-cyan" : "border-white/20 text-text-secondary"
                    }`}
                  >
                    {daemonStatus.running ? "Running" : "Stopped"}
                  </span>
                  <button type="button" className="lobster-button" disabled={daemonBusy} onClick={() => void onDaemonStart()}>
                    Start
                  </button>
                  <button type="button" className="lobster-button" disabled={daemonBusy} onClick={() => void onDaemonStop()}>
                    Stop
                  </button>
                  <button type="button" className="lobster-button" disabled={daemonBusy} onClick={() => void onDaemonRestart()}>
                    Restart
                  </button>
                  <button type="button" className="lobster-button" disabled={daemonBusy} onClick={() => void onDaemonLogs()}>
                    Logs
                  </button>
                </div>
              ) : null}
              {daemonStatus?.lastError ? <p className="mt-1 text-[10px] text-lobster">{daemonStatus.lastError}</p> : null}
              {daemonStatus?.logHint ? <p className="mt-1 text-[10px] text-text-secondary/80">Hint: {daemonStatus.logHint}</p> : null}
            </div>
            <div className="mt-2 rounded-xl border border-lobster/20 bg-black/25 p-2">
              <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-lobster">Timeline (Checkpoints)</p>
              <input
                value={rewindPrompt}
                onChange={(event) => setRewindPrompt(event.target.value)}
                placeholder="Optional replay edit prompt..."
                className="mb-2 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[11px]"
              />
              <div className="max-h-44 space-y-1 overflow-y-auto">
                {checkpoints.slice(0, 8).map((checkpoint) => (
                  <div key={checkpoint.id} className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-text-primary">Step {checkpoint.step}</span>
                      <button
                        type="button"
                        className="rounded-md border border-lobster/40 px-1.5 py-0.5 text-[10px] text-lobster hover:bg-lobster/10"
                        onClick={() => void onRewindCheckpoint(checkpoint.id, rewindPrompt.trim() || undefined)}
                      >
                        Rewind
                      </button>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[10px] text-text-secondary">
                      {checkpoint.promptSnapshot ?? "No prompt snapshot"}
                    </p>
                  </div>
                ))}
                {checkpoints.length === 0 ? <p className="text-[11px] text-text-secondary">No checkpoints yet.</p> : null}
              </div>
            </div>
          </div>
        ) : null}
          </>
        ) : null}
      </PanelCard>

      <PanelCard title="Live Logs">
        <div className="scanline-panel space-y-1 rounded-xl border border-cyan/15 p-2 font-mono text-xs">
          {auditTimeline.slice(0, 6).map((entry) => (
            <div key={entry.id}>
              <span className="text-cyan">{new Date(entry.createdAt).toLocaleTimeString()}</span> {entry.category}.{entry.action}
            </div>
          ))}
          {auditTimeline.length === 0 ? <p className="text-xs text-text-secondary">No live events yet.</p> : null}
        </div>
      </PanelCard>

      <PanelCard title="Permissions">
        <div className="space-y-1 text-xs text-text-secondary">
          <p>Pending grants: {pendingApprovals.length}</p>
          <p>Approved (visible): {auditTimeline.filter((entry) => entry.category === "permission" && entry.action.includes("approve")).length}</p>
          <p>Denied (visible): {auditTimeline.filter((entry) => entry.category === "permission" && entry.action.includes("deny")).length}</p>
        </div>
      </PanelCard>

      <PanelCard title="Installed Skills">
        {installedSkills.length === 0 ? (
          <p className="text-xs text-text-secondary">No skills installed yet. Install one from Marketplace to start agent automation.</p>
        ) : (
          <div className="space-y-1">
            {installedSkills.slice(0, 5).map((skill) => (
              <div key={skill.slug} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-text-secondary">
                <span>{skill.name}</span>
                <button
                  type="button"
                  className={`rounded-full px-2 py-0.5 text-[10px] ${skill.installed ? "bg-lobster/20 text-lobster" : "bg-white/10 text-text-secondary"}`}
                  onClick={() => onToggleSkill(skill.slug, !skill.installed)}
                >
                  {skill.installed ? "On" : "Off"}
                </button>
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      <PanelCard title="Pending Approvals">
        {pendingApprovals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-lobster/40 p-5 text-center">
            <p className="text-xl">🦞</p>
            <p className="mt-2 text-sm text-text-secondary">EXFOLIATE your swarm!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingApprovals.map((approval) => (
              <div key={approval.id} className="rounded-xl border border-lobster/30 bg-black/30 p-2.5 shadow-lobster-glow">
                <p className="text-xs text-text-primary">
                  {approval.agentId} requests <span className="text-lobster">{approval.capability}</span>
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button className="lobster-button-filled w-full" onClick={() => onApprove(approval.id)} type="button">
                    Approve
                  </button>
                  <button className="lobster-button w-full" onClick={() => onDeny(approval.id)} type="button">
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      <PanelCard title="Audit Timeline">
        <div className="space-y-1 font-mono text-[11px]">
          {auditTimeline.slice(0, 8).map((entry) => (
            (() => {
              const isRedPhone = entry.category === "system" && entry.action === "red_phone_shutdown";
              const reason = typeof entry.metadata?.reason === "string" ? entry.metadata.reason : "";
              return (
                <div
                  key={entry.id}
                  className={`rounded-md border px-2 py-1 ${
                    isRedPhone
                      ? "border-red-400/45 bg-red-500/10 shadow-[0_0_16px_rgba(239,68,68,0.25)]"
                      : "border-white/10 bg-black/40"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={isRedPhone ? "text-red-200" : "text-cyan"}>{new Date(entry.createdAt).toLocaleTimeString()}</span>
                    <span className="text-text-secondary">{entry.category}</span>
                    <span className={isRedPhone ? "text-red-200" : "text-lobster"}>{entry.action}</span>
                    {isRedPhone ? (
                      <span className="ml-auto rounded-full border border-red-300/40 bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-red-100">
                        Red Phone Activated
                      </span>
                    ) : null}
                  </div>
                  {isRedPhone && reason ? <p className="mt-1 line-clamp-2 text-[10px] text-red-100/90">Reason: {reason}</p> : null}
                </div>
              );
            })()
          ))}
          {auditTimeline.length === 0 ? <p className="text-text-secondary">No audit entries yet.</p> : null}
        </div>
      </PanelCard>
    </aside>
  );
}
