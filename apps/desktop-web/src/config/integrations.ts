export type IntegrationConnectType = "qr" | "api-key" | "oauth" | "self-hosted" | "none";

export type IntegrationMeta = {
  slug: string;
  category: string;
  name: string;
  shortDesc: string;
  logoPath: string;
  connectType: IntegrationConnectType;
  overview: string;
  setupSteps: string[];
  permissions: string[];
  features: string[];
  requirements?: string;
};

export const INTEGRATION_CATEGORY_TAGLINES: Record<string, string> = {
  "Chat Providers": "Message OpenClaw from any chat app — it responds right where you are.",
  "AI Models": "Use any model you want — cloud or local. Your keys, your choice.",
  Productivity: "Notes, tasks, wikis, and code — OpenClaw works with your favorite tools.",
  "Music & Audio": "Control playback, identify songs, and manage multi-room audio.",
  "Smart Home": "Lights, thermostats, and IoT devices — all voice-controllable.",
  "Tools & Automation": "Browser control, scheduled tasks, email triggers, and more.",
  "Media & Creative": "Generate images, capture screens, and find the perfect GIF.",
  Social: "Post tweets, manage email, and stay connected.",
  Platforms:
    "Run the Gateway anywhere. Use companion apps for voice, camera, and native features. Mobile access: Chat via WhatsApp/Telegram from your phone — no app install needed.",
  "Community Showcase": "Impressive integrations built by the community."
};

const M = (
  slug: string,
  category: string,
  name: string,
  shortDesc: string,
  logoPath: string,
  connectType: IntegrationConnectType,
  setupSteps: string[],
  permissions: string[],
  features: string[],
  requirements?: string
): IntegrationMeta => {
  const base: IntegrationMeta = {
    slug,
    category,
    name,
    shortDesc,
    logoPath,
    connectType,
    overview: shortDesc,
    setupSteps,
    permissions,
    features
  };
  if (requirements !== undefined) {
    base.requirements = requirements;
  }
  return base;
};

