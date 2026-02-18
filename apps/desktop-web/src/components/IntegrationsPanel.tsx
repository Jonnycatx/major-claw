import { useMemo, useState } from "react";
import type { AgentProfile } from "@majorclaw/shared-types";
import type { IntegrationEntry } from "../tauriGateway.js";

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
};

function isAiModel(category: string): boolean {
  return category === "AI Models";
}

function wantsQrPairing(slug: string): boolean {
  return slug === "whatsapp" || slug === "zalo-personal";
}

function statusLabel(status: IntegrationEntry["status"]): string {
  if (status === "connected") return "Connected";
  if (status === "setup_required") return "Setup Required";
  return "Disconnected";
}

const categoryTagline: Record<string, string> = {
  "Chat Providers": "Message OpenClaw from any chat app — it responds right where you are.",
  "AI Models": "Use any model you want — cloud or local. Your keys, your choice.",
  Productivity: "Notes, tasks, wikis, and code — OpenClaw works with your favorite tools.",
  "Music & Audio": "Control playback, identify songs, and manage multi-room audio.",
  "Smart Home": "Lights, thermostats, and IoT devices — all voice-controllable.",
  "Tools & Automation": "Browser control, scheduled tasks, email triggers, and more.",
  "Media & Creative": "Generate images, capture screens, and find the perfect GIF.",
  Social: "Post tweets, manage email, and stay connected.",
  Platforms: "Run the Gateway anywhere with mobile and desktop companions.",
  "Community Showcase": "Impressive integrations built by the community."
};

function integrationIconMeta(name: string): { glyph: string; ringClass: string; textClass: string } {
  const lowered = name.toLowerCase();
  if (lowered.includes("whatsapp")) return { glyph: "◉", ringClass: "border-emerald-400/40 bg-emerald-500/10", textClass: "text-emerald-300" };
  if (lowered.includes("telegram")) return { glyph: "✈", ringClass: "border-sky-400/40 bg-sky-500/10", textClass: "text-sky-300" };
  if (lowered.includes("discord")) return { glyph: "◍", ringClass: "border-indigo-400/40 bg-indigo-500/10", textClass: "text-indigo-300" };
  if (lowered.includes("slack")) return { glyph: "#", ringClass: "border-fuchsia-400/40 bg-fuchsia-500/10", textClass: "text-fuchsia-300" };
  if (lowered.includes("signal")) return { glyph: "◌", ringClass: "border-blue-400/40 bg-blue-500/10", textClass: "text-blue-300" };
  if (lowered.includes("anthropic")) return { glyph: "AI", ringClass: "border-amber-300/40 bg-amber-400/10", textClass: "text-amber-200" };
  if (lowered.includes("openai")) return { glyph: "◎", ringClass: "border-teal-300/40 bg-teal-500/10", textClass: "text-teal-200" };
  if (lowered.includes("google")) return { glyph: "G", ringClass: "border-blue-400/40 bg-blue-500/10", textClass: "text-blue-300" };
  if (lowered.includes("xai")) return { glyph: "X", ringClass: "border-zinc-300/40 bg-zinc-500/10", textClass: "text-zinc-100" };
  if (lowered.includes("mistral")) return { glyph: "M", ringClass: "border-orange-400/40 bg-orange-500/10", textClass: "text-orange-300" };
  if (lowered.includes("perplexity")) return { glyph: "⟡", ringClass: "border-cyan-400/40 bg-cyan-500/10", textClass: "text-cyan-300" };
  if (lowered.includes("github")) return { glyph: "◓", ringClass: "border-white/30 bg-white/5", textClass: "text-white" };
  if (lowered.includes("spotify")) return { glyph: "♫", ringClass: "border-emerald-400/40 bg-emerald-500/10", textClass: "text-emerald-300" };
  if (lowered.includes("camera")) return { glyph: "◉", ringClass: "border-zinc-300/40 bg-zinc-500/10", textClass: "text-zinc-100" };
  if (lowered.includes("twitter")) return { glyph: "𝕏", ringClass: "border-white/30 bg-white/5", textClass: "text-white" };
  return { glyph: name.slice(0, 1).toUpperCase(), ringClass: "border-white/20 bg-white/5", textClass: "text-text-primary" };
}

