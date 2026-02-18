import type { IntegrationEntry, IntegrationStatus, IntegrationsListResult } from "@majorclaw/shared-types";
import type { EventBus } from "./eventBus.js";
import type { GatewayEvent } from "./types.js";

type IntegrationSeed = Omit<IntegrationEntry, "status" | "assignedAgentIds"> & { defaultStatus?: IntegrationStatus };

const integrationsSeed: IntegrationSeed[] = [
  // Chat Providers
  { slug: "whatsapp", name: "WhatsApp", category: "Chat Providers", description: "Message OpenClaw from WhatsApp with secure pairing.", setup: ["Open QR pairing", "Scan with WhatsApp app"], permissions: ["network.http", "chat.send"] },
  { slug: "telegram", name: "Telegram", category: "Chat Providers", description: "Talk to OpenClaw from Telegram chats and groups.", setup: ["Create Telegram bot token", "Paste token and connect"], permissions: ["network.http", "chat.send"] },
  { slug: "discord", name: "Discord", category: "Chat Providers", description: "Connect Discord channels for collaborative workflows.", setup: ["Create Discord app", "Authorize server"], permissions: ["network.http", "chat.send"] },
  { slug: "slack", name: "Slack", category: "Chat Providers", description: "Use OpenClaw directly in Slack channels.", setup: ["Install Slack app", "Grant workspace scopes"], permissions: ["network.http", "chat.send"] },
  { slug: "signal", name: "Signal", category: "Chat Providers", description: "Secure Signal bridge for private automation.", setup: ["Start Signal bridge", "Pair local device"], permissions: ["network.http"] },
  { slug: "imessage-imsg", name: "iMessage (imsg)", category: "Chat Providers", description: "iMessage via imsg (AppleScript bridge).", setup: ["Enable AppleScript bridge", "Grant automation permissions"], permissions: ["applescript.exec"] },
  { slug: "imessage-bluebubbles", name: "iMessage (BlueBubbles)", category: "Chat Providers", description: "iMessage via BlueBubbles server.", setup: ["Run BlueBubbles server", "Pair local bridge"], permissions: ["network.http"] },
  { slug: "teams", name: "Microsoft Teams", category: "Chat Providers", description: "Connect Microsoft Teams channels to OpenClaw.", setup: ["Create Teams app", "Enable bot messaging"], permissions: ["network.http", "chat.send"] },
  { slug: "nextcloud-chat", name: "Nextcloud Chat", category: "Chat Providers", description: "Self-hosted chat integration for Nextcloud Talk.", setup: ["Provide Nextcloud URL", "Generate app token"], permissions: ["network.http"] },
  { slug: "matrix", name: "Matrix", category: "Chat Providers", description: "Open protocol Matrix integration for federated chats.", setup: ["Set homeserver", "Sign in bot user"], permissions: ["network.http"] },
  { slug: "nostr", name: "Nostr", category: "Chat Providers", description: "Nostr relay messaging support.", setup: ["Configure relay list", "Paste keypair"], permissions: ["network.http"] },
  { slug: "tlon-messenger", name: "Tlon Messenger", category: "Chat Providers", description: "Connect OpenClaw with Tlon channels.", setup: ["Set bridge endpoint", "Authorize account"], permissions: ["network.http"] },
  { slug: "zalo", name: "Zalo", category: "Chat Providers", description: "Zalo Bot API.", setup: ["Create Zalo bot app", "Paste bot token"], permissions: ["network.http"] },
  { slug: "zalo-personal", name: "Zalo Personal", category: "Chat Providers", description: "Personal account via QR login.", setup: ["Open QR secure view", "Scan with mobile app"], permissions: ["network.http"] },
  { slug: "webchat", name: "WebChat", category: "Chat Providers", description: "Embeddable web chat widget for instant access.", setup: ["Copy embed key", "Enable websocket"], permissions: ["network.http"] },

  // AI Models
  { slug: "anthropic", name: "Anthropic (Claude)", category: "AI Models", description: "Use Claude models with your own Anthropic keys.", setup: ["Paste API key", "Choose default model"], permissions: ["model.invoke"] },
  { slug: "openai", name: "OpenAI (GPT/o1)", category: "AI Models", description: "Route tasks to GPT and o1 models.", setup: ["Paste OpenAI key", "Select endpoint"], permissions: ["model.invoke"] },
  { slug: "google-gemini", name: "Google (Gemini)", category: "AI Models", description: "Gemini 2.5 Pro/Flash.", setup: ["Paste Google key", "Select Gemini model"], permissions: ["model.invoke"] },
  { slug: "minimax", name: "MiniMax", category: "AI Models", description: "Add MiniMax models to your provider roster.", setup: ["Set MiniMax credentials"], permissions: ["model.invoke"] },
  { slug: "xai-grok", name: "xAI (Grok)", category: "AI Models", description: "Use Grok models in your agent hierarchy.", setup: ["Paste xAI key"], permissions: ["model.invoke"] },
  { slug: "vercel-ai-gateway", name: "Vercel AI Gateway", category: "AI Models", description: "Centralized provider routing through Vercel AI Gateway.", setup: ["Set Vercel gateway key"], permissions: ["model.invoke", "network.http"] },
  { slug: "openrouter", name: "OpenRouter", category: "AI Models", description: "Access many model vendors through one API.", setup: ["Paste OpenRouter key"], permissions: ["model.invoke"] },
  { slug: "mistral", name: "Mistral", category: "AI Models", description: "Integrate Mistral model endpoints.", setup: ["Paste Mistral key"], permissions: ["model.invoke"] },
  { slug: "deepseek", name: "DeepSeek", category: "AI Models", description: "DeepSeek models for coding and analysis.", setup: ["Paste DeepSeek key"], permissions: ["model.invoke"] },
  { slug: "glm", name: "GLM", category: "AI Models", description: "GLM provider integration.", setup: ["Paste GLM key"], permissions: ["model.invoke"] },
  { slug: "perplexity", name: "Perplexity", category: "AI Models", description: "Perplexity models for web-grounded responses.", setup: ["Paste Perplexity key"], permissions: ["model.invoke", "network.http"] },
  { slug: "huggingface", name: "Hugging Face", category: "AI Models", description: "Hugging Face Inference API models.", setup: ["Paste Hugging Face token"], permissions: ["model.invoke"] },
  { slug: "local-models", name: "Local Models", category: "AI Models", description: "Ollama, LM Studio.", setup: ["Start Ollama or LM Studio", "Set local endpoint"], permissions: ["model.invoke"], defaultStatus: "setup_required" },

  // Productivity
  { slug: "apple-notes", name: "Apple Notes", category: "Productivity", description: "Create and manage notes from agent workflows.", setup: ["Grant macOS notes permissions"], permissions: ["notes.write"] },
  { slug: "apple-reminders", name: "Apple Reminders", category: "Productivity", description: "Sync reminders and follow-up tasks.", setup: ["Grant reminders access"], permissions: ["calendar.write"] },
  { slug: "things3", name: "Things 3", category: "Productivity", description: "Send tasks directly to Things 3 projects.", setup: ["Enable x-callback URL"], permissions: ["tasks.write"] },
  { slug: "notion", name: "Notion", category: "Productivity", description: "Connect Notion pages and databases.", setup: ["Paste Notion integration token"], permissions: ["notion.read", "notion.write"] },
  { slug: "obsidian", name: "Obsidian", category: "Productivity", description: "Read and update notes in your vault.", setup: ["Set vault path"], permissions: ["filesystem.read", "filesystem.write"] },
  { slug: "bear-notes", name: "Bear Notes", category: "Productivity", description: "Capture ideas and summaries into Bear.", setup: ["Enable Bear URL scheme"], permissions: ["notes.write"] },
  { slug: "trello", name: "Trello", category: "Productivity", description: "Create cards and update boards automatically.", setup: ["Paste Trello token"], permissions: ["tasks.read", "tasks.write"] },
  { slug: "github", name: "GitHub", category: "Productivity", description: "Manage issues, PRs, and CI workflows.", setup: ["Authenticate gh CLI"], permissions: ["git.write", "network.http"] },

  // Music & Audio
  { slug: "spotify", name: "Spotify", category: "Music & Audio", description: "Music playback control.", setup: ["Connect Spotify account"], permissions: ["network.http"] },
  { slug: "sonos", name: "Sonos", category: "Music & Audio", description: "Multi-room audio.", setup: ["Discover Sonos speakers"], permissions: ["network.http"] },
  { slug: "shazam", name: "Shazam", category: "Music & Audio", description: "Song recognition.", setup: ["Enable microphone access"], permissions: ["audio.input"] },

  // Smart Home
  { slug: "philips-hue", name: "Philips Hue", category: "Smart Home", description: "Smart lighting.", setup: ["Pair Hue bridge"], permissions: ["network.http"] },
  { slug: "8sleep", name: "8Sleep", category: "Smart Home", description: "Smart mattress.", setup: ["Authorize 8Sleep account"], permissions: ["network.http"] },
  { slug: "home-assistant", name: "Home Assistant", category: "Smart Home", description: "Home automation hub.", setup: ["Set Home Assistant URL/token"], permissions: ["network.http"] },

  // Tools & Automation
  { slug: "browser", name: "Browser (Chrome/Chromium)", category: "Tools & Automation", description: "Structured browser automation and capture.", setup: ["Install browser bridge"], permissions: ["browser.control"] },
  { slug: "canvas", name: "Canvas", category: "Tools & Automation", description: "Visual workspace for planning and coordination.", setup: ["Enable canvas workspace"], permissions: ["canvas.write"] },
  { slug: "voice", name: "Voice", category: "Tools & Automation", description: "Voice Wake + Talk Mode.", setup: ["Enable microphone access"], permissions: ["audio.input"] },
  { slug: "gmail-pubsub", name: "Gmail (Pub/Sub)", category: "Tools & Automation", description: "Realtime Gmail event triggers.", setup: ["Configure Google Pub/Sub webhook"], permissions: ["gmail.read", "gmail.send"] },
  { slug: "cron", name: "Cron", category: "Tools & Automation", description: "Schedule autonomous tasks and routines.", setup: ["Define cron jobs"], permissions: ["scheduler.write"] },
  { slug: "webhooks", name: "Webhooks", category: "Tools & Automation", description: "Incoming/outgoing event automation hooks.", setup: ["Create webhook URLs"], permissions: ["network.http"] },
  { slug: "1password", name: "1Password", category: "Tools & Automation", description: "Secure secret retrieval via vault access.", setup: ["Sign in 1Password CLI"], permissions: ["secrets.read"] },
  { slug: "weather", name: "Weather", category: "Tools & Automation", description: "Current conditions and forecast lookups.", setup: ["Set region preferences"], permissions: ["network.http"] },

  // Media & Creative
  { slug: "image-gen", name: "Image Gen", category: "Media & Creative", description: "Generate images from prompts.", setup: ["Select image provider"], permissions: ["image.generate"] },
  { slug: "gif-search", name: "GIF Search", category: "Media & Creative", description: "Find and share GIFs in chat workflows.", setup: ["Set GIF provider key"], permissions: ["network.http"] },
  { slug: "peekaboo", name: "Peekaboo", category: "Media & Creative", description: "Screen capture and visual extraction.", setup: ["Grant screen recording access"], permissions: ["screen.capture"] },
  { slug: "camera", name: "Camera", category: "Media & Creative", description: "Capture camera input for multimodal tasks.", setup: ["Grant camera access"], permissions: ["camera.read"] },

  // Social
  { slug: "twitter-x", name: "Twitter/X", category: "Social", description: "Tweet, reply, search.", setup: ["Connect X account"], permissions: ["network.http"] },
  { slug: "email", name: "Email", category: "Social", description: "Send & read emails.", setup: ["Connect email provider"], permissions: ["gmail.read", "gmail.send"] },

  // Platforms
  { slug: "macos-menu-bar", name: "macOS Menu Bar + Voice Wake", category: "Platforms", description: "Native macOS control center with wake voice.", setup: ["Enable menu bar app"], permissions: ["audio.input", "notifications.write"], defaultStatus: "setup_required" },
  { slug: "ios", name: "iOS Canvas/Camera", category: "Platforms", description: "Use Canvas and camera on iOS devices.", setup: ["Pair iOS companion app"], permissions: ["camera.read"] },
  { slug: "android", name: "Android Canvas/Screen", category: "Platforms", description: "Android screen and canvas integration.", setup: ["Pair Android companion app"], permissions: ["screen.capture"] },
  { slug: "windows-wsl2", name: "Windows (WSL2)", category: "Platforms", description: "Run OpenClaw through WSL2 environment.", setup: ["Enable WSL2", "Install runtime"], permissions: ["filesystem.read"], defaultStatus: "setup_required" },
  { slug: "linux", name: "Linux", category: "Platforms", description: "Native Linux integration support.", setup: ["Install Linux package"], permissions: ["filesystem.read"], defaultStatus: "setup_required" },

  // Community Showcase
  { slug: "tesco-autopilot", name: "Tesco Autopilot", category: "Community Showcase", description: "Automated grocery shopping.", setup: ["See showcase docs"], permissions: ["network.http"] },
  { slug: "bambu-control", name: "Bambu Control", category: "Community Showcase", description: "Manage Bambu printer operations with agents.", setup: ["Connect local printer API"], permissions: ["network.http"] },
  { slug: "oura-ring", name: "Oura Ring", category: "Community Showcase", description: "Wellness insights and summaries from Oura data.", setup: ["Paste Oura API token"], permissions: ["health.read"] },
  { slug: "food-ordering", name: "Food Ordering", category: "Community Showcase", description: "Foodora integration.", setup: ["Authenticate Foodora account"], permissions: ["network.http"] }
];

