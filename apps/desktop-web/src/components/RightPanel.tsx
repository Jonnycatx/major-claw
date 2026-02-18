import type { AgentProfile } from "@majorclaw/shared-types";
import { useEffect, useState } from "react";
import type {
  AgentConfigPatch,
  ConnectedModelProvider,
  AgentConnectionTestResult,
  AgentFullConfig,
  AuditLogEntry,
  ClawHubSkill,
  PermissionGrant
} from "../tauriGateway.js";
import { PanelCard } from "./ui/PanelCard.js";

type RightPanelProps = {
  selectedAgent: AgentProfile;
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
  modelProviderOptions
}: RightPanelProps) {
  const [tab, setTab] = useState<"overview" | "model" | "skills" | "limits" | "activity">("overview");
  const [modelProvider, setModelProvider] = useState(selectedAgentConfig?.modelProvider ?? "anthropic");
  const [modelName, setModelName] = useState(selectedAgentConfig?.modelName ?? "claude-3-5-sonnet");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(String(selectedAgentConfig?.temperature ?? 0.7));
  const [maxTokens, setMaxTokens] = useState(String(selectedAgentConfig?.maxTokens ?? 8192));
  const [connectionTest, setConnectionTest] = useState<AgentConnectionTestResult | null>(null);

  useEffect(() => {
    setModelProvider(selectedAgentConfig?.modelProvider ?? "anthropic");
    setModelName(selectedAgentConfig?.modelName ?? "claude-3-5-sonnet");
    setTemperature(String(selectedAgentConfig?.temperature ?? 0.7));
    setMaxTokens(String(selectedAgentConfig?.maxTokens ?? 8192));
    setApiKey("");
    setConnectionTest(null);
  }, [selectedAgentConfig]);

  return (
    <aside className="h-full w-[320px] space-y-3 border-l border-lobster/20 p-4">
      <PanelCard title="Agent Context">
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
          </div>
        ) : null}
        {tab === "activity" ? (
          <div className="space-y-1 text-xs text-text-secondary">
            <p>Status: {selectedAgent.status}</p>
            <p>Last heartbeat: {selectedAgentConfig?.lastHeartbeat ? new Date(selectedAgentConfig.lastHeartbeat).toLocaleTimeString() : "n/a"}</p>
          </div>
        ) : null}
      </PanelCard>

      <PanelCard title="Live Logs">
        <div className="scanline-panel space-y-1 rounded-xl border border-cyan/15 p-2 font-mono text-xs">
          <div>
            <span className="text-cyan">22:44:11</span> instance.ready claw_local_1
          </div>
          <div>
            <span className="text-cyan">22:44:12</span> task.assigned task_2 to agent_research
          </div>
          <div>
            <span className="text-cyan">22:44:13</span> usage.report $0.12
          </div>
        </div>
      </PanelCard>

      <PanelCard title="Permissions">
        <div className="space-y-1 text-xs text-text-secondary">
          <p>can_read: true</p>
          <p>can_write: false</p>
          <p>can_exec: false</p>
        </div>
      </PanelCard>

      <PanelCard title="Installed Skills">
        {installedSkills.length === 0 ? (
          <p className="text-xs text-text-secondary">No skills installed yet.</p>
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
            <div key={entry.id} className="rounded-md border border-white/10 bg-black/40 px-2 py-1">
              <span className="text-cyan">{new Date(entry.createdAt).toLocaleTimeString()}</span>{" "}
              <span className="text-text-secondary">{entry.category}</span>
              <span className="text-lobster"> {entry.action}</span>
            </div>
          ))}
          {auditTimeline.length === 0 ? <p className="text-text-secondary">No audit entries yet.</p> : null}
        </div>
      </PanelCard>
    </aside>
  );
}