export function IntegrationsPanel({
  agents,
  query,
  setQuery,
  category,
  setCategory,
  categories,
  items,
  selected,
  onSelect,
  selectedTargetAgentId,
  setSelectedTargetAgentId,
  busy,
  onConnect
}: IntegrationsPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [modelHint, setModelHint] = useState("");
  const [pairingOpen, setPairingOpen] = useState(false);
  const [activeIntegration, setActiveIntegration] = useState<IntegrationEntry | null>(null);
  const pairingCode = useMemo(() => `${selected?.slug ?? "integration"}-${Math.random().toString(36).slice(2, 8)}`, [selected?.slug]);
  const grouped = useMemo(() => {
    const categoriesToRender = category === "All Categories" ? categories.map((item) => item.name).filter((name) => name !== "All Categories") : [category];
    return categoriesToRender
      .map((name) => ({
        name,
        items: items.filter((item) => item.category === name)
      }))
      .filter((entry) => entry.items.length > 0);
  }, [category, categories, items]);
  const detail = activeIntegration;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      <section className="mx-auto max-w-[1120px] px-2 pb-14 pt-2">
        <div className="mb-6 text-center">
          <h2 className="text-4xl font-bold tracking-tight text-lobster drop-shadow-[0_0_18px_rgba(255,59,0,0.45)]">Integrations</h2>
          <p className="mt-2 text-sm text-text-secondary">50+ integrations with the apps and services you already use.</p>
          <p className="text-sm text-text-secondary">Chat from your phone, control from your desktop, automate everything.</p>
        </div>

        <div className="mb-8 space-y-2.5">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search integrations..."
            className="w-full rounded-xl border border-white/10 bg-black/70 px-4 py-2.5 text-sm text-text-primary outline-none focus:border-lobster/60"
          />
          <div className="flex flex-wrap justify-center gap-1.5">
            {categories.map((entry) => (
              <button
                key={entry.name}
                type="button"
                onClick={() => setCategory(entry.name)}
                className={`rounded-full border px-3 py-1 text-[12px] ${
                  category === entry.name
                    ? "border-lobster/60 bg-lobster/20 text-lobster shadow-lobster-glow"
                    : "border-white/15 text-text-secondary hover:border-lobster/30"
                }`}
              >
                {entry.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-12">
          {grouped.map((group) => (
            <section key={group.name} className="scroll-mt-10">
              <h3 className="mb-2 text-3xl font-bold text-text-primary">
                <span className="mr-2 text-lobster">⟩</span>
                {group.name}
              </h3>
              <p className="mb-5 text-sm text-text-secondary">{categoryTagline[group.name] ?? "Connect and automate your stack."}</p>
              <div className="grid grid-cols-4 gap-4">
                {group.items.map((integration) => {
                  const icon = integrationIconMeta(integration.name);
                  return (
                    <button
                      key={integration.slug}
                      type="button"
                      onClick={() => {
                        onSelect(integration);
                        setActiveIntegration(integration);
                      }}
                      className={`rounded-2xl border bg-[#0f131f]/90 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-lobster/45 hover:shadow-[0_0_14px_rgba(255,59,0,0.28)] ${
                        detail?.slug === integration.slug ? "border-lobster/60 shadow-[0_0_16px_rgba(255,59,0,0.26)]" : "border-white/5"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-base font-semibold ${icon.ringClass} ${icon.textClass}`}
                        >
                          {icon.glyph}
                        </div>
                        <span
                          className={`status-dot ${
                            integration.status === "connected"
                              ? "bg-cyan neon-cyan animate-live"
                              : integration.status === "setup_required"
                                ? "bg-amber-300"
                                : "bg-white/30"
                          }`}
                        />
                      </div>
                      <p className="text-lg font-semibold leading-tight text-text-primary">{integration.name}</p>
                      <p className="mt-1.5 line-clamp-2 text-xs text-text-secondary">{integration.description}</p>
                      <p className="mt-2 text-[11px] text-text-secondary/90">{statusLabel(integration.status)}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>

      {detail ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onClick={() => setActiveIntegration(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-lobster/40 bg-panel p-4 shadow-lobster-glow-strong"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h4 className="text-lg font-semibold text-text-primary">{detail.name}</h4>
                <p className="text-xs text-text-secondary">{detail.description}</p>
              </div>
              <button className="lobster-button" type="button" onClick={() => setActiveIntegration(null)}>
                Close
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-lobster">Setup</p>
                <div className="space-y-1">
                  {detail.setup.map((step) => (
                    <div key={step} className="rounded-md border border-white/10 bg-black/35 px-2 py-1 text-xs text-text-secondary">
                      {step}
                    </div>
                  ))}
                </div>
              </div>
              {isAiModel(detail.category) ? (
                <div className="space-y-2">
                  <label className="text-[11px] text-text-secondary">
                    API Key
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder="Paste provider key"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-2 text-xs"
                    />
                  </label>
                  <label className="text-[11px] text-text-secondary">
                    Model
                    <input
                      value={modelHint}
                      onChange={(event) => setModelHint(event.target.value)}
                      placeholder="e.g. claude-3-5-sonnet"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-2 text-xs"
                    />
                  </label>
                </div>
              ) : null}
              {wantsQrPairing(detail.slug) ? (
                <button className="lobster-button w-full" type="button" onClick={() => setPairingOpen(true)}>
                  Open Secure QR Pairing
                </button>
              ) : null}
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-lobster">Assign to Agent</p>
                <select
                  value={selectedTargetAgentId}
                  onChange={(event) => setSelectedTargetAgentId(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/50 px-2 py-2 text-xs text-text-secondary"
                >
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-lobster">Permission Preview</p>
                <div className="space-y-1">
                  {detail.permissions.map((permission) => (
                    <div key={permission} className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-text-secondary">
                      {permission}
                    </div>
                  ))}
                </div>
              </div>
              <button
                className="lobster-button-filled w-full"
                type="button"
                disabled={busy}
                onClick={() =>
                  void onConnect(detail.slug, selectedTargetAgentId, {
                    apiKey: apiKey.trim(),
                    model: modelHint.trim()
                  })
                }
              >
                {busy ? "Connecting..." : detail.status === "connected" ? "Configure" : "Connect"}
              </button>
              <p className="text-center text-[11px] text-text-secondary">{statusLabel(detail.status)}</p>
            </div>
          </div>
        </div>
      ) : null}

      {pairingOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setPairingOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-lobster/40 bg-panel p-4 shadow-lobster-glow-strong"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 className="section-title">Secure QR Pairing</h4>
            <p className="mb-3 text-xs text-text-secondary">Scan this code from your phone to pair {detail?.name}.</p>
            <div className="mx-auto w-[220px] rounded-xl border border-white/10 bg-black p-3">
              <div className="grid grid-cols-6 gap-1">
                {Array.from({ length: 36 }).map((_, index) => (
                  <span key={index} className={`h-7 w-7 rounded-sm ${index % 2 === 0 ? "bg-white" : "bg-black"}`} />
                ))}
              </div>
            </div>
            <p className="mt-2 text-center font-mono text-xs text-cyan">{pairingCode}</p>
            <div className="mt-4 flex justify-end">
              <button className="lobster-button" type="button" onClick={() => setPairingOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
