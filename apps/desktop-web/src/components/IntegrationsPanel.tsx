import { useEffect, useState } from "react";
import type { AgentProfile } from "@majorclaw/shared-types";
import {
  backOfficialIntegrations,
  closeOfficialIntegrations,
  openOfficialIntegrations,
  type IntegrationEntry,
  type McpServerEntry,
  type McpToolEntry
} from "../tauriGateway.js";

type IntegrationsPanelProps = {
  agents: AgentProfile[];
  query: string;
  setQuery: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  categories: { name: string; connectedCount: number; totalCount: number }[];
  items: IntegrationEntry[];
  selected: IntegrationEntry | null;
  onSelect: (integration: IntegrationEntry) => void;
  selectedTargetAgentId: string;
  setSelectedTargetAgentId: (value: string) => void;
  busy: boolean;
  onConnect: (slug: string, targetAgentId: string, config?: Record<string, string>) => Promise<void>;
  mcpServers: McpServerEntry[];
  mcpTools: McpToolEntry[];
  selectedMcpServerId: string | null;
  setSelectedMcpServerId: (id: string | null) => void;
  onRegisterMcpServer: (url: string, name?: string, capabilities?: string[]) => Promise<void>;
  onRequestMcpConnect: (serverId: string, targetAgentId: string, scopes: string[]) => Promise<void>;
  onDisconnectMcpServer: (serverId: string) => Promise<void>;
  onRequestMcpInvoke: (serverId: string, toolId: string, targetAgentId: string, scopes: string[]) => Promise<void>;
};

const OFFICIAL_INTEGRATIONS_URL = "https://openclaw.ai/integrations";

