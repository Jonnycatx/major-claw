import type { AgentProfile, TaskRecord } from "@majorclaw/shared-types";
import type { ClawHubSkill, ClawHubSort, IntegrationEntry } from "../tauriGateway.js";
import { PanelCard } from "./ui/PanelCard.js";
import { IntegrationsPanel } from "./IntegrationsPanel.js";
import { ChatCommandPanel } from "./ChatCommandPanel.js";

export type CenterTab = "overview" | "kanban" | "chat" | "logs" | "analytics" | "integrations" | "marketplace";

type CenterPanelProps = {
  tab: CenterTab;
  setTab: (tab: CenterTab) => void;
  tasks: TaskRecord[];
  gatewayInstances: number | null;
  draftMessage: string;
  setDraftMessage: (value: string) => void;
  logFilter: string;
  setLogFilter: (value: string) => void;
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
  onJumpToAgent: (agentId: string) => void;
  onInstallSuggestedSkill: (slug: string, targetAgentId: string) => Promise<void>;
  onOpenMarketplaceForSkill: (slug: string) => void;
};

const tabs: CenterTab[] = ["overview", "kanban", "chat", "logs", "analytics", "integrations", "marketplace"];
const statuses = ["inbox", "assigned", "in_progress", "review", "done"] as const;

export function CenterPanel({
  tab,
  setTab,
  tasks,
  gatewayInstances,
  draftMessage,
  setDraftMessage,
  logFilter,
  setLogFilter,
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
  onJumpToAgent,
  onInstallSuggestedSkill,
  onOpenMarketplaceForSkill
}: CenterPanelProps) {
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
        <div className="grid h-full grid-cols-3 gap-4">
          <PanelCard title="Connected Instances">{gatewayInstances ?? 0}</PanelCard>
          <PanelCard title="Tasks Active">{tasks.filter((item) => item.status !== "done").length}</PanelCard>
          <PanelCard title="Swarm Energy">Always online. Always sharp.</PanelCard>
          <section className="glass-panel col-span-3 flex h-full min-h-[280px] flex-col items-center justify-center border border-lobster/25 bg-panel/80 text-center">
            <div className="neon-red rounded-full bg-lobster/10 p-4 text-6xl leading-none">🦞</div>
            <p className="mt-5 text-4xl font-bold tracking-tight text-lobster drop-shadow-[0_0_18px_rgba(255,59,0,0.5)]">
              EXFOLIATE your swarm!
            </p>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary">
              Mission Control is live. Route work through CSO, watch squads execute, and keep the whole system in sync.
            </p>
          </section>
        </div>
      ) : null}

      {tab === "kanban" ? (
        <div className="grid min-h-0 flex-1 grid-cols-5 gap-3 overflow-hidden">
          {statuses.map((status) => (
            <section key={status} className="glass-panel min-h-0 overflow-y-auto border border-lobster/10 p-2">
              <h4 className="section-title">{status}</h4>
              <div className="space-y-2">
                {tasks
                  .filter((task) => task.status === status)
                  .map((task) => (
                    <PanelCard key={task.id} className="bg-panel/70">
                      <p className="text-sm font-medium text-text-primary">{task.title}</p>
                      <p className="text-xs text-text-secondary">{task.assigneeAgentId ?? "Unassigned"}</p>
                    </PanelCard>
                  ))}
              </div>
            </section>
          ))}
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
            {(logFilter === "all" || logFilter === "task") && (
              <div>
                <span className="text-cyan">22:44:10</span> task.assigned task_2 - agent_research
              </div>
            )}
            {(logFilter === "all" || logFilter === "usage") && (
              <div>
                <span className="text-cyan">22:44:13</span> usage.report $0.12
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === "analytics" ? (
        <div className="grid grid-cols-2 gap-4">
          <PanelCard title="Cost by Model">llama3.1:70b — $0.22</PanelCard>
          <PanelCard title="Cost by Agent">agent_research — $0.19</PanelCard>
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
    </main>
  );
}
