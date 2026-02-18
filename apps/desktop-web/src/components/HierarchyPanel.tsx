import type { AgentProfile } from "@majorclaw/shared-types";

import type { AgentQuickAction } from "../tauriGateway.js";

type HierarchyPanelProps = {
  agents: AgentProfile[];
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
  onNewAgent: () => void;
  onReorderAgents: (order: string[]) => Promise<void>;
  onQuickAction: (agentId: string, action: AgentQuickAction) => Promise<void>;
};

function statusClasses(status: AgentProfile["status"]): string {
  if (status === "online") {
    return "bg-cyan neon-cyan animate-live";
  }
  if (status === "busy") {
    return "bg-amber-300 animate-pulse";
  }
  if (status === "error") {
    return "bg-lobster neon-red animate-pulseGlow";
  }
  return "bg-white/40";
}

export function HierarchyPanel({
  agents,
  selectedAgentId,
  onSelectAgent,
  onNewAgent,
  onReorderAgents,
  onQuickAction
}: HierarchyPanelProps) {
  const handleDrop = async (dragId: string, dropId: string) => {
    if (dragId === dropId) {
      return;
    }
    const ids = agents.map((item) => item.id);
    const dragIndex = ids.indexOf(dragId);
    const dropIndex = ids.indexOf(dropId);
    if (dragIndex < 0 || dropIndex < 0) {
      return;
    }
    ids.splice(dragIndex, 1);
    ids.splice(dropIndex, 0, dragId);
    await onReorderAgents(ids);
  };

  return (
    <aside className="glass-panel relative h-full w-[280px] border-r border-lobster/20 p-4">
      <h3 className="section-title">Hierarchy</h3>
      <div className="space-y-2">
        {agents.map((agent) => {
          const active = selectedAgentId === agent.id;
          const isCso = !agent.parentId;
          return (
            <div
              key={agent.id}
              className={`group rounded-xl border transition-all duration-200 ${
                active
                  ? "border-lobster bg-lobster/12 text-text-primary shadow-lobster-glow-strong"
                  : "border-white/10 bg-white/[0.02] text-text-secondary hover:border-lobster/50 hover:bg-lobster/5 hover:shadow-lobster-glow"
              } ${isCso ? "shadow-[0_0_24px_rgba(255,59,0,0.25)]" : ""}`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", agent.id);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void handleDrop(event.dataTransfer.getData("text/plain"), agent.id);
              }}
            >
              <button
                type="button"
                onClick={() => onSelectAgent(agent.id)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
              >
                <span className={agent.parentId ? "ml-4" : ""}>
                  {isCso ? "👑 " : ""}
                  {agent.name}
                </span>
                <span className={`status-dot ${statusClasses(agent.status)}`} />
              </button>
              <div className="hidden items-center gap-1 border-t border-white/10 px-2 pb-2 pt-1 text-[10px] group-hover:flex">
                <button
                  type="button"
                  className="rounded-md border border-white/20 px-2 py-0.5 hover:border-lobster/50"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onQuickAction(agent.id, "pause");
                  }}
                >
                  Pause
                </button>
                <button
                  type="button"
                  className="rounded-md border border-white/20 px-2 py-0.5 hover:border-lobster/50"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onQuickAction(agent.id, "clone");
                  }}
                >
                  Clone
                </button>
                <button
                  type="button"
                  className="rounded-md border border-white/20 px-2 py-0.5 hover:border-lobster/50"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!window.confirm(`Delete ${agent.name}? This cannot be undone.`)) {
                      return;
                    }
                    void onQuickAction(agent.id, "delete");
                  }}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="rounded-md border border-white/20 px-2 py-0.5 hover:border-lobster/50"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onQuickAction(agent.id, "logs");
                  }}
                >
                  Logs
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="lobster-button-filled mt-4 w-full" onClick={onNewAgent}>
        + New Agent
      </button>
    </aside>
  );
}
