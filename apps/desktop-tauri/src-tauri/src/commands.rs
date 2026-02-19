use crate::GatewayState;
use reqwest::header::{HeaderMap, HeaderValue};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

const GATEWAY_PORT: u16 = 4455;

#[derive(Serialize)]
pub struct GatewayStatus {
    running: bool,
    port: u16,
}

#[derive(Serialize)]
pub struct GatewayDaemonStatus {
    platform: String,
    supported: bool,
    enabled: bool,
    running: bool,
    #[serde(rename = "serviceLabel")]
    service_label: String,
    #[serde(rename = "servicePath")]
    service_path: String,
    #[serde(rename = "logHint")]
    log_hint: String,
    #[serde(rename = "lastError")]
    last_error: Option<String>,
    message: String,
}

#[derive(Serialize)]
pub struct GatewayHealth {
    status: String,
    #[serde(rename = "startedAt")]
    started_at: Option<String>,
    #[serde(rename = "instanceCount")]
    instance_count: Option<u64>,
}

#[derive(Serialize)]
pub struct RedPhoneResult {
    status: String,
    reason: String,
    timestamp: String,
    audited: bool,
    #[serde(rename = "auditLog")]
    audit_log: Option<AuditLogEntry>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AgentProfile {
    id: String,
    name: String,
    role: String,
    #[serde(rename = "modelProfileId")]
    model_profile_id: String,
    status: String,
    #[serde(rename = "parentId")]
    parent_id: Option<String>,
    #[serde(rename = "modelProvider")]
    model_provider: Option<String>,
    #[serde(rename = "modelName")]
    model_name: Option<String>,
    temperature: Option<f64>,
    #[serde(rename = "maxTokens")]
    max_tokens: Option<u32>,
    #[serde(rename = "lastHeartbeat")]
    last_heartbeat: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AgentStats {
    #[serde(rename = "agentId")]
    agent_id: String,
    #[serde(rename = "tokensToday")]
    tokens_today: u64,
    #[serde(rename = "tasksCompleted")]
    tasks_completed: u64,
    #[serde(rename = "lastUpdated")]
    last_updated: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AgentFullConfig {
    id: String,
    name: String,
    role: String,
    #[serde(rename = "modelProfileId")]
    model_profile_id: String,
    status: String,
    #[serde(rename = "parentId")]
    parent_id: Option<String>,
    #[serde(rename = "modelProvider")]
    model_provider: Option<String>,
    #[serde(rename = "modelName")]
    model_name: Option<String>,
    temperature: Option<f64>,
    #[serde(rename = "maxTokens")]
    max_tokens: Option<u32>,
    #[serde(rename = "lastHeartbeat")]
    last_heartbeat: Option<String>,
    #[serde(rename = "apiKeyMasked")]
    api_key_masked: Option<String>,
    #[serde(rename = "installedSkills")]
    installed_skills: Vec<String>,
    stats: AgentStats,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AgentCreatePayload {
    name: String,
    role: String,
    #[serde(rename = "parentId")]
    parent_id: Option<String>,
    #[serde(rename = "modelProvider")]
    model_provider: String,
    #[serde(rename = "modelName")]
    model_name: String,
    #[serde(rename = "apiKey")]
    api_key: Option<String>,
    temperature: Option<f64>,
    #[serde(rename = "maxTokens")]
    max_tokens: Option<u32>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AgentConfigPatch {
    #[serde(rename = "modelProvider")]
    model_provider: Option<String>,
    #[serde(rename = "modelName")]
    model_name: Option<String>,
    #[serde(rename = "apiKey")]
    api_key: Option<String>,
    temperature: Option<f64>,
    #[serde(rename = "maxTokens")]
    max_tokens: Option<u32>,
    status: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AgentActionResult {
    success: bool,
    message: String,
    action: String,
    #[serde(rename = "agentId")]
    agent_id: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AgentConnectionTestResult {
    ok: bool,
    message: String,
    status: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TaskRecord {
    id: String,
    title: String,
    description: Option<String>,
    status: String,
    priority: String,
    #[serde(rename = "assigneeAgentId")]
    assignee_agent_id: Option<String>,
    #[serde(rename = "parentTaskId")]
    parent_task_id: Option<String>,
    #[serde(rename = "createdAt")]
    created_at: String,
    #[serde(rename = "updatedAt")]
    updated_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TaskCreatePayload {
    title: String,
    description: Option<String>,
    status: Option<String>,
    priority: Option<String>,
    #[serde(rename = "assigneeAgentId")]
    assignee_agent_id: Option<String>,
    #[serde(rename = "parentTaskId")]
    parent_task_id: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TaskPatch {
    title: Option<String>,
    description: Option<String>,
    status: Option<String>,
    priority: Option<String>,
    #[serde(rename = "assigneeAgentId")]
    assignee_agent_id: Option<Option<String>>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct IntegrationEntry {
    slug: String,
    name: String,
    category: String,
    description: String,
    setup: Vec<String>,
    permissions: Vec<String>,
    status: String,
    #[serde(rename = "assignedAgentIds")]
    assigned_agent_ids: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct IntegrationCategoryStat {
    name: String,
    #[serde(rename = "connectedCount")]
    connected_count: u64,
    #[serde(rename = "totalCount")]
    total_count: u64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct IntegrationsListResult {
    items: Vec<IntegrationEntry>,
    categories: Vec<IntegrationCategoryStat>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct McpServerEntry {
    id: String,
    url: String,
    name: String,
    capabilities: Vec<String>,
    connected: bool,
    #[serde(rename = "approvedScopes")]
    approved_scopes: Vec<String>,
    #[serde(rename = "createdAt")]
    created_at: String,
    #[serde(rename = "lastConnectedAt")]
    last_connected_at: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct McpToolEntry {
    id: String,
    #[serde(rename = "serverId")]
    server_id: String,
    name: String,
    description: String,
    scopes: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct McpInvokeResult {
    output: String,
    #[serde(rename = "latencyMs")]
    latency_ms: u64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct VaultEntry {
    id: String,
    #[serde(rename = "type")]
    entry_type: String,
    title: String,
    #[serde(rename = "markdownSummary")]
    markdown_summary: String,
    #[serde(rename = "importanceScore")]
    importance_score: u64,
    tags: Vec<String>,
    #[serde(rename = "agentId")]
    agent_id: String,
    #[serde(rename = "taskId")]
    task_id: Option<String>,
    version: u64,
    #[serde(rename = "blobPath")]
    blob_path: Option<String>,
    #[serde(rename = "createdAt")]
    created_at: String,
    encrypted: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct VaultSummary {
    #[serde(rename = "usedGb")]
    used_gb: f64,
    #[serde(rename = "capacityGb")]
    capacity_gb: f64,
    #[serde(rename = "archivedItems")]
    archived_items: u64,
    #[serde(rename = "fileItems")]
    file_items: u64,
    #[serde(rename = "knowledgeItems")]
    knowledge_items: u64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct VaultStorageStats {
    #[serde(rename = "snapshotTime")]
    snapshot_time: String,
    #[serde(rename = "archiveGb")]
    archive_gb: f64,
    #[serde(rename = "filesGb")]
    files_gb: f64,
    #[serde(rename = "totalGb")]
    total_gb: f64,
    #[serde(rename = "freeGb")]
    free_gb: f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct VaultStorageInfo {
    #[serde(rename = "rootPath")]
    root_path: String,
    #[serde(rename = "volumeName")]
    volume_name: String,
    #[serde(rename = "totalGb")]
    total_gb: f64,
    #[serde(rename = "freeGb")]
    free_gb: f64,
    #[serde(rename = "vaultUsedGb")]
    vault_used_gb: f64,
    #[serde(rename = "isExternal")]
    is_external: bool,
    #[serde(rename = "isNetwork")]
    is_network: bool,
    #[serde(rename = "warningLevel")]
    warning_level: String,
    #[serde(rename = "isOfflineFallback")]
    is_offline_fallback: bool,
    #[serde(rename = "tempCachePath")]
    temp_cache_path: Option<String>,
    #[serde(rename = "updatedAt")]
    updated_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct VaultVersion {
    #[serde(rename = "entryId")]
    entry_id: String,
    #[serde(rename = "versionNum")]
    version_num: u64,
    #[serde(rename = "blobPath")]
    blob_path: Option<String>,
    diff: Option<String>,
    #[serde(rename = "createdAt")]
    created_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ConnectedModelProvider {
    provider: String,
    label: String,
    #[serde(rename = "modelHint")]
    model_hint: String,
}

#[derive(Serialize, Deserialize)]
pub struct ClawHubSkill {
    slug: String,
    name: String,
    author: String,
    description: String,
    downloads: u64,
    stars: Option<u64>,
    version: String,
    categories: Vec<String>,
    permissions: Vec<String>,
    installed: bool,
}

#[derive(Serialize, Deserialize)]
pub struct ClawHubLiveSkillsResult {
    skills: Vec<ClawHubSkill>,
    #[serde(rename = "nextCursor")]
    next_cursor: Option<String>,
    source: String,
}

#[derive(Serialize, Deserialize)]
pub struct ClawHubInstallResult {
    slug: String,
    installed: bool,
    #[serde(rename = "assignedAgentId")]
    assigned_agent_id: Option<String>,
    message: String,
    #[serde(rename = "requestedPermissionIds")]
    requested_permission_ids: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PermissionGrant {
    id: String,
    #[serde(rename = "agentId")]
    agent_id: String,
    capability: String,
    granted: bool,
    #[serde(rename = "createdAt")]
    created_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AuditLogEntry {
    id: String,
    category: String,
    action: String,
    actor: String,
    metadata: serde_json::Value,
    #[serde(rename = "createdAt")]
    created_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SwarmChatThread {
    id: String,
    title: String,
    #[serde(rename = "createdAt")]
    created_at: String,
    #[serde(rename = "updatedAt")]
    updated_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SwarmChatMessage {
    id: String,
    #[serde(rename = "threadId")]
    thread_id: String,
    #[serde(rename = "type")]
    message_type: String,
    author: String,
    content: String,
    #[serde(rename = "createdAt")]
    created_at: String,
    #[serde(rename = "parentMessageId")]
    parent_message_id: Option<String>,
    metadata: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SwarmSummary {
    #[serde(rename = "onlineAgents")]
    online_agents: u64,
    #[serde(rename = "activeTasks")]
    active_tasks: u64,
    #[serde(rename = "spendTodayUsd")]
    spend_today_usd: f64,
    heartbeat: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CheckpointRecord {
    id: String,
    #[serde(rename = "swarmId")]
    swarm_id: String,
    step: u64,
    #[serde(rename = "stateJson")]
    state_json: String,
    #[serde(rename = "promptSnapshot")]
    prompt_snapshot: Option<String>,
    #[serde(rename = "createdAt")]
    created_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AgentBudget {
    #[serde(rename = "agentId")]
    agent_id: String,
    #[serde(rename = "tokenLimit")]
    token_limit: u64,
    #[serde(rename = "costLimitUsd")]
    cost_limit_usd: f64,
    #[serde(rename = "currentTokens")]
    current_tokens: u64,
    #[serde(rename = "currentCostUsd")]
    current_cost_usd: f64,
    #[serde(rename = "hardKill")]
    hard_kill: bool,
    #[serde(rename = "updatedAt")]
    updated_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct BudgetSnapshot {
    global: AgentBudget,
    agents: Vec<AgentBudget>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct HealthSnapshot {
    heartbeat: String,
    #[serde(rename = "uptimeSeconds")]
    uptime_seconds: u64,
    #[serde(rename = "gatewayStatus")]
    gateway_status: String,
    #[serde(rename = "activeAgents")]
    active_agents: u64,
    #[serde(rename = "totalAgents")]
    total_agents: u64,
    #[serde(rename = "errorAgents")]
    error_agents: u64,
    #[serde(rename = "pendingApprovals")]
    pending_approvals: u64,
    #[serde(rename = "spendTodayUsd")]
    spend_today_usd: f64,
    #[serde(rename = "vaultUsedGb")]
    vault_used_gb: f64,
    #[serde(rename = "vaultCapacityGb")]
    vault_capacity_gb: f64,
    #[serde(rename = "vaultUsagePct")]
    vault_usage_pct: f64,
    alerts: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct HealthTelemetryEvent {
    id: String,
    category: String,
    severity: String,
    source: String,
    message: String,
    metadata: serde_json::Value,
    #[serde(rename = "createdAt")]
    created_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TelemetryExportResult {
    format: String,
    #[serde(rename = "generatedAt")]
    generated_at: String,
    payload: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AnalyticsSnapshot {
    range: String,
    kpis: serde_json::Value,
    trends: serde_json::Value,
    #[serde(rename = "perAgent")]
    per_agent: serde_json::Value,
    forecasts: serde_json::Value,
    recommendations: Vec<String>,
    #[serde(rename = "generatedAt")]
    generated_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AnalyticsExportResult {
    range: String,
    format: String,
    #[serde(rename = "generatedAt")]
    generated_at: String,
    payload: String,
}

fn gateway_base_url() -> String {
    format!("http://127.0.0.1:{GATEWAY_PORT}")
}

fn gateway_session_token_value() -> String {
    std::env::var("MAJORCLAW_GATEWAY_SESSION_TOKEN").unwrap_or_else(|_| "majorclaw-dev-session-token".to_string())
}

fn gateway_client() -> reqwest::Client {
    let mut headers = HeaderMap::new();
    if let Ok(token_value) = HeaderValue::from_str(&gateway_session_token_value()) {
        headers.insert("x-session-token", token_value);
    }
    reqwest::Client::builder()
        .default_headers(headers)
        .build()
        .unwrap_or_else(|_| gateway_client())
}

async fn gateway_get(url: String) -> Result<reqwest::Response, reqwest::Error> {
    gateway_client().get(url).send().await
}

fn workspace_root() -> PathBuf {
    if let Ok(explicit_root) = std::env::var("MAJORCLAW_WORKSPACE_ROOT") {
        return PathBuf::from(explicit_root);
    }
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .and_then(|p| p.parent())
        .map(|p| p.to_path_buf())
        .unwrap_or(manifest_dir)
}

fn resolve_pnpm_path() -> PathBuf {
    let root = workspace_root();
    let local = root
        .join("node_modules")
        .join(".bin")
        .join(if cfg!(windows) { "pnpm.cmd" } else { "pnpm" });
    if local.exists() {
        return local;
    }
    for candidate in ["/opt/homebrew/bin/pnpm", "/usr/local/bin/pnpm", "/usr/bin/pnpm"] {
        let path = PathBuf::from(candidate);
        if path.exists() {
            return path;
        }
    }
    PathBuf::from("pnpm")
}

fn macos_launch_agent_label() -> &'static str {
    "com.jonnycatx.major-claw.gateway"
}

fn macos_launch_agent_path() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "HOME is not set".to_string())?;
    Ok(PathBuf::from(home)
        .join("Library")
        .join("LaunchAgents")
        .join(format!("{}.plist", macos_launch_agent_label())))
}

fn render_macos_launch_agent_plist() -> String {
    let root = workspace_root();
    let root_display = root.to_string_lossy();
    let pnpm_display = resolve_pnpm_path().to_string_lossy().to_string();
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>{label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>{pnpm}</string>
    <string>--filter</string>
    <string>@majorclaw/gateway</string>
    <string>start</string>
  </array>
  <key>WorkingDirectory</key>
  <string>{cwd}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>{home}/Library/Logs/MajorClaw/stdout.log</string>
  <key>StandardErrorPath</key>
  <string>{home}/Library/Logs/MajorClaw/stderr.log</string>
</dict>
</plist>
"#,
        label = macos_launch_agent_label(),
        cwd = root_display,
        pnpm = pnpm_display,
        home = std::env::var("HOME").unwrap_or_else(|_| "~".to_string())
    )
}

fn launchctl_target() -> Result<String, String> {
    let output = Command::new("id")
        .arg("-u")
        .output()
        .map_err(|err| format!("failed to read uid: {err}"))?;
    if !output.status.success() {
        return Err("failed to resolve uid for launchctl target".to_string());
    }
    let uid = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(format!("gui/{uid}"))
}

fn linux_systemd_label() -> &'static str {
    "major-claw-gateway"
}

fn linux_systemd_service_path() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "HOME is not set".to_string())?;
    Ok(PathBuf::from(home)
        .join(".config")
        .join("systemd")
        .join("user")
        .join(format!("{}.service", linux_systemd_label())))
}

fn render_linux_systemd_service() -> String {
    let root = workspace_root().to_string_lossy().to_string();
    format!(
        "[Unit]\nDescription=Major Claw Gateway\nAfter=network.target\n\n[Service]\nType=simple\nWorkingDirectory={root}\nExecStart=/usr/bin/env pnpm --filter @majorclaw/gateway start\nRestart=always\nRestartSec=3\nEnvironment=NODE_ENV=production\n\n[Install]\nWantedBy=default.target\n",
        root = root
    )
}

fn windows_service_label() -> &'static str {
    "MajorClawGateway"
}

fn windows_install_script_path() -> PathBuf {
    workspace_root()
        .join("ops")
        .join("windows")
        .join("install-gateway-service.ps1")
}

fn daemon_status_unsupported(os: String, message: String) -> GatewayDaemonStatus {
    GatewayDaemonStatus {
        platform: os,
        supported: false,
        enabled: false,
        running: false,
        service_label: String::new(),
        service_path: String::new(),
        log_hint: String::new(),
        last_error: None,
        message,
    }
}

fn parse_sc_running(output: &str) -> bool {
    let lower = output.to_lowercase();
    lower.contains("state") && lower.contains("running")
}

fn parse_sc_enabled(output: &str) -> bool {
    let lower = output.to_lowercase();
    lower.contains("start_type") && (lower.contains("auto_start") || lower.contains("auto start"))
}

fn daemon_status_for_macos() -> Result<GatewayDaemonStatus, String> {
    let path = macos_launch_agent_path()?;
    let enabled = path.exists();
    let target = launchctl_target()?;
    let label = format!("{}/{}", target, macos_launch_agent_label());
    let print_output = Command::new("launchctl").args(["print", &label]).output();
    let (running, last_error, message) = match print_output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let is_running = stdout.contains("state = running") || stdout.contains("pid =");
            (
                is_running,
                None,
                if enabled {
                    "Always-on launch agent is enabled.".to_string()
                } else {
                    "Always-on launch agent is disabled.".to_string()
                },
            )
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            (
                false,
                if stderr.is_empty() { None } else { Some(stderr.clone()) },
                if enabled {
                    "Launch agent is enabled but not currently running.".to_string()
                } else {
                    "Always-on launch agent is disabled.".to_string()
                },
            )
        }
        Err(err) => (
            false,
            Some(err.to_string()),
            if enabled {
                "Launch agent is enabled but launchctl status could not be read.".to_string()
            } else {
                "Always-on launch agent is disabled.".to_string()
            },
        ),
    };
    Ok(GatewayDaemonStatus {
        platform: "macos".to_string(),
        supported: true,
        enabled,
        running,
        service_label: macos_launch_agent_label().to_string(),
        service_path: path.to_string_lossy().to_string(),
        log_hint: "$HOME/Library/Logs/MajorClaw/stdout.log".to_string(),
        last_error,
        message,
    })
}

fn daemon_status_for_linux() -> Result<GatewayDaemonStatus, String> {
    let path = linux_systemd_service_path()?;
    let label = linux_systemd_label().to_string();
    let enabled_output = Command::new("systemctl")
        .args(["--user", "is-enabled", linux_systemd_label()])
        .output();
    let active_output = Command::new("systemctl")
        .args(["--user", "is-active", linux_systemd_label()])
        .output();
    let enabled = enabled_output.as_ref().is_ok_and(|output| output.status.success());
    let running = active_output.as_ref().is_ok_and(|output| output.status.success());
    let last_error = active_output
        .ok()
        .map(|out| String::from_utf8_lossy(&out.stderr).trim().to_string())
        .filter(|value| !value.is_empty());
    Ok(GatewayDaemonStatus {
        platform: "linux".to_string(),
        supported: true,
        enabled,
        running,
        service_label: label,
        service_path: path.to_string_lossy().to_string(),
        log_hint: format!("journalctl --user -u {} -f", linux_systemd_label()),
        last_error,
        message: if enabled {
            "Systemd user service is enabled.".to_string()
        } else {
            "Systemd user service is disabled.".to_string()
        },
    })
}

fn daemon_status_for_windows() -> Result<GatewayDaemonStatus, String> {
    let script = windows_install_script_path();
    let query_output = Command::new("sc")
        .args(["query", windows_service_label()])
        .output();
    let config_output = Command::new("sc")
        .args(["qc", windows_service_label()])
        .output();
    let query_stdout = query_output
        .as_ref()
        .ok()
        .map(|out| String::from_utf8_lossy(&out.stdout).to_string())
        .unwrap_or_default();
    let config_stdout = config_output
        .as_ref()
        .ok()
        .map(|out| String::from_utf8_lossy(&out.stdout).to_string())
        .unwrap_or_default();
    let enabled = parse_sc_enabled(&config_stdout);
    let running = parse_sc_running(&query_stdout);
    let last_error = query_output
        .ok()
        .map(|out| String::from_utf8_lossy(&out.stderr).trim().to_string())
        .filter(|value| !value.is_empty());
    Ok(GatewayDaemonStatus {
        platform: "windows".to_string(),
        supported: true,
        enabled,
        running,
        service_label: windows_service_label().to_string(),
        service_path: script.to_string_lossy().to_string(),
        log_hint: format!(
            "PowerShell: Get-WinEvent -LogName Application | Where-Object {{$_.ProviderName -like '*{}*'}} -MaxEvents 50",
            windows_service_label()
        ),
        last_error,
        message: if enabled {
            "Windows service is installed.".to_string()
        } else {
            "Windows service is not installed.".to_string()
        },
    })
}

fn ensure_gateway_session_token() -> String {
    if let Ok(existing) = std::env::var("MAJORCLAW_GATEWAY_SESSION_TOKEN") {
        if !existing.trim().is_empty() {
            return existing;
        }
    }
    let generated = format!(
        "mc-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|value| value.as_nanos())
            .unwrap_or_default()
    );
    std::env::set_var("MAJORCLAW_GATEWAY_SESSION_TOKEN", generated.clone());
    generated
}

#[tauri::command]
pub fn open_official_integrations(app: AppHandle, fragment: Option<String>) -> Result<(), String> {
    let label = "official-integrations";
    let url = match fragment {
        Some(value) if !value.trim().is_empty() => {
            format!("https://openclaw.ai/integrations#{}", urlencoding::encode(value.trim()))
        }
        _ => "https://openclaw.ai/integrations".to_string(),
    };
    if let Some(window) = app.get_webview_window(label) {
        let escaped_url = serde_json::to_string(&url).map_err(|err| format!("url encode failed: {err}"))?;
        window
            .eval(&format!("window.location.href = {escaped_url};"))
            .map_err(|err| format!("failed to update official integrations url: {err}"))?;
        window.show().map_err(|err| format!("failed to show official integrations window: {err}"))?;
        window.set_focus().map_err(|err| format!("failed to focus official integrations window: {err}"))?;
        // Re-inject navigation handler when reusing existing window
        inject_navigation_handler(&window)?;
        return Ok(());
    }
    WebviewWindowBuilder::new(&app, label, WebviewUrl::External(url.parse().map_err(|err| format!("invalid integrations url: {err}"))?))
        .title("Official OpenClaw Integrations")
        .inner_size(1240.0, 920.0)
        .center()
        .decorations(true)
        .build()
        .map_err(|err| format!("failed to open official integrations window: {err}"))?;
    
    // Inject JavaScript to handle link clicks and keep navigation within the same window
    // The script will wait for DOM ready, so we can inject after a short delay
    let app_handle = app.clone();
    let label_clone = label.to_string();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(800));
        if let Some(window) = app_handle.get_webview_window(&label_clone) {
            let _ = inject_navigation_handler(&window);
        }
    });
    
    Ok(())
}

#[tauri::command]
pub fn close_official_integrations(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("official-integrations") {
        window
            .close()
            .map_err(|err| format!("failed to close official integrations window: {err}"))?;
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
pub fn back_official_integrations(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("official-integrations") {
        window
            .eval(
                "if (window.history.length > 1) { window.history.back(); } else { window.location.href = 'https://openclaw.ai/integrations'; }",
            )
            .map_err(|err| format!("failed to navigate back in official integrations window: {err}"))?;
        window
            .show()
            .map_err(|err| format!("failed to show official integrations window: {err}"))?;
        window
            .set_focus()
            .map_err(|err| format!("failed to focus official integrations window: {err}"))?;
        return Ok(true);
    }
    Ok(false)
}

fn inject_navigation_handler(window: &tauri::WebviewWindow) -> Result<(), String> {
    // JavaScript to intercept all link clicks and ensure they navigate within the same window
    let script = r#"
        (function() {
            // Function to intercept link clicks
            function interceptLinks() {
                // Remove existing listeners to avoid duplicates
                document.removeEventListener('click', handleLinkClick, true);
                
                // Add click listener to intercept all link clicks
                function handleLinkClick(e) {
                    const link = e.target.closest('a');
                    if (!link) return;
                    
                    const href = link.getAttribute('href');
                    if (!href) return;
                    
                    // Allow hash-only navigation (tabs/sections)
                    if (href.startsWith('#')) {
                        return; // Let default behavior handle hash navigation
                    }
                    
                    // For external links or links that would open in new window
                    if (link.target === '_blank' || link.hasAttribute('target')) {
                        e.preventDefault();
                        e.stopPropagation();
                        // Navigate in same window instead
                        window.location.href = href;
                        return false;
                    }
                    
                    // For same-domain links, ensure they navigate in same window
                    try {
                        const url = new URL(href, window.location.href);
                        if (url.hostname === window.location.hostname || url.hostname === 'openclaw.ai') {
                            // Same domain - navigate in same window
                            if (url.pathname !== window.location.pathname || url.hash !== window.location.hash) {
                                e.preventDefault();
                                e.stopPropagation();
                                window.location.href = href;
                                return false;
                            }
                        }
                    } catch (err) {
                        // Relative URL or invalid URL - allow default behavior
                    }
                }
                
                // Use capture phase to catch links before they bubble
                document.addEventListener('click', handleLinkClick, true);
                
                // Also intercept programmatic navigation
                const originalPushState = history.pushState;
                const originalReplaceState = history.replaceState;
                
                history.pushState = function(...args) {
                    originalPushState.apply(history, args);
                    // Trigger any custom navigation handlers
                    window.dispatchEvent(new PopStateEvent('popstate'));
                };
                
                history.replaceState = function(...args) {
                    originalReplaceState.apply(history, args);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                };
            }
            
            // Inject immediately if DOM is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', interceptLinks);
            } else {
                interceptLinks();
            }
            
            // Re-inject after navigation (for SPA-style navigation)
            let lastUrl = window.location.href;
            const checkNavigation = setInterval(() => {
                if (window.location.href !== lastUrl) {
                    lastUrl = window.location.href;
                    setTimeout(interceptLinks, 100);
                }
            }, 100);
            
            // Clean up interval when page unloads
            window.addEventListener('beforeunload', () => {
                clearInterval(checkNavigation);
            });
        })();
    "#;
    
    window
        .eval(script)
        .map_err(|err| format!("failed to inject navigation handler: {err}"))?;
    
    Ok(())
}

fn start_gateway_inner(state: &GatewayState) -> Result<GatewayStatus, String> {
    let mut guard = state.child.lock().map_err(|_| "gateway state lock poisoned".to_string())?;
    if let Some(existing) = guard.as_mut() {
        match existing.try_wait() {
            Ok(None) => {
                return Ok(GatewayStatus {
                    running: true,
                    port: GATEWAY_PORT,
                })
            }
            Ok(Some(_)) => {
                *guard = None;
            }
            Err(err) => return Err(format!("failed to inspect gateway process: {err}")),
        }
    }

    let token = ensure_gateway_session_token();
    let child = Command::new(resolve_pnpm_path())
        .args(["--filter", "@majorclaw/gateway", "dev:server"])
        .env("MAJORCLAW_GATEWAY_SESSION_TOKEN", token)
        .env("MAJORCLAW_GATEWAY_OWNER_PID", std::process::id().to_string())
        .current_dir(workspace_root())
        .spawn()
        .map_err(|err| format!("failed to start gateway: {err}"))?;

    *guard = Some(child);
    Ok(GatewayStatus {
        running: true,
        port: GATEWAY_PORT,
    })
}

pub fn auto_start_gateway(state: &GatewayState) -> Result<GatewayStatus, String> {
    start_gateway_inner(state)
}

#[tauri::command]
pub fn gateway_daemon_status() -> Result<GatewayDaemonStatus, String> {
    let os = std::env::consts::OS.to_string();
    match os.as_str() {
        "macos" => daemon_status_for_macos(),
        "linux" => daemon_status_for_linux(),
        "windows" => daemon_status_for_windows(),
        _ => Ok(daemon_status_unsupported(
            os,
            "Always-on service toggle is not supported on this platform.".to_string(),
        )),
    }
}

#[tauri::command]
pub fn gateway_daemon_set_enabled(enabled: bool) -> Result<GatewayDaemonStatus, String> {
    match std::env::consts::OS {
        "macos" => {
            let path = macos_launch_agent_path()?;
            if enabled {
                if let Some(parent) = path.parent() {
                    fs::create_dir_all(parent)
                        .map_err(|err| format!("failed to create launch agents directory: {err}"))?;
                }
                let logs_dir = PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "~".to_string()))
                    .join("Library")
                    .join("Logs")
                    .join("MajorClaw");
                fs::create_dir_all(logs_dir).map_err(|err| format!("failed to create logs directory: {err}"))?;
                fs::write(&path, render_macos_launch_agent_plist())
                    .map_err(|err| format!("failed to write launch agent plist: {err}"))?;
                let target = launchctl_target()?;
                let _ = Command::new("launchctl")
                    .args(["bootout", &target, &path.to_string_lossy()])
                    .status();
                let bootstrap = Command::new("launchctl")
                    .args(["bootstrap", &target, &path.to_string_lossy()])
                    .status()
                    .map_err(|err| format!("failed to bootstrap launch agent: {err}"))?;
                if !bootstrap.success() {
                    return Err("launchctl bootstrap failed".to_string());
                }
                let _ = Command::new("launchctl")
                    .args(["kickstart", "-k", &format!("{}/{}", target, macos_launch_agent_label())])
                    .status();
            } else if path.exists() {
                let target = launchctl_target()?;
                let _ = Command::new("launchctl")
                    .args(["bootout", &target, &path.to_string_lossy()])
                    .status();
                let _ = fs::remove_file(&path);
            }
            gateway_daemon_status()
        }
        "linux" => {
            let path = linux_systemd_service_path()?;
            if enabled {
                if let Some(parent) = path.parent() {
                    fs::create_dir_all(parent).map_err(|err| format!("failed to create systemd user directory: {err}"))?;
                }
                fs::write(&path, render_linux_systemd_service())
                    .map_err(|err| format!("failed to write systemd unit file: {err}"))?;
                let _ = Command::new("systemctl").args(["--user", "daemon-reload"]).status();
                let result = Command::new("systemctl")
                    .args(["--user", "enable", "--now", linux_systemd_label()])
                    .status()
                    .map_err(|err| format!("failed to enable systemd service: {err}"))?;
                if !result.success() {
                    return Err(
                        "systemd enable --now failed (ensure user services are available; loginctl enable-linger may be required)"
                            .to_string(),
                    );
                }
            } else {
                let _ = Command::new("systemctl")
                    .args(["--user", "disable", "--now", linux_systemd_label()])
                    .status();
                if path.exists() {
                    let _ = fs::remove_file(&path);
                }
                let _ = Command::new("systemctl").args(["--user", "daemon-reload"]).status();
            }
            gateway_daemon_status()
        }
        "windows" => {
            if enabled {
                let script = windows_install_script_path();
                if !script.exists() {
                    return Err(format!("Windows install script not found at {}", script.to_string_lossy()));
                }
                let script_path = script.to_string_lossy().to_string();
                let result = Command::new("powershell")
                    .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script_path.as_str()])
                    .status()
                    .map_err(|err| format!("failed to execute Windows service install script: {err}"))?;
                if !result.success() {
                    return Err("Windows service install script failed (admin rights may be required)".to_string());
                }
            } else {
                let _ = Command::new("sc").args(["stop", windows_service_label()]).status();
                let _ = Command::new("sc").args(["delete", windows_service_label()]).status();
            }
            gateway_daemon_status()
        }
        _ => gateway_daemon_status(),
    }
}

#[tauri::command]
pub fn gateway_daemon_start() -> Result<GatewayDaemonStatus, String> {
    match std::env::consts::OS {
        "macos" => {
            let target = launchctl_target()?;
            let status = Command::new("launchctl")
                .args(["kickstart", "-k", &format!("{}/{}", target, macos_launch_agent_label())])
                .status()
                .map_err(|err| format!("failed to start launch agent: {err}"))?;
            if !status.success() {
                return Err("launchctl kickstart failed".to_string());
            }
            gateway_daemon_status()
        }
        "linux" => {
            let status = Command::new("systemctl")
                .args(["--user", "start", linux_systemd_label()])
                .status()
                .map_err(|err| format!("failed to start systemd service: {err}"))?;
            if !status.success() {
                return Err("systemctl --user start failed".to_string());
            }
            gateway_daemon_status()
        }
        "windows" => {
            let status = Command::new("sc")
                .args(["start", windows_service_label()])
                .status()
                .map_err(|err| format!("failed to start windows service: {err}"))?;
            if !status.success() {
                return Err("sc start failed".to_string());
            }
            gateway_daemon_status()
        }
        _ => gateway_daemon_status(),
    }
}

#[tauri::command]
pub fn gateway_daemon_stop() -> Result<GatewayDaemonStatus, String> {
    match std::env::consts::OS {
        "macos" => {
            let target = launchctl_target()?;
            let path = macos_launch_agent_path()?;
            let _ = Command::new("launchctl")
                .args(["bootout", &target, &path.to_string_lossy()])
                .status();
            let _ = Command::new("launchctl")
                .args(["bootstrap", &target, &path.to_string_lossy()])
                .status();
            let _ = Command::new("launchctl")
                .args(["kill", "SIGTERM", &format!("{}/{}", target, macos_launch_agent_label())])
                .status();
            gateway_daemon_status()
        }
        "linux" => {
            let _ = Command::new("systemctl")
                .args(["--user", "stop", linux_systemd_label()])
                .status();
            gateway_daemon_status()
        }
        "windows" => {
            let _ = Command::new("sc").args(["stop", windows_service_label()]).status();
            gateway_daemon_status()
        }
        _ => gateway_daemon_status(),
    }
}

#[tauri::command]
pub fn gateway_daemon_restart() -> Result<GatewayDaemonStatus, String> {
    match std::env::consts::OS {
        "macos" => {
            let target = launchctl_target()?;
            let status = Command::new("launchctl")
                .args(["kickstart", "-k", &format!("{}/{}", target, macos_launch_agent_label())])
                .status()
                .map_err(|err| format!("failed to restart launch agent: {err}"))?;
            if !status.success() {
                return Err("launchctl kickstart failed".to_string());
            }
            gateway_daemon_status()
        }
        "linux" => {
            let status = Command::new("systemctl")
                .args(["--user", "restart", linux_systemd_label()])
                .status()
                .map_err(|err| format!("failed to restart systemd service: {err}"))?;
            if !status.success() {
                return Err("systemctl --user restart failed".to_string());
            }
            gateway_daemon_status()
        }
        "windows" => {
            let _ = Command::new("sc").args(["stop", windows_service_label()]).status();
            let status = Command::new("sc")
                .args(["start", windows_service_label()])
                .status()
                .map_err(|err| format!("failed to restart windows service: {err}"))?;
            if !status.success() {
                return Err("sc start failed".to_string());
            }
            gateway_daemon_status()
        }
        _ => gateway_daemon_status(),
    }
}

async fn request_gateway_shutdown(reason: &str, actor: &str) -> Result<(), String> {
    let client = gateway_client();
    client
        .post(format!("{}/system/shutdown", gateway_base_url()))
        .json(&serde_json::json!({
            "reason": reason,
            "actor": actor
        }))
        .send()
        .await
        .map_err(|err| format!("failed to request gateway shutdown: {err}"))?;
    Ok(())
}

async fn wait_for_process_exit(child: &mut std::process::Child, timeout_ms: u64) -> Result<bool, String> {
    let started = std::time::Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => return Ok(true),
            Ok(None) => {
                if started.elapsed().as_millis() as u64 >= timeout_ms {
                    return Ok(false);
                }
                tokio::time::sleep(std::time::Duration::from_millis(120)).await;
            }
            Err(err) => return Err(format!("failed to inspect gateway process: {err}")),
        }
    }
}

async fn stop_gateway_process(
    state: &GatewayState,
    reason: &str,
    actor: &str,
    graceful_timeout_ms: u64,
    kill_timeout_ms: u64,
) -> Result<bool, String> {
    let maybe_child = {
        let mut guard = state
            .child
            .lock()
            .map_err(|_| "gateway state lock poisoned".to_string())?;
        guard.take()
    };
    let mut child = if let Some(child) = maybe_child {
        child
    } else {
        return Ok(false);
    };

    let _ = request_gateway_shutdown(reason, actor).await;
    let exited = wait_for_process_exit(&mut child, graceful_timeout_ms).await?;
    if !exited {
        let _ = child.kill();
        let _ = wait_for_process_exit(&mut child, kill_timeout_ms).await;
    }
    let _ = child.wait();
    Ok(true)
}

#[tauri::command]
pub fn start_gateway(state: State<'_, GatewayState>) -> Result<GatewayStatus, String> {
    state
        .desired_running
        .store(true, std::sync::atomic::Ordering::SeqCst);
    start_gateway_inner(state.inner())
}

#[tauri::command]
pub async fn stop_gateway(state: State<'_, GatewayState>) -> Result<GatewayStatus, String> {
    state
        .desired_running
        .store(false, std::sync::atomic::Ordering::SeqCst);
    let _ = stop_gateway_process(state.inner(), "manual_stop", "user", 8_500, 1_500).await?;
    Ok(GatewayStatus {
        running: false,
        port: GATEWAY_PORT,
    })
}

pub async fn stop_gateway_for_exit(state: &GatewayState) -> Result<GatewayStatus, String> {
    state
        .desired_running
        .store(false, std::sync::atomic::Ordering::SeqCst);
    let _ = stop_gateway_process(state, "app_exit", "app", 8_500, 1_500).await?;
    Ok(GatewayStatus {
        running: false,
        port: GATEWAY_PORT,
    })
}

#[tauri::command]
pub async fn red_phone_shutdown(state: State<'_, GatewayState>, reason: String) -> Result<RedPhoneResult, String> {
    let note = reason.trim();
    if note.is_empty() {
        return Err("red phone requires a reason".to_string());
    }
    let client = gateway_client();
    let mut audited = false;
    let mut audit_log: Option<AuditLogEntry> = None;
    if let Ok(response) = client
        .post(format!("{}/system/red-phone", gateway_base_url()))
        .json(&serde_json::json!({
            "reason": note,
            "actor": "user"
        }))
        .send()
        .await
    {
        if let Ok(payload) = response.json::<serde_json::Value>().await {
            let maybe_log = payload.get("log").cloned().unwrap_or(serde_json::Value::Null);
            if !maybe_log.is_null() {
                if let Ok(parsed) = serde_json::from_value::<AuditLogEntry>(maybe_log) {
                    audited = true;
                    audit_log = Some(parsed);
                }
            }
        }
    }
    state
        .desired_running
        .store(false, std::sync::atomic::Ordering::SeqCst);
    let shutdown_reason = format!("red_phone:{note}");
    let _ = stop_gateway_process(state.inner(), &shutdown_reason, "user", 1_500, 1_500).await?;
    let timestamp = format!("{:?}", std::time::SystemTime::now());
    Ok(RedPhoneResult {
        status: "stopped".to_string(),
        reason: note.to_string(),
        timestamp,
        audited,
        audit_log,
    })
}

#[tauri::command]
pub fn gateway_status(state: State<'_, GatewayState>) -> Result<GatewayStatus, String> {
    let mut guard = state.child.lock().map_err(|_| "gateway state lock poisoned".to_string())?;
    let running = match guard.as_mut() {
        Some(child) => match child.try_wait() {
            Ok(None) => true,
            Ok(Some(_)) => {
                *guard = None;
                false
            }
            Err(err) => return Err(format!("failed to inspect gateway process: {err}")),
        },
        None => false,
    };

    Ok(GatewayStatus {
        running,
        port: GATEWAY_PORT,
    })
}

#[tauri::command]
pub fn gateway_session_token() -> Result<String, String> {
    Ok(ensure_gateway_session_token())
}

#[tauri::command]
pub async fn gateway_health() -> Result<GatewayHealth, String> {
    let response = gateway_get(format!("{}/health", gateway_base_url()))
        .await
        .map_err(|err| format!("gateway health request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("gateway health decode failed: {err}"))?;

    Ok(GatewayHealth {
        status: payload
            .get("status")
            .and_then(|value| value.as_str())
            .unwrap_or("unknown")
            .to_string(),
        started_at: payload
            .get("startedAt")
            .and_then(|value| value.as_str())
            .map(|value| value.to_string()),
        instance_count: payload.get("instanceCount").and_then(|value| value.as_u64()),
    })
}

#[tauri::command]
pub async fn clawhub_search(query: String, sort: String) -> Result<Vec<ClawHubSkill>, String> {
    let url = format!(
        "{}/clawhub/search?query={}&sort={}",
        gateway_base_url(),
        urlencoding::encode(&query),
        urlencoding::encode(&sort)
    );
    let response = gateway_get(url)
        .await
        .map_err(|err| format!("clawhub search request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("clawhub search decode failed: {err}"))?;
    let skills = payload
        .get("skills")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(skills).map_err(|err| format!("clawhub search parse failed: {err}"))
}

#[tauri::command]
pub async fn list_agents() -> Result<Vec<AgentProfile>, String> {
    let response = gateway_get(format!("{}/agents", gateway_base_url()))
        .await
        .map_err(|err| format!("agents request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("agents decode failed: {err}"))?;
    let agents = payload
        .get("agents")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(agents).map_err(|err| format!("agents parse failed: {err}"))
}

#[tauri::command]
pub async fn list_tasks() -> Result<Vec<TaskRecord>, String> {
    let response = gateway_get(format!("{}/tasks", gateway_base_url()))
        .await
        .map_err(|err| format!("tasks request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("tasks decode failed: {err}"))?;
    let tasks = payload
        .get("tasks")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(tasks).map_err(|err| format!("tasks parse failed: {err}"))
}

#[tauri::command]
pub async fn create_task(payload: TaskCreatePayload) -> Result<TaskRecord, String> {
    let client = gateway_client();
    let response = client
        .post(format!("{}/tasks/create", gateway_base_url()))
        .json(&serde_json::json!({
            "title": payload.title,
            "description": payload.description,
            "status": payload.status,
            "priority": payload.priority,
            "assignee_agent_id": payload.assignee_agent_id,
            "parent_task_id": payload.parent_task_id
        }))
        .send()
        .await
        .map_err(|err| format!("create task request failed: {err}"))?;
    let parsed = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("create task decode failed: {err}"))?;
    let task = parsed
        .get("task")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(task).map_err(|err| format!("create task parse failed: {err}"))
}

#[tauri::command]
pub async fn update_task(task_id: String, patch: TaskPatch) -> Result<TaskRecord, String> {
    let client = gateway_client();
    let mut patch_payload = serde_json::Map::new();
    if let Some(title) = patch.title {
        patch_payload.insert("title".to_string(), serde_json::Value::String(title));
    }
    if let Some(description) = patch.description {
        patch_payload.insert("description".to_string(), serde_json::Value::String(description));
    }
    if let Some(status) = patch.status {
        patch_payload.insert("status".to_string(), serde_json::Value::String(status));
    }
    if let Some(priority) = patch.priority {
        patch_payload.insert("priority".to_string(), serde_json::Value::String(priority));
    }
    if let Some(assignee) = patch.assignee_agent_id {
        match assignee {
            Some(value) => {
                patch_payload.insert(
                    "assignee_agent_id".to_string(),
                    serde_json::Value::String(value),
                );
            }
            None => {
                patch_payload.insert("assignee_agent_id".to_string(), serde_json::Value::Null);
            }
        }
    }
    let response = client
        .patch(format!(
            "{}/tasks/{}",
            gateway_base_url(),
            urlencoding::encode(&task_id)
        ))
        .json(&serde_json::Value::Object(patch_payload))
        .send()
        .await
        .map_err(|err| format!("update task request failed: {err}"))?;
    let parsed = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("update task decode failed: {err}"))?;
    let task = parsed
        .get("task")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(task).map_err(|err| format!("update task parse failed: {err}"))
}

#[tauri::command]
pub async fn delete_task(task_id: String) -> Result<bool, String> {
    let client = gateway_client();
    let response = client
        .delete(format!(
            "{}/tasks/{}",
            gateway_base_url(),
            urlencoding::encode(&task_id)
        ))
        .send()
        .await
        .map_err(|err| format!("delete task request failed: {err}"))?;
    if response.status().is_success() {
        return Ok(true);
    }
    Err(format!("delete task failed with status {}", response.status()))
}

#[tauri::command]
pub async fn create_agent(payload: AgentCreatePayload) -> Result<AgentProfile, String> {
    let client = gateway_client();
    let response = client
        .post(format!("{}/agents/create", gateway_base_url()))
        .json(&serde_json::json!({
            "name": payload.name,
            "role": payload.role,
            "parent_id": payload.parent_id,
            "model_provider": payload.model_provider,
            "model_name": payload.model_name,
            "api_key": payload.api_key,
            "temperature": payload.temperature,
            "max_tokens": payload.max_tokens
        }))
        .send()
        .await
        .map_err(|err| format!("create agent request failed: {err}"))?;
    let parsed = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("create agent decode failed: {err}"))?;
    let agent = parsed
        .get("agent")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(agent).map_err(|err| format!("create agent parse failed: {err}"))
}

#[tauri::command]
pub async fn reorder_agents(order: Vec<String>) -> Result<Vec<AgentProfile>, String> {
    let client = gateway_client();
    let response = client
        .post(format!("{}/agents/reorder", gateway_base_url()))
        .json(&serde_json::json!({ "order": order }))
        .send()
        .await
        .map_err(|err| format!("reorder agents request failed: {err}"))?;
    let parsed = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("reorder agents decode failed: {err}"))?;
    let agents = parsed
        .get("agents")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(agents).map_err(|err| format!("reorder agents parse failed: {err}"))
}

#[tauri::command]
pub async fn update_agent_config(agent_id: String, config: AgentConfigPatch) -> Result<AgentProfile, String> {
    let client = gateway_client();
    let response = client
        .patch(format!("{}/agents/{}/config", gateway_base_url(), urlencoding::encode(&agent_id)))
        .json(&serde_json::json!({
            "model_provider": config.model_provider,
            "model_name": config.model_name,
            "api_key": config.api_key,
            "temperature": config.temperature,
            "max_tokens": config.max_tokens,
            "status": config.status
        }))
        .send()
        .await
        .map_err(|err| format!("update agent config request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("update agent config decode failed: {err}"))?;
    let agent = payload
        .get("agent")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(agent).map_err(|err| format!("update agent config parse failed: {err}"))
}

#[tauri::command]
pub async fn get_agent_config(agent_id: String) -> Result<AgentFullConfig, String> {
    let response = gateway_get(format!(
        "{}/agents/{}/full",
        gateway_base_url(),
        urlencoding::encode(&agent_id)
    ))
    .await
    .map_err(|err| format!("agent config request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("agent config decode failed: {err}"))?;
    let agent = payload
        .get("agent")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(agent).map_err(|err| format!("agent config parse failed: {err}"))
}

#[tauri::command]
pub async fn chat_threads() -> Result<Vec<SwarmChatThread>, String> {
    let response = gateway_get(format!("{}/chat/threads", gateway_base_url()))
        .await
        .map_err(|err| format!("chat threads request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("chat threads decode failed: {err}"))?;
    let threads = payload
        .get("threads")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(threads).map_err(|err| format!("chat threads parse failed: {err}"))
}

#[tauri::command]
pub async fn chat_summary() -> Result<SwarmSummary, String> {
    let response = gateway_get(format!("{}/chat/summary", gateway_base_url()))
        .await
        .map_err(|err| format!("chat summary request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("chat summary decode failed: {err}"))?;
    let summary = payload
        .get("summary")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(summary).map_err(|err| format!("chat summary parse failed: {err}"))
}

#[tauri::command]
pub async fn chat_messages(thread_id: String) -> Result<Vec<SwarmChatMessage>, String> {
    let response = gateway_get(format!(
        "{}/chat/messages?threadId={}",
        gateway_base_url(),
        urlencoding::encode(&thread_id)
    ))
    .await
    .map_err(|err| format!("chat messages request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("chat messages decode failed: {err}"))?;
    let messages = payload
        .get("messages")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(messages).map_err(|err| format!("chat messages parse failed: {err}"))
}

#[tauri::command]
pub async fn chat_send(thread_id: String, content: String, user_id: Option<String>) -> Result<Vec<SwarmChatMessage>, String> {
    let client = gateway_client();
    let response = client
        .post(format!("{}/chat/send", gateway_base_url()))
        .json(&serde_json::json!({
            "thread_id": thread_id,
            "content": content,
            "user_id": user_id.unwrap_or_else(|| "user".to_string())
        }))
        .send()
        .await
        .map_err(|err| format!("chat send request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("chat send decode failed: {err}"))?;
    let emitted = payload
        .get("emitted")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(emitted).map_err(|err| format!("chat send parse failed: {err}"))
}

#[tauri::command]
pub async fn chat_quick_action(
    thread_id: String,
    action: String,
) -> Result<Vec<SwarmChatMessage>, String> {
    let client = gateway_client();
    let response = client
        .post(format!("{}/chat/quick", gateway_base_url()))
        .json(&serde_json::json!({
            "thread_id": thread_id,
            "action": action
        }))
        .send()
        .await
        .map_err(|err| format!("chat quick request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("chat quick decode failed: {err}"))?;
    let emitted = payload
        .get("emitted")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(emitted).map_err(|err| format!("chat quick parse failed: {err}"))
}

#[tauri::command]
pub async fn chat_checkpoints(swarm_id: Option<String>, limit: Option<u32>) -> Result<Vec<CheckpointRecord>, String> {
    let resolved_swarm = swarm_id.unwrap_or_else(|| "swarm_main".to_string());
    let cap = limit.unwrap_or(50);
    let response = gateway_get(format!(
        "{}/chat/checkpoints?swarmId={}&limit={}",
        gateway_base_url(),
        urlencoding::encode(&resolved_swarm),
        cap
    ))
    .await
    .map_err(|err| format!("chat checkpoints request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("chat checkpoints decode failed: {err}"))?;
    let checkpoints = payload
        .get("checkpoints")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(checkpoints).map_err(|err| format!("chat checkpoints parse failed: {err}"))
}

#[tauri::command]
pub async fn chat_rewind(
    thread_id: String,
    checkpoint_id: String,
    edit_prompt: Option<String>,
) -> Result<Vec<SwarmChatMessage>, String> {
    let client = gateway_client();
    let response = client
        .post(format!("{}/chat/rewind", gateway_base_url()))
        .json(&serde_json::json!({
            "thread_id": thread_id,
            "checkpoint_id": checkpoint_id,
            "edit_prompt": edit_prompt
        }))
        .send()
        .await
        .map_err(|err| format!("chat rewind request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("chat rewind decode failed: {err}"))?;
    let emitted = payload
        .get("emitted")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(emitted).map_err(|err| format!("chat rewind parse failed: {err}"))
}

#[tauri::command]
pub async fn get_budgets() -> Result<BudgetSnapshot, String> {
    let response = gateway_get(format!("{}/budgets", gateway_base_url()))
        .await
        .map_err(|err| format!("budgets request failed: {err}"))?;
    response
        .json::<BudgetSnapshot>()
        .await
        .map_err(|err| format!("budgets decode failed: {err}"))
}

#[tauri::command]
pub async fn update_budget(
    agent_id: String,
    token_limit: u64,
    cost_limit_usd: f64,
    hard_kill: bool,
) -> Result<AgentBudget, String> {
    let client = gateway_client();
    let response = client
        .patch(format!(
            "{}/budgets/{}",
            gateway_base_url(),
            urlencoding::encode(&agent_id)
        ))
        .json(&serde_json::json!({
            "token_limit": token_limit,
            "cost_limit_usd": cost_limit_usd,
            "hard_kill": hard_kill
        }))
        .send()
        .await
        .map_err(|err| format!("update budget request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("update budget decode failed: {err}"))?;
    let budget = payload
        .get("budget")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(budget).map_err(|err| format!("update budget parse failed: {err}"))
}

#[tauri::command]
pub async fn vault_summary() -> Result<VaultSummary, String> {
    let response = gateway_get(format!("{}/vault/summary", gateway_base_url()))
        .await
        .map_err(|err| format!("vault summary request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("vault summary decode failed: {err}"))?;
    let summary = payload
        .get("summary")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(summary).map_err(|err| format!("vault summary parse failed: {err}"))
}

#[tauri::command]
pub async fn vault_capacity() -> Result<VaultStorageStats, String> {
    let response = gateway_get(format!("{}/vault/capacity", gateway_base_url()))
        .await
        .map_err(|err| format!("vault capacity request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("vault capacity decode failed: {err}"))?;
    let stats = payload
        .get("stats")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(stats).map_err(|err| format!("vault capacity parse failed: {err}"))
}

#[tauri::command]
pub async fn vault_recent(limit: Option<u32>) -> Result<Vec<VaultEntry>, String> {
    let cap = limit.unwrap_or(40);
    let response = gateway_get(format!("{}/vault/recent?limit={}", gateway_base_url(), cap))
        .await
        .map_err(|err| format!("vault recent request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("vault recent decode failed: {err}"))?;
    let items = payload
        .get("items")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(items).map_err(|err| format!("vault recent parse failed: {err}"))
}

#[tauri::command]
pub async fn vault_search(query: String, limit: Option<u32>) -> Result<Vec<VaultEntry>, String> {
    let cap = limit.unwrap_or(40);
    let response = gateway_get(format!(
        "{}/vault/search?query={}&limit={}",
        gateway_base_url(),
        urlencoding::encode(&query),
        cap
    ))
    .await
    .map_err(|err| format!("vault search request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("vault search decode failed: {err}"))?;
    let items = payload
        .get("items")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(items).map_err(|err| format!("vault search parse failed: {err}"))
}

#[tauri::command]
pub async fn vault_deposit(
    entry_type: String,
    title: String,
    markdown_summary: String,
    importance_score: Option<u64>,
    tags: Option<Vec<String>>,
    agent_id: String,
    task_id: Option<String>,
    encrypted: Option<bool>,
) -> Result<VaultEntry, String> {
    let client = gateway_client();
    let response = client
        .post(format!("{}/vault/deposit", gateway_base_url()))
        .json(&serde_json::json!({
            "type": entry_type,
            "title": title,
            "markdown_summary": markdown_summary,
            "importance_score": importance_score.unwrap_or(7),
            "tags": tags.unwrap_or_default(),
            "agent_id": agent_id,
            "task_id": task_id,
            "encrypted": encrypted.unwrap_or(false)
        }))
        .send()
        .await
        .map_err(|err| format!("vault deposit request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("vault deposit decode failed: {err}"))?;
    let entry = payload
        .get("entry")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(entry).map_err(|err| format!("vault deposit parse failed: {err}"))
}

#[tauri::command]
pub async fn vault_prune(max_importance: Option<u64>) -> Result<serde_json::Value, String> {
    let client = gateway_client();
    let response = client
        .post(format!("{}/vault/prune", gateway_base_url()))
        .json(&serde_json::json!({
            "max_importance": max_importance.unwrap_or(3)
        }))
        .send()
        .await
        .map_err(|err| format!("vault prune request failed: {err}"))?;
    response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("vault prune decode failed: {err}"))
}

#[tauri::command]
pub async fn vault_list_versions(entry_id: String) -> Result<Vec<VaultVersion>, String> {
    let response = gateway_get(format!(
        "{}/vault/entries/{}/versions",
        gateway_base_url(),
        urlencoding::encode(&entry_id)
    ))
    .await
    .map_err(|err| format!("vault versions request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("vault versions decode failed: {err}"))?;
    let versions = payload
        .get("versions")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(versions).map_err(|err| format!("vault versions parse failed: {err}"))
}

#[tauri::command]
pub async fn vault_update_entry(
    entry_id: String,
    title: Option<String>,
    markdown_summary: Option<String>,
    importance_score: Option<u64>,
    tags: Option<Vec<String>>,
    encrypted: Option<bool>,
) -> Result<VaultEntry, String> {
    let client = gateway_client();
    let response = client
        .patch(format!(
            "{}/vault/entries/{}",
            gateway_base_url(),
            urlencoding::encode(&entry_id)
        ))
        .json(&serde_json::json!({
            "title": title,
            "markdown_summary": markdown_summary,
            "importance_score": importance_score,
            "tags": tags,
            "encrypted": encrypted
        }))
        .send()
        .await
        .map_err(|err| format!("vault update entry request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("vault update entry decode failed: {err}"))?;
    let entry = payload
        .get("entry")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(entry).map_err(|err| format!("vault update entry parse failed: {err}"))
}

#[tauri::command]
pub async fn vault_create_version(
    entry_id: String,
    markdown_summary: Option<String>,
    blob_path: Option<String>,
    diff: Option<String>,
    importance_score: Option<u64>,
    tags: Option<Vec<String>>,
) -> Result<VaultVersion, String> {
    let client = gateway_client();
    let response = client
        .post(format!(
            "{}/vault/entries/{}/versions",
            gateway_base_url(),
            urlencoding::encode(&entry_id)
        ))
        .json(&serde_json::json!({
            "markdown_summary": markdown_summary,
            "blob_path": blob_path,
            "diff": diff,
            "importance_score": importance_score,
            "tags": tags
        }))
        .send()
        .await
        .map_err(|err| format!("vault create version request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("vault create version decode failed: {err}"))?;
    let version = payload
        .get("version")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(version).map_err(|err| format!("vault create version parse failed: {err}"))
}

#[tauri::command]
pub async fn vault_storage_info() -> Result<VaultStorageInfo, String> {
    let response = gateway_get(format!("{}/vault/storage/info", gateway_base_url()))
        .await
        .map_err(|err| format!("vault storage info request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("vault storage info decode failed: {err}"))?;
    let info = payload
        .get("info")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(info).map_err(|err| format!("vault storage info parse failed: {err}"))
}

#[tauri::command]
pub async fn vault_relocate_storage(path: String, move_existing: Option<bool>) -> Result<VaultStorageInfo, String> {
    let client = gateway_client();
    let response = client
        .post(format!("{}/vault/storage/relocate", gateway_base_url()))
        .json(&serde_json::json!({
            "path": path,
            "move_existing": move_existing.unwrap_or(true)
        }))
        .send()
        .await
        .map_err(|err| format!("vault relocate request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("vault relocate decode failed: {err}"))?;
    let info = payload
        .get("info")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(info).map_err(|err| format!("vault relocate parse failed: {err}"))
}

#[tauri::command]
pub async fn run_agent_quick_action(agent_id: String, action: String) -> Result<AgentActionResult, String> {
    let client = gateway_client();
    let response = client
        .post(format!(
            "{}/agents/{}/action",
            gateway_base_url(),
            urlencoding::encode(&agent_id)
        ))
        .json(&serde_json::json!({ "action": action }))
        .send()
        .await
        .map_err(|err| format!("agent quick action request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("agent quick action decode failed: {err}"))?;
    let result = payload
        .get("result")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(result).map_err(|err| format!("agent quick action parse failed: {err}"))
}

#[tauri::command]
pub async fn get_agent_logs(agent_id: String, limit: Option<u32>) -> Result<Vec<AuditLogEntry>, String> {
    let cap = limit.unwrap_or(40);
    let response = gateway_get(format!(
        "{}/agents/{}/logs?limit={}",
        gateway_base_url(),
        urlencoding::encode(&agent_id),
        cap
    ))
    .await
    .map_err(|err| format!("agent logs request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("agent logs decode failed: {err}"))?;
    let logs = payload
        .get("logs")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(logs).map_err(|err| format!("agent logs parse failed: {err}"))
}

#[tauri::command]
pub async fn test_agent_connection(agent_id: String, api_key: Option<String>) -> Result<AgentConnectionTestResult, String> {
    let client = gateway_client();
    let response = client
        .post(format!(
            "{}/agents/{}/test-connection",
            gateway_base_url(),
            urlencoding::encode(&agent_id)
        ))
        .json(&serde_json::json!({
            "api_key": api_key
        }))
        .send()
        .await
        .map_err(|err| format!("agent connection test request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("agent connection test decode failed: {err}"))?;
    let result = payload
        .get("result")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(result).map_err(|err| format!("agent connection test parse failed: {err}"))
}

#[tauri::command]
pub async fn get_integrations(query: Option<String>, category: Option<String>) -> Result<IntegrationsListResult, String> {
    let resolved_query = query.unwrap_or_default();
    let resolved_category = category.unwrap_or_else(|| "All Categories".to_string());
    let url = format!(
        "{}/integrations/all?query={}&category={}",
        gateway_base_url(),
        urlencoding::encode(&resolved_query),
        urlencoding::encode(&resolved_category)
    );
    let response = gateway_get(url)
        .await
        .map_err(|err| format!("integrations request failed: {err}"))?;
    response
        .json::<IntegrationsListResult>()
        .await
        .map_err(|err| format!("integrations decode failed: {err}"))
}

#[tauri::command]
pub async fn get_integration_status(slug: String) -> Result<serde_json::Value, String> {
    let response = gateway_get(format!(
        "{}/integrations/{}/status",
        gateway_base_url(),
        urlencoding::encode(&slug)
    ))
    .await
    .map_err(|err| format!("integration status request failed: {err}"))?;
    response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("integration status decode failed: {err}"))
}

#[tauri::command]
pub async fn connect_integration(
    slug: String,
    target_agent_ids: Option<Vec<String>>,
    config: Option<serde_json::Value>,
) -> Result<IntegrationEntry, String> {
    let client = gateway_client();
    let response = client
        .post(format!(
            "{}/integrations/{}/connect",
            gateway_base_url(),
            urlencoding::encode(&slug)
        ))
        .json(&serde_json::json!({
            "target_agent_ids": target_agent_ids.unwrap_or_default(),
            "config": config.unwrap_or_else(|| serde_json::json!({}))
        }))
        .send()
        .await
        .map_err(|err| format!("connect integration request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("connect integration decode failed: {err}"))?;
    let integration = payload
        .get("integration")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(integration).map_err(|err| format!("connect integration parse failed: {err}"))
}

#[tauri::command]
pub async fn get_connected_model_providers() -> Result<Vec<ConnectedModelProvider>, String> {
    let response = gateway_get(format!("{}/integrations/model-providers", gateway_base_url()))
        .await
        .map_err(|err| format!("model providers request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("model providers decode failed: {err}"))?;
    let providers = payload
        .get("providers")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(providers).map_err(|err| format!("model providers parse failed: {err}"))
}

#[tauri::command]
pub async fn mcp_list_servers(query: Option<String>) -> Result<Vec<McpServerEntry>, String> {
    let url = format!(
        "{}/mcp/servers?query={}",
        gateway_base_url(),
        urlencoding::encode(&query.unwrap_or_default())
    );
    let response = gateway_get(url)
        .await
        .map_err(|err| format!("mcp servers request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("mcp servers decode failed: {err}"))?;
    let servers = payload
        .get("servers")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(servers).map_err(|err| format!("mcp servers parse failed: {err}"))
}

#[tauri::command]
pub async fn mcp_register_server(
    url: String,
    name: Option<String>,
    capabilities: Option<Vec<String>>,
) -> Result<McpServerEntry, String> {
    let client = gateway_client();
    let response = client
        .post(format!("{}/mcp/servers/register", gateway_base_url()))
        .json(&serde_json::json!({
            "url": url,
            "name": name,
            "capabilities": capabilities.unwrap_or_default()
        }))
        .send()
        .await
        .map_err(|err| format!("mcp register request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("mcp register decode failed: {err}"))?;
    let server = payload
        .get("server")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(server).map_err(|err| format!("mcp register parse failed: {err}"))
}

#[tauri::command]
pub async fn mcp_connect_server(server_id: String, scopes: Option<Vec<String>>) -> Result<McpServerEntry, String> {
    let client = gateway_client();
    let response = client
        .post(format!(
            "{}/mcp/servers/{}/connect",
            gateway_base_url(),
            urlencoding::encode(&server_id)
        ))
        .json(&serde_json::json!({
            "scopes": scopes.unwrap_or_default()
        }))
        .send()
        .await
        .map_err(|err| format!("mcp connect request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("mcp connect decode failed: {err}"))?;
    let server = payload
        .get("server")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(server).map_err(|err| format!("mcp connect parse failed: {err}"))
}

#[tauri::command]
pub async fn mcp_disconnect_server(server_id: String) -> Result<McpServerEntry, String> {
    let client = gateway_client();
    let response = client
        .post(format!(
            "{}/mcp/servers/{}/disconnect",
            gateway_base_url(),
            urlencoding::encode(&server_id)
        ))
        .send()
        .await
        .map_err(|err| format!("mcp disconnect request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("mcp disconnect decode failed: {err}"))?;
    let server = payload
        .get("server")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(server).map_err(|err| format!("mcp disconnect parse failed: {err}"))
}

#[tauri::command]
pub async fn mcp_list_tools(server_id: String) -> Result<Vec<McpToolEntry>, String> {
    let response = gateway_get(format!(
        "{}/mcp/servers/{}/tools",
        gateway_base_url(),
        urlencoding::encode(&server_id)
    ))
    .await
    .map_err(|err| format!("mcp tools request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("mcp tools decode failed: {err}"))?;
    let tools = payload
        .get("tools")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(tools).map_err(|err| format!("mcp tools parse failed: {err}"))
}

#[tauri::command]
pub async fn mcp_invoke_tool(
    server_id: String,
    tool_id: String,
    agent_id: String,
    args: Option<serde_json::Value>,
) -> Result<McpInvokeResult, String> {
    let client = gateway_client();
    let response = client
        .post(format!(
            "{}/mcp/servers/{}/invoke",
            gateway_base_url(),
            urlencoding::encode(&server_id)
        ))
        .json(&serde_json::json!({
            "tool_id": tool_id,
            "agent_id": agent_id,
            "args": args.unwrap_or_else(|| serde_json::json!({}))
        }))
        .send()
        .await
        .map_err(|err| format!("mcp invoke request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("mcp invoke decode failed: {err}"))?;
    let result = payload
        .get("result")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(result).map_err(|err| format!("mcp invoke parse failed: {err}"))
}

#[tauri::command]
pub async fn get_live_skills(
    sort: Option<String>,
    non_suspicious: Option<bool>,
    cursor: Option<String>,
) -> Result<ClawHubLiveSkillsResult, String> {
    let resolved_sort = sort.unwrap_or_else(|| "downloads".to_string());
    let resolved_non_suspicious = non_suspicious.unwrap_or(true);
    let cursor_query = cursor
        .map(|value| format!("&cursor={}", urlencoding::encode(&value)))
        .unwrap_or_default();
    let url = format!(
        "{}/clawhub/live?sort={}&nonSuspicious={}{}",
        gateway_base_url(),
        urlencoding::encode(&resolved_sort),
        resolved_non_suspicious,
        cursor_query
    );
    let response = gateway_get(url)
        .await
        .map_err(|err| format!("live skills request failed: {err}"))?;
    response
        .json::<ClawHubLiveSkillsResult>()
        .await
        .map_err(|err| format!("live skills decode failed: {err}"))
}

#[tauri::command]
pub async fn clawhub_install(slug: String, target_agent: Option<String>) -> Result<ClawHubInstallResult, String> {
    let client = gateway_client();
    let response = client
        .post(format!("{}/clawhub/install", gateway_base_url()))
        .json(&serde_json::json!({
            "slug": slug,
            "target_agent": target_agent
        }))
        .send()
        .await
        .map_err(|err| format!("clawhub install request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("clawhub install decode failed: {err}"))?;
    let result = payload
        .get("result")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(result).map_err(|err| format!("clawhub install parse failed: {err}"))
}

#[tauri::command]
pub async fn clawhub_list_installed() -> Result<Vec<ClawHubSkill>, String> {
    let response = gateway_get(format!("{}/clawhub/installed", gateway_base_url()))
        .await
        .map_err(|err| format!("clawhub installed request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("clawhub installed decode failed: {err}"))?;
    let skills = payload
        .get("skills")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(skills).map_err(|err| format!("clawhub installed parse failed: {err}"))
}

#[tauri::command]
pub async fn get_installed_skills(agent_id: Option<String>) -> Result<Vec<ClawHubSkill>, String> {
    let mut url = format!("{}/clawhub/installed", gateway_base_url());
    if let Some(agent) = agent_id {
        url = format!("{}?agentId={}", url, urlencoding::encode(&agent));
    }
    let response = gateway_get(url)
        .await
        .map_err(|err| format!("installed skills request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("installed skills decode failed: {err}"))?;
    let skills = payload
        .get("skills")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(skills).map_err(|err| format!("installed skills parse failed: {err}"))
}

#[tauri::command]
pub async fn toggle_skill(agent_id: String, slug: String, enabled: bool) -> Result<bool, String> {
    let client = gateway_client();
    let response = client
        .post(format!("{}/clawhub/toggle", gateway_base_url()))
        .json(&serde_json::json!({
            "agent_id": agent_id,
            "slug": slug,
            "enabled": enabled
        }))
        .send()
        .await
        .map_err(|err| format!("toggle skill request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("toggle skill decode failed: {err}"))?;
    Ok(payload
        .get("result")
        .and_then(|value| value.get("success"))
        .and_then(|value| value.as_bool())
        .unwrap_or(false))
}

#[tauri::command]
pub async fn permissions_request(
    agent_id: String,
    capabilities: Vec<String>,
    context: Option<serde_json::Value>,
) -> Result<Vec<PermissionGrant>, String> {
    let client = gateway_client();
    let response = client
        .post(format!("{}/permissions/request", gateway_base_url()))
        .json(&serde_json::json!({
            "agent_id": agent_id,
            "capabilities": capabilities,
            "context": context.unwrap_or_else(|| serde_json::json!({}))
        }))
        .send()
        .await
        .map_err(|err| format!("permissions request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("permissions request decode failed: {err}"))?;
    let grants = payload
        .get("grants")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(grants).map_err(|err| format!("permissions request parse failed: {err}"))
}

#[tauri::command]
pub async fn permissions_approve(grant_id: String) -> Result<PermissionGrant, String> {
    let client = gateway_client();
    let response = client
        .post(format!("{}/permissions/approve", gateway_base_url()))
        .json(&serde_json::json!({ "grant_id": grant_id }))
        .send()
        .await
        .map_err(|err| format!("permissions approve failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("permissions approve decode failed: {err}"))?;
    let grant = payload
        .get("grant")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(grant).map_err(|err| format!("permissions approve parse failed: {err}"))
}

#[tauri::command]
pub async fn permissions_deny(grant_id: String) -> Result<PermissionGrant, String> {
    let client = gateway_client();
    let response = client
        .post(format!("{}/permissions/deny", gateway_base_url()))
        .json(&serde_json::json!({ "grant_id": grant_id }))
        .send()
        .await
        .map_err(|err| format!("permissions deny failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("permissions deny decode failed: {err}"))?;
    let grant = payload
        .get("grant")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(grant).map_err(|err| format!("permissions deny parse failed: {err}"))
}

#[tauri::command]
pub async fn permissions_pending(agent_id: Option<String>) -> Result<Vec<PermissionGrant>, String> {
    let mut url = format!("{}/permissions/pending", gateway_base_url());
    if let Some(agent) = agent_id {
        url = format!("{}?agentId={}", url, urlencoding::encode(&agent));
    }
    let response = gateway_get(url)
        .await
        .map_err(|err| format!("permissions pending failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("permissions pending decode failed: {err}"))?;
    let pending = payload
        .get("pending")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(pending).map_err(|err| format!("permissions pending parse failed: {err}"))
}

#[tauri::command]
pub async fn audit_logs(limit: Option<u32>) -> Result<Vec<AuditLogEntry>, String> {
    let cap = limit.unwrap_or(100);
    let response = gateway_get(format!("{}/audit/logs?limit={}", gateway_base_url(), cap))
        .await
        .map_err(|err| format!("audit logs request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("audit logs decode failed: {err}"))?;
    let logs = payload
        .get("logs")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(logs).map_err(|err| format!("audit logs parse failed: {err}"))
}

#[tauri::command]
pub async fn get_health_snapshot() -> Result<HealthSnapshot, String> {
    let response = gateway_get(format!("{}/telemetry/snapshot", gateway_base_url()))
        .await
        .map_err(|err| format!("health snapshot request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("health snapshot decode failed: {err}"))?;
    let snapshot = payload
        .get("snapshot")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(snapshot).map_err(|err| format!("health snapshot parse failed: {err}"))
}

#[tauri::command]
pub async fn get_health_events(limit: Option<u32>, category: Option<String>) -> Result<Vec<HealthTelemetryEvent>, String> {
    let cap = limit.unwrap_or(150);
    let category_q = category
        .filter(|value| !value.trim().is_empty())
        .map(|value| format!("&category={}", urlencoding::encode(&value)))
        .unwrap_or_default();
    let response = gateway_get(format!(
        "{}/telemetry/events?limit={}{}",
        gateway_base_url(),
        cap,
        category_q
    ))
    .await
    .map_err(|err| format!("health events request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("health events decode failed: {err}"))?;
    let events = payload
        .get("events")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));
    serde_json::from_value(events).map_err(|err| format!("health events parse failed: {err}"))
}

#[tauri::command]
pub async fn export_health_telemetry(format: Option<String>, limit: Option<u32>) -> Result<TelemetryExportResult, String> {
    let target_format = format.unwrap_or_else(|| "json".to_string());
    let cap = limit.unwrap_or(300);
    let response = gateway_get(format!(
        "{}/telemetry/export?format={}&limit={}",
        gateway_base_url(),
        urlencoding::encode(&target_format),
        cap
    ))
    .await
    .map_err(|err| format!("health export request failed: {err}"))?;
    response
        .json::<TelemetryExportResult>()
        .await
        .map_err(|err| format!("health export decode failed: {err}"))
}

#[tauri::command]
pub async fn get_analytics_snapshot(range: Option<String>) -> Result<AnalyticsSnapshot, String> {
    let requested = range.unwrap_or_else(|| "30d".to_string());
    let normalized = if requested == "7d" || requested == "30d" || requested == "90d" {
        requested
    } else {
        "30d".to_string()
    };
    let response = gateway_get(format!(
        "{}/analytics/snapshot?range={}",
        gateway_base_url(),
        urlencoding::encode(&normalized)
    ))
    .await
    .map_err(|err| format!("analytics snapshot request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("analytics snapshot decode failed: {err}"))?;
    let snapshot = payload
        .get("snapshot")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    serde_json::from_value(snapshot).map_err(|err| format!("analytics snapshot parse failed: {err}"))
}

#[tauri::command]
pub async fn export_analytics_report(range: Option<String>, format: Option<String>) -> Result<AnalyticsExportResult, String> {
    let requested_range = range.unwrap_or_else(|| "30d".to_string());
    let normalized_range = if requested_range == "7d" || requested_range == "30d" || requested_range == "90d" {
        requested_range
    } else {
        "30d".to_string()
    };
    let requested_format = format.unwrap_or_else(|| "json".to_string());
    let normalized_format = if requested_format == "csv" || requested_format == "json" {
        requested_format
    } else {
        "json".to_string()
    };
    let response = gateway_get(format!(
        "{}/analytics/export?range={}&format={}",
        gateway_base_url(),
        urlencoding::encode(&normalized_range),
        urlencoding::encode(&normalized_format)
    ))
    .await
    .map_err(|err| format!("analytics export request failed: {err}"))?;
    response
        .json::<AnalyticsExportResult>()
        .await
        .map_err(|err| format!("analytics export decode failed: {err}"))
}

#[tauri::command]
pub async fn clawhub_get_skill_details(slug: String) -> Result<Option<ClawHubSkill>, String> {
    let response = gateway_get(format!(
        "{}/clawhub/details?slug={}",
        gateway_base_url(),
        urlencoding::encode(&slug)
    ))
    .await
    .map_err(|err| format!("clawhub details request failed: {err}"))?;
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|err| format!("clawhub details decode failed: {err}"))?;
    let maybe = payload.get("skill").cloned().unwrap_or(serde_json::Value::Null);
    if maybe.is_null() {
        return Ok(None);
    }
    let parsed = serde_json::from_value(maybe).map_err(|err| format!("clawhub details parse failed: {err}"))?;
    Ok(Some(parsed))
}

