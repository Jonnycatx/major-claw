import { useMemo, useState } from "react";
import type { AgentCreatePayload, AgentProfile } from "../tauriGateway.js";

type NewAgentModalProps = {
  open: boolean;
  agents: AgentProfile[];
  busy: boolean;
  onClose: () => void;
  onCreate: (payload: AgentCreatePayload) => Promise<void>;
};

const rolePresets = [
  "research",
  "analysis",
  "review",
  "ops",
  "coding",
  "qa",
  "planning",
  "support"
];

export function NewAgentModal({ open, agents, busy, onClose, onCreate }: NewAgentModalProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState(rolePresets[0]!);
  const [parentId, setParentId] = useState("agent_cso");
  const [modelProvider, setModelProvider] = useState("anthropic");
  const [modelName, setModelName] = useState("claude-3-5-sonnet");
  const [apiKey, setApiKey] = useState("");

  const previewLabel = useMemo(() => name.trim() || "New Agent", [name]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-lobster/40 bg-void/95 p-4 shadow-lobster-glow-strong">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="section-title">New Agent Wizard</h3>
          <button type="button" className="lobster-button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-text-secondary">
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-text-secondary">
              Role
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
              >
                {rolePresets.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-text-secondary">
              Parent
              <select
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-text-secondary">
              Model Provider
              <select
                value={modelProvider}
                onChange={(event) => setModelProvider(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
              >
                <option value="anthropic">anthropic</option>
                <option value="openai">openai</option>
                <option value="google">google</option>
                <option value="xai">xai</option>
                <option value="local">local</option>
              </select>
            </label>
            <label className="text-xs text-text-secondary">
              Initial Model
              <input
                value={modelName}
                onChange={(event) => setModelName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-text-secondary">
              API Key (secure)
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="optional"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-lobster">Preview</p>
            <div className="mt-2 rounded-xl border border-lobster/30 bg-lobster/10 p-3 shadow-lobster-glow">
              <p className="text-sm font-semibold text-text-primary">{previewLabel}</p>
              <p className="text-xs text-text-secondary">
                {role} · {modelProvider}/{modelName}
              </p>
            </div>
            <p className="mt-3 text-xs text-text-secondary">
              Agent will appear under the selected parent and can be configured in the right context panel immediately.
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="lobster-button-filled"
            disabled={busy || !name.trim()}
            onClick={() => {
              const payload: AgentCreatePayload = {
                name: name.trim(),
                role,
                parentId,
                modelProvider,
                modelName
              };
              if (apiKey.trim()) {
                payload.apiKey = apiKey.trim();
              }
              void onCreate(payload);
            }}
          >
            {busy ? "Creating..." : "Create Agent"}
          </button>
        </div>
      </div>
    </div>
  );
}