export class IntegrationsService {
  private readonly status = new Map<string, IntegrationStatus>();
  private readonly assigned = new Map<string, string[]>();
  private readonly configBySlug = new Map<string, Record<string, string>>();
  private connectedAt = new Date().toISOString();

  constructor(events: EventBus<GatewayEvent>) {
    for (const entry of integrationsSeed) {
      this.status.set(entry.slug, entry.defaultStatus ?? "disconnected");
      this.assigned.set(entry.slug, []);
      this.configBySlug.set(entry.slug, {});
    }
    // External runtime connectivity events are websocket-derived in gateway.
    events.on("instance.heartbeat", () => {
      this.connectedAt = new Date().toISOString();
    });
    events.on("instance.disconnected", () => {
      this.connectedAt = new Date().toISOString();
      for (const [slug, status] of this.status.entries()) {
        if (status === "connected" && this.isExternalTransport(slug)) {
          this.status.set(slug, "setup_required");
        }
      }
    });
  }

  list(query = "", category = "All Categories"): IntegrationsListResult {
    const lowered = query.trim().toLowerCase();
    const base = integrationsSeed
      .filter((item) => (category === "All Categories" ? true : item.category === category))
      .filter((item) => {
        if (!lowered) {
          return true;
        }
        return item.name.toLowerCase().includes(lowered) || item.description.toLowerCase().includes(lowered) || item.slug.includes(lowered);
      })
      .map((item) => this.toEntry(item));

    const categoryMap = new Map<string, { connectedCount: number; totalCount: number }>();
    for (const item of integrationsSeed) {
      const status = this.status.get(item.slug) ?? "disconnected";
      const current = categoryMap.get(item.category) ?? { connectedCount: 0, totalCount: 0 };
      current.totalCount += 1;
      if (status === "connected") {
        current.connectedCount += 1;
      }
      categoryMap.set(item.category, current);
    }

    return {
      items: base,
      categories: [{ name: "All Categories", connectedCount: [...categoryMap.values()].reduce((sum, item) => sum + item.connectedCount, 0), totalCount: integrationsSeed.length }].concat(
        [...categoryMap.entries()].map(([name, counts]) => ({ name, ...counts }))
      )
    };
  }