async function openOfficialCatalog(fragment?: string): Promise<void> {
  const url = fragment ? `${OFFICIAL_INTEGRATIONS_URL}#${encodeURIComponent(fragment)}` : OFFICIAL_INTEGRATIONS_URL;
  const openedInNativeWindow = await openOfficialIntegrations(fragment);
  if (!openedInNativeWindow) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function IntegrationsPanel({
  agents,
  selectedTargetAgentId,
  setSelectedTargetAgentId,
  mcpServers,
  mcpTools,
  selectedMcpServerId,
  setSelectedMcpServerId,
  onRegisterMcpServer,
  onRequestMcpConnect,
  onDisconnectMcpServer,
  onRequestMcpInvoke
}: IntegrationsPanelProps) {
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpName, setMcpName] = useState("");
  const [mcpScopes, setMcpScopes] = useState("tools.invoke");

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;
      if (isMeta && event.shiftKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void openOfficialCatalog();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      <section className="mx-auto max-w-[1120px] px-2 pb-14 pt-2">
        <div className="mb-6 text-center">
          <h2 className="text-4xl font-bold tracking-tight text-lobster drop-shadow-[0_0_18px_rgba(255,59,0,0.45)]">Integrations</h2>
          <p className="mt-2 text-sm text-text-secondary">50+ integrations with the apps and services you already use.</p>
          <p className="text-sm text-text-secondary">Chat from your phone, control from your desktop, automate everything.</p>
        </div>

        <div className="mb-6 flex justify-center">
          <button
            type="button"
            onClick={() => void openOfficialCatalog()}
            className="group inline-flex items-center gap-3 rounded-2xl border border-lobster/60 bg-lobster px-8 py-3 text-base font-semibold text-white shadow-[0_0_28px_rgba(255,59,0,0.45)] transition-all hover:bg-[#ff5500] active:scale-[0.98]"
          >
            <span>Open Claw Integrations</span>
            <span className="text-lg transition-transform group-hover:rotate-12">↗</span>
          </button>
        </div>
        <div className="mb-6 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => void backOfficialIntegrations()}
            className="rounded-xl border border-white/15 bg-black/40 px-4 py-2 text-xs font-medium text-text-primary transition hover:border-cyan/40 hover:bg-cyan/10"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => void closeOfficialIntegrations()}
            className="rounded-xl border border-white/15 bg-black/40 px-4 py-2 text-xs font-medium text-text-primary transition hover:border-lobster/45 hover:bg-lobster/15"
          >
            Close Window
          </button>
        </div>

        <div className="mb-8 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-center text-xs text-text-secondary">
          Opens the official catalog in a native window. Shortcuts: <span className="text-cyan">Cmd/Ctrl + Shift + O</span> (open), native window controls (close), plus buttons above.
        </div>

        <section className="mb-10 rounded-2xl border border-lobster/25 bg-black/35 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-lobster">MCP Servers</h3>
            <span className="text-xs text-text-secondary">Universal tool integrations</span>
          </div>
          <div className="grid grid-cols-[1.2fr_1fr] gap-3">
            <div className="space-y-2">
              <input
                value={mcpUrl}
                onChange={(event) => setMcpUrl(event.target.value)}
                placeholder="mcp://local/filesystem or https://..."
                className="w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-2 text-xs text-text-primary"
              />
              <input
                value={mcpName}
                onChange={(event) => setMcpName(event.target.value)}
                placeholder="Server label (optional)"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-2 text-xs text-text-primary"
              />
              <button
                type="button"
                className="lobster-button-filled w-full"
                onClick={() =>
                  void onRegisterMcpServer(
                    mcpUrl.trim(),
                    mcpName.trim() || undefined,
                    ["tools.list", "tools.invoke"]
                  )
                }
                disabled={!mcpUrl.trim()}
              >
                Register MCP Server
              </button>
            </div>
            <div className="space-y-2">
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-2">
                {mcpServers.map((server) => (
                  <button
                    key={server.id}
                    type="button"
                    onClick={() => setSelectedMcpServerId(server.id)}
                    className={`w-full rounded-md border px-2 py-1.5 text-left text-xs ${
                      selectedMcpServerId === server.id
                        ? "border-lobster/50 bg-lobster/15 text-text-primary"
                        : "border-white/10 bg-black/25 text-text-secondary"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{server.name}</span>
                      <span className={`status-dot ${server.connected ? "bg-cyan animate-live" : "bg-white/30"}`} />
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[10px]">{server.url}</p>
                  </button>
                ))}
                {mcpServers.length === 0 ? <p className="text-[11px] text-text-secondary">No MCP servers yet.</p> : null}
              </div>
              {selectedMcpServerId ? (
                <div className="space-y-1 rounded-lg border border-white/10 bg-black/30 p-2">
                  <input
                    value={mcpScopes}
                    onChange={(event) => setMcpScopes(event.target.value)}
                    placeholder="Scopes comma-separated"
                    className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-text-primary"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="lobster-button"
                      onClick={() =>
                        void onRequestMcpConnect(
                          selectedMcpServerId,
                          selectedTargetAgentId,
                          mcpScopes
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean)
                        )
                      }
                    >
                      Connect
                    </button>
                    <button
                      type="button"
                      className="lobster-button"
                      onClick={() => void onDisconnectMcpServer(selectedMcpServerId)}
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          {selectedMcpServerId ? (
            <div className="mt-3 rounded-lg border border-cyan/20 bg-black/30 p-2">
              <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-cyan">Discovered Tools</p>
              <div className="grid grid-cols-2 gap-2">
                {mcpTools.map((tool) => (
                  <div key={tool.id} className="rounded-md border border-white/10 bg-black/25 px-2 py-1 text-[11px]">
                    <p className="font-medium text-text-primary">{tool.name}</p>
                    <p className="line-clamp-2 text-text-secondary">{tool.description}</p>
                    <button
                      type="button"
                      className="lobster-button mt-1 w-full"
                      onClick={() =>
                        void onRequestMcpInvoke(selectedMcpServerId, tool.id, selectedTargetAgentId, tool.scopes)
                      }
                    >
                      Invoke (approval-gated)
                    </button>
                  </div>
                ))}
                {mcpTools.length === 0 ? <p className="text-[11px] text-text-secondary">No tools discovered yet.</p> : null}
              </div>
            </div>
          ) : null}
        </section>
      </section>
    </div>
  );
}