export const INTEGRATION_META_BY_SLUG: Record<string, IntegrationMeta> = {
  // Chat Providers
  whatsapp: M("whatsapp", "Chat Providers", "WhatsApp", "QR pairing via Baileys", "/assets/logos/integrations/chat-providers/whatsapp.svg", "qr", ["Open WhatsApp → Linked Devices", "Scan the pairing QR in Major Claw"], ["Read messages", "Send messages"], ["Group support", "Fast relay", "Phone-native control"]),
  telegram: M("telegram", "Chat Providers", "Telegram", "Bot API via grammY", "/assets/logos/integrations/chat-providers/telegram.svg", "api-key", ["Create bot token in BotFather", "Paste token and connect"], ["Read messages", "Send messages"], ["Group and channel support", "Bot command support", "Quick setup"]),
  discord: M("discord", "Chat Providers", "Discord", "Servers, channels & DMs", "/assets/logos/integrations/chat-providers/discord.svg", "oauth", ["Create Discord app", "Authorize server + channel scopes"], ["Read messages", "Send messages"], ["Guild and DM support", "Thread replies", "Moderation workflows"]),
  slack: M("slack", "Chat Providers", "Slack", "Workspace apps via Bolt", "/assets/logos/integrations/chat-providers/slack.svg", "oauth", ["Create Slack app", "Install to workspace"], ["Read channels", "Send messages"], ["Channel routing", "Workspace automation", "Slash-friendly"]),
  signal: M("signal", "Chat Providers", "Signal", "Privacy-focused via signal-cli", "/assets/logos/integrations/chat-providers/signal.svg", "self-hosted", ["Run signal-cli bridge", "Pair local session"], ["Send messages"], ["Private relay", "Secure workflow alerts", "Lightweight bridge"]),
  "imessage-imsg": M("imessage-imsg", "Chat Providers", "iMessage", "iMessage via imsg (AppleScript bridge)", "/assets/logos/integrations/chat-providers/imessage.svg", "self-hosted", ["Enable AppleScript bridge", "Grant automation access"], ["Message send", "Thread read"], ["macOS native channel", "AppleScript automation", "Local-first"]),
  "imessage-bluebubbles": M("imessage-bluebubbles", "Chat Providers", "iMessage", "iMessage via BlueBubbles server", "/assets/logos/integrations/chat-providers/bluebubbles.svg", "self-hosted", ["Run BlueBubbles server", "Connect bridge endpoint"], ["Message send", "Thread read"], ["Server-based setup", "Remote iMessage bridge", "Flexible topology"]),
  teams: M("teams", "Chat Providers", "Microsoft Teams", "Enterprise support", "/assets/logos/integrations/chat-providers/teams.svg", "oauth", ["Create Teams app registration", "Approve tenant scopes"], ["Read messages", "Send messages"], ["Enterprise readiness", "Tenant controls", "Policy-friendly"]),
  "nextcloud-chat": M("nextcloud-chat", "Chat Providers", "Nextcloud Talk", "Self-hosted Nextcloud chat", "/assets/logos/integrations/chat-providers/nextcloud.svg", "self-hosted", ["Set Nextcloud URL", "Provide app token"], ["Read messages", "Send messages"], ["Self-hosted collaboration", "Private deployment", "Local governance"]),
  matrix: M("matrix", "Chat Providers", "Matrix", "Matrix protocol", "/assets/logos/integrations/chat-providers/matrix.svg", "api-key", ["Set homeserver", "Sign in bot account"], ["Read messages", "Send messages"], ["Federated comms", "Open protocol", "Flexible relay"]),
  nostr: M("nostr", "Chat Providers", "Nostr", "Decentralized DMs via NIP-04", "/assets/logos/integrations/chat-providers/nostr.svg", "api-key", ["Configure relay list", "Paste keypair"], ["Read events", "Publish events"], ["Decentralized messaging", "Relay-native", "NIP-04 support"]),
  "tlon-messenger": M("tlon-messenger", "Chat Providers", "Tlon Messenger", "P2P ownership-first chat", "/assets/logos/integrations/chat-providers/tlon.svg", "self-hosted", ["Connect bridge endpoint", "Authorize account"], ["Read messages", "Send messages"], ["P2P-friendly", "Ownership-first", "Composable relay"]),
  zalo: M("zalo", "Chat Providers", "Zalo", "Zalo Bot API", "/assets/logos/integrations/chat-providers/zalo.svg", "api-key", ["Create Zalo bot app", "Paste bot token"], ["Read messages", "Send messages"], ["Bot API support", "Regional coverage", "Fast setup"]),
  "zalo-personal": M("zalo-personal", "Chat Providers", "Zalo Personal", "Personal account via QR login", "/assets/logos/integrations/chat-providers/zalopersonal.svg", "qr", ["Open secure QR panel", "Scan with personal account"], ["Read messages", "Send messages"], ["Personal account bridge", "QR onboarding", "Direct chat control"]),
  webchat: M("webchat", "Chat Providers", "WebChat", "Browser-based UI", "/assets/logos/integrations/chat-providers/webchat.svg", "none", ["Enable embedded web chat", "Open browser session"], ["Read messages", "Send messages"], ["Zero-install surface", "Browser-native", "Fast access"]),

  // AI Models
  anthropic: M("anthropic", "AI Models", "Anthropic", "Claude Pro/Max + Opus 4.5", "/assets/logos/integrations/ai-models/anthropic.svg", "api-key", ["Paste Anthropic API key", "Select default Claude model"], ["model.invoke"], ["High reasoning quality", "Long context", "Stable orchestration"]),
  openai: M("openai", "AI Models", "OpenAI", "GPT-4, GPT-5, o1", "/assets/logos/integrations/ai-models/openai.svg", "api-key", ["Paste OpenAI API key", "Select model"], ["model.invoke"], ["Broad model coverage", "Tool ecosystems", "Fast iteration"]),
  "google-gemini": M("google-gemini", "AI Models", "Google", "Gemini 2.5 Pro/Flash", "/assets/logos/integrations/ai-models/google.svg", "api-key", ["Paste Gemini key", "Choose Pro or Flash"], ["model.invoke"], ["Fast multimodal", "Large provider ecosystem", "Reliable routing"]),
  minimax: M("minimax", "AI Models", "MiniMax", "MiniMax-M2.1", "/assets/logos/integrations/ai-models/minimax.svg", "api-key", ["Paste MiniMax credentials"], ["model.invoke"], ["Alternative provider path", "Flexible costs", "Model redundancy"]),
  "xai-grok": M("xai-grok", "AI Models", "xAI", "Grok 3 & 4", "/assets/logos/integrations/ai-models/xai.svg", "api-key", ["Paste xAI API key"], ["model.invoke"], ["Alternative reasoning profile", "Provider diversification", "Live switching"]),
  "vercel-ai-gateway": M("vercel-ai-gateway", "AI Models", "Vercel AI Gateway", "Hundreds of models, 1 API key", "/assets/logos/integrations/ai-models/vercel.svg", "api-key", ["Paste Vercel AI Gateway key", "Set routing policy"], ["model.invoke", "network.http"], ["Unified provider access", "Single-key management", "Route-level control"]),
  openrouter: M("openrouter", "AI Models", "OpenRouter", "Unified API gateway", "/assets/logos/integrations/ai-models/openrouter.svg", "api-key", ["Paste OpenRouter key", "Choose preferred model route"], ["model.invoke"], ["Multi-vendor access", "Resilient fallback", "Cost flexibility"]),
  mistral: M("mistral", "AI Models", "Mistral", "Mistral Large & Codestral", "/assets/logos/integrations/ai-models/mistral.svg", "api-key", ["Paste Mistral API key"], ["model.invoke"], ["Code-capable models", "Alternative provider mix", "Fast deployment"]),
  deepseek: M("deepseek", "AI Models", "DeepSeek", "DeepSeek V3 & R1", "/assets/logos/integrations/ai-models/deepseek.svg", "api-key", ["Paste DeepSeek key"], ["model.invoke"], ["Strong coding profile", "Reasoning variants", "Lower-cost path"]),
  glm: M("glm", "AI Models", "GLM", "ChatGLM models", "/assets/logos/integrations/ai-models/glm.svg", "api-key", ["Paste GLM key"], ["model.invoke"], ["Provider diversity", "Additional fallback layer", "Regional model options"]),
  perplexity: M("perplexity", "AI Models", "Perplexity", "Search-augmented AI", "/assets/logos/integrations/ai-models/perplexity.svg", "api-key", ["Paste Perplexity key"], ["model.invoke", "network.http"], ["Web-grounded responses", "Research-friendly", "Live source workflows"]),
  huggingface: M("huggingface", "AI Models", "Hugging Face", "Open-source models", "/assets/logos/integrations/ai-models/huggingface.svg", "api-key", ["Paste Hugging Face token"], ["model.invoke"], ["Open model catalog", "Custom endpoint flexibility", "Research workflows"]),
  "local-models": M("local-models", "AI Models", "Local Models", "Ollama, LM Studio", "/assets/logos/integrations/ai-models/localmodels.svg", "self-hosted", ["Start local runtime (Ollama/LM Studio)", "Set local endpoint"], ["model.invoke"], ["Local-first privacy", "Offline-capable", "No cloud lock-in"]),

  // Productivity
  "apple-notes": M("apple-notes", "Productivity", "Apple Notes", "Native macOS/iOS notes", "/assets/logos/integrations/productivity/apple-notes.svg", "none", ["Grant notes access", "Select workspace notebook"], ["notes.write"], ["Quick note capture", "Agent summaries", "Native integration"]),
  "apple-reminders": M("apple-reminders", "Productivity", "Apple Reminders", "Task management", "/assets/logos/integrations/productivity/apple-reminders.svg", "none", ["Grant reminders access", "Pick default list"], ["tasks.write"], ["Checklist automation", "Follow-up reminders", "Native task flow"]),
  things3: M("things3", "Productivity", "Things 3", "GTD task manager", "/assets/logos/integrations/productivity/things3.svg", "none", ["Enable Things URL scheme", "Choose destination project"], ["tasks.write"], ["GTD-friendly output", "Fast capture", "Clean task routing"]),
  notion: M("notion", "Productivity", "Notion", "Workspace & databases", "/assets/logos/integrations/productivity/notion.svg", "oauth", ["Connect Notion workspace", "Grant page/database scopes"], ["notion.read", "notion.write"], ["Knowledge sync", "Structured docs", "Database workflows"]),
  obsidian: M("obsidian", "Productivity", "Obsidian", "Knowledge graph notes", "/assets/logos/integrations/productivity/obsidian.svg", "self-hosted", ["Set vault path", "Grant filesystem access"], ["filesystem.read", "filesystem.write"], ["Markdown-native", "Local vault ownership", "Knowledge graph ready"]),
  "bear-notes": M("bear-notes", "Productivity", "Bear Notes", "Markdown notes", "/assets/logos/integrations/productivity/bear.svg", "none", ["Enable Bear URL actions"], ["notes.write"], ["Fast capture", "Lightweight notes", "Markdown-friendly"]),
  trello: M("trello", "Productivity", "Trello", "Kanban boards", "/assets/logos/integrations/productivity/trello.svg", "oauth", ["Connect Trello account", "Select board"], ["tasks.read", "tasks.write"], ["Kanban automation", "Board sync", "Task lifecycle flows"]),
  github: M("github", "Productivity", "GitHub", "Code, issues, PRs", "/assets/logos/integrations/productivity/github.svg", "oauth", ["Authenticate GitHub", "Grant repo scopes"], ["git.write", "network.http"], ["PR automation", "Issue triage", "Repo-aware workflows"]),

  // Music & Audio
  spotify: M("spotify", "Music & Audio", "Spotify", "Music playback control", "/assets/logos/integrations/music-audio/spotify.svg", "oauth", ["Connect Spotify account"], ["network.http"], ["Playback commands", "Context-aware actions", "Ambient control"]),
  sonos: M("sonos", "Music & Audio", "Sonos", "Multi-room audio", "/assets/logos/integrations/music-audio/sonos.svg", "self-hosted", ["Discover Sonos devices"], ["network.http"], ["Multi-room controls", "Zone orchestration", "Realtime playback actions"]),
  shazam: M("shazam", "Music & Audio", "Shazam", "Song recognition", "/assets/logos/integrations/music-audio/shazam.svg", "none", ["Enable microphone access"], ["audio.input"], ["Song detection", "Quick identification", "Contextual media flows"]),

  // Smart Home
  "philips-hue": M("philips-hue", "Smart Home", "Philips Hue", "Smart lighting", "/assets/logos/integrations/smart-home/hue.svg", "self-hosted", ["Pair Hue bridge", "Select rooms"], ["network.http"], ["Lighting scenes", "Ambient automations", "Voice-compatible control"]),
  "8sleep": M("8sleep", "Smart Home", "8Sleep", "Smart mattress", "/assets/logos/integrations/smart-home/8sleep.svg", "oauth", ["Authenticate account"], ["network.http"], ["Sleep system actions", "Environment tuning", "Routine triggers"]),
  "home-assistant": M("home-assistant", "Smart Home", "Home Assistant", "Home automation hub", "/assets/logos/integrations/smart-home/home-assistant.svg", "self-hosted", ["Set Home Assistant URL", "Paste long-lived token"], ["network.http"], ["Whole-home orchestration", "State-aware routines", "Automation backbone"]),

  // Tools & Automation
  browser: M("browser", "Tools & Automation", "Browser", "Chrome/Chromium control", "/assets/logos/integrations/tools-automation/browser.svg", "self-hosted", ["Enable browser automation bridge"], ["browser.control"], ["Page automation", "Verification loops", "Realtime captures"]),
  canvas: M("canvas", "Tools & Automation", "Canvas", "Visual workspace + A2UI", "/assets/logos/integrations/tools-automation/canvas.svg", "none", ["Enable Canvas workspace"], ["canvas.write"], ["Visual planning", "Artifact alignment", "Shared context surface"]),
  voice: M("voice", "Tools & Automation", "Voice", "Voice Wake + Talk Mode", "/assets/logos/integrations/tools-automation/voice.svg", "none", ["Enable microphone access"], ["audio.input"], ["Hands-free control", "Wake actions", "Speech workflows"]),
  "gmail-pubsub": M("gmail-pubsub", "Tools & Automation", "Gmail", "Pub/Sub email triggers", "/assets/logos/integrations/tools-automation/gmail.svg", "oauth", ["Connect Gmail account", "Configure Pub/Sub trigger"], ["gmail.read", "gmail.send"], ["Email-triggered automation", "Realtime message intake", "Outbound workflows"]),
  cron: M("cron", "Tools & Automation", "Cron", "Scheduled tasks", "/assets/logos/integrations/tools-automation/cron.svg", "none", ["Define schedule rules"], ["scheduler.write"], ["Recurring jobs", "Always-on routines", "Background orchestration"]),
  webhooks: M("webhooks", "Tools & Automation", "Webhooks", "External triggers", "/assets/logos/integrations/tools-automation/webhooks.svg", "none", ["Create inbound webhook endpoint"], ["network.http"], ["External event intake", "Cross-system triggers", "Automated actions"]),
  "1password": M("1password", "Tools & Automation", "1Password", "Secure credentials", "/assets/logos/integrations/tools-automation/1password.svg", "oauth", ["Authenticate 1Password integration"], ["secrets.read"], ["Secure secret retrieval", "Credential governance", "Safer automation"]),
  weather: M("weather", "Tools & Automation", "Weather", "Forecasts & conditions", "/assets/logos/integrations/tools-automation/weather.svg", "api-key", ["Set weather provider key"], ["network.http"], ["Forecast lookups", "Condition-aware triggers", "Contextual planning"]),

  // Media & Creative
  "image-gen": M("image-gen", "Media & Creative", "Image Gen", "AI image generation", "/assets/logos/integrations/media-creative/image-gen.svg", "api-key", ["Pick image provider", "Set generation defaults"], ["image.generate"], ["Prompt-to-image", "Creative exploration", "Visual outputs"]),
  "gif-search": M("gif-search", "Media & Creative", "GIF Search", "Find the perfect GIF", "/assets/logos/integrations/media-creative/gif-search.svg", "api-key", ["Set GIF provider token"], ["network.http"], ["Search and embed GIFs", "Expressive chat context", "Fast media lookup"]),
  peekaboo: M("peekaboo", "Media & Creative", "Peekaboo", "Screen capture & control", "/assets/logos/integrations/media-creative/peekaboo.svg", "none", ["Grant screen recording"], ["screen.capture"], ["Screen snapshots", "Context extraction", "Visual debugging"]),
  camera: M("camera", "Media & Creative", "Camera", "Photo/video capture", "/assets/logos/integrations/media-creative/camera.svg", "none", ["Grant camera permission"], ["camera.read"], ["Live capture", "Visual inspection", "Multimodal tasks"]),

  // Social
  "twitter-x": M("twitter-x", "Social", "Twitter/X", "Tweet, reply, search", "/assets/logos/integrations/social/x.svg", "oauth", ["Connect X account"], ["network.http"], ["Post actions", "Reply workflows", "Search and monitor"]),
  email: M("email", "Social", "Email", "Send & read emails", "/assets/logos/integrations/social/email.svg", "oauth", ["Connect email provider"], ["gmail.read", "gmail.send"], ["Read inbox", "Send summaries", "Follow-up automation"]),

  // Platforms
  "macos-menu-bar": M("macos-menu-bar", "Platforms", "macOS", "Menu bar app + Voice Wake", "/assets/logos/integrations/platforms/macos.svg", "none", ["Enable menu bar integration"], ["audio.input", "notifications.write"], ["Native control center", "Voice wake", "OS-integrated workflows"]),
  ios: M("ios", "Platforms", "iOS", "Canvas, camera, Voice Wake", "/assets/logos/integrations/platforms/ios.svg", "none", ["Pair iOS companion"], ["camera.read"], ["Mobile canvas", "On-device capture", "Portable control"]),
  android: M("android", "Platforms", "Android", "Canvas, camera, screen", "/assets/logos/integrations/platforms/android.svg", "none", ["Pair Android companion"], ["screen.capture"], ["Mobile screen workflows", "Capture and relay", "Anywhere access"]),
  "windows-wsl2": M("windows-wsl2", "Platforms", "Windows", "WSL2 recommended", "/assets/logos/integrations/platforms/windows.svg", "self-hosted", ["Enable WSL2", "Install runtime bridge"], ["filesystem.read"], ["Windows deployment path", "WSL2 compatibility", "Flexible runtime"]),
  linux: M("linux", "Platforms", "Linux", "Native support", "/assets/logos/integrations/platforms/linux.svg", "self-hosted", ["Install Linux package"], ["filesystem.read"], ["Native runtime", "Self-hosted control", "Server-friendly setup"]),

  // Community
  "tesco-autopilot": M("tesco-autopilot", "Community Showcase", "Tesco Autopilot", "Automated grocery shopping", "/assets/logos/integrations/community/tesco.svg", "none", ["Review showcase setup"], ["network.http"], ["Community inspiration", "Workflow patterns", "Domain automation"]),
  "bambu-control": M("bambu-control", "Community Showcase", "Bambu Control", "3D printer management", "/assets/logos/integrations/community/bambu.svg", "none", ["Review showcase setup"], ["network.http"], ["Printer operations", "Automation examples", "Device integrations"]),
  "oura-ring": M("oura-ring", "Community Showcase", "Oura Ring", "Health data insights", "/assets/logos/integrations/community/oura.svg", "none", ["Review showcase setup"], ["health.read"], ["Health analytics", "Contextual routines", "Personal insights"]),
  "food-ordering": M("food-ordering", "Community Showcase", "Food Ordering", "Foodora integration", "/assets/logos/integrations/community/food-ordering.svg", "none", ["Review showcase setup"], ["network.http"], ["Ordering automation", "Practical assistant workflows", "Community template"])
};

export function integrationMeta(slug: string): IntegrationMeta | null {
  return INTEGRATION_META_BY_SLUG[slug] ?? null;
}