  getStatus(slug: string): { slug: string; status: IntegrationStatus } {
    return { slug, status: this.status.get(slug) ?? "disconnected" };
  }

  connect(slug: string, agentIds: string[], config?: Record<string, string>): IntegrationEntry {
    if (!this.status.has(slug)) {
      throw new Error(`integration not found: ${slug}`);
    }
    if (this.isAiModel(slug)) {
      const value = config?.apiKey?.trim();
      if (!value) {
        this.status.set(slug, "setup_required");
        return this.toEntry(integrationsSeed.find((item) => item.slug === slug)!);
      }
    }
    this.status.set(slug, "connected");
    this.assigned.set(slug, agentIds);
    this.configBySlug.set(slug, config ?? {});
    const seed = integrationsSeed.find((item) => item.slug === slug)!;
    return this.toEntry(seed);
  }

  connectedModelProviders(): { provider: string; label: string; modelHint: string }[] {
    return integrationsSeed
      .filter((entry) => entry.category === "AI Models")
      .filter((entry) => this.status.get(entry.slug) === "connected")
      .map((entry) => ({
        provider: this.providerFromSlug(entry.slug),
        label: entry.name,
        modelHint: this.configBySlug.get(entry.slug)?.model ?? "default"
      }));
  }

  private toEntry(seed: IntegrationSeed): IntegrationEntry {
    return {
      slug: seed.slug,
      name: seed.name,
      category: seed.category,
      description: seed.description,
      setup: seed.setup,
      permissions: seed.permissions,
      status: this.status.get(seed.slug) ?? "disconnected",
      assignedAgentIds: this.assigned.get(seed.slug) ?? []
    };
  }

  private isAiModel(slug: string): boolean {
    return integrationsSeed.find((item) => item.slug === slug)?.category === "AI Models";
  }

  private isExternalTransport(slug: string): boolean {
    const category = integrationsSeed.find((item) => item.slug === slug)?.category;
    return category === "Chat Providers" || category === "Tools & Automation";
  }

  private providerFromSlug(slug: string): string {
    if (slug.includes("anthropic")) return "anthropic";
    if (slug.includes("openai")) return "openai";
    if (slug.includes("google")) return "google";
    if (slug.includes("xai")) return "xai";
    if (slug.includes("local")) return "local";
    return slug;
  }
}
