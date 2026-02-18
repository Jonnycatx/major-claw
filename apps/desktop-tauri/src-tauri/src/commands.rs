use crate::GatewayState;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use tauri::State;

const GATEWAY_PORT: u16 = 4455;

#[derive(Serialize)]
pub struct GatewayStatus {
    running: bool,
    port: u16,
}

#[derive(Serialize)]
pub struct GatewayHealth {
    status: String,
    #[serde(rename = "startedAt")]
    started_at: Option<String>,
    #[serde(rename = "instanceCount")]
    instance_count: Option<u64>,
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

fn gateway_base_url() -> String {
    format!("http://127.0.0.1:{GATEWAY_PORT}")
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

    let child = Command::new("pnpm")
        .args(["--filter", "@majorclaw/gateway", "dev:server"])
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
pub fn start_gateway(state: State<'_, GatewayState>) -> Result<GatewayStatus, String> {
    start_gateway_inner(state.inner())
}

#[tauri::command]
pub fn stop_gateway(state: State<'_, GatewayState>) -> Result<GatewayStatus, String> {
    let mut guard = state.child.lock().map_err(|_| "gateway state lock poisoned".to_string())?;
    if let Some(child) = guard.as_mut() {
        child
            .kill()
            .map_err(|err| format!("failed to stop gateway process: {err}"))?;
        let _ = child.wait();
    }
    *guard = None;
    Ok(GatewayStatus {
        running: false,
        port: GATEWAY_PORT,
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
pub async fn gateway_health() -> Result<GatewayHealth, String> {
    let response = reqwest::get(format!("{}/health", gateway_base_url()))
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
    let response = reqwest::get(url)
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
    let response = reqwest::get(format!("{}/agents", gateway_base_url()))
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
pub async fn create_agent(payload: AgentCreatePayload) -> Result<AgentProfile, String> {
    let client = reqwest::Client::new();
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
    let client = reqwest::Client::new();
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
    let client = reqwest::Client::new();
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
    let response = reqwest::get(format!(
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
    let response = reqwest::get(format!("{}/chat/threads", gateway_base_url()))
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
    let response = reqwest::get(format!("{}/chat/summary", gateway_base_url()))
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
    let response = reqwest::get(format!(
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
    let client = reqwest::Client::new();
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
    let client = reqwest::Client::new();
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
pub async fn run_agent_quick_action(agent_id: String, action: String) -> Result<AgentActionResult, String> {
    let client = reqwest::Client::new();
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
    let response = reqwest::get(format!(
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
    let client = reqwest::Client::new();
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
    let response = reqwest::get(url)
        .await
        .map_err(|err| format!("integrations request failed: {err}"))?;
    response
        .json::<IntegrationsListResult>()
        .await
        .map_err(|err| format!("integrations decode failed: {err}"))
}

#[tauri::command]
pub async fn get_integration_status(slug: String) -> Result<serde_json::Value, String> {
    let response = reqwest::get(format!(
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
    let client = reqwest::Client::new();
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
    let response = reqwest::get(format!("{}/integrations/model-providers", gateway_base_url()))
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
    let response = reqwest::get(url)
        .await
        .map_err(|err| format!("live skills request failed: {err}"))?;
    response
        .json::<ClawHubLiveSkillsResult>()
        .await
        .map_err(|err| format!("live skills decode failed: {err}"))
}

#[tauri::command]
pub async fn clawhub_install(slug: String, target_agent: Option<String>) -> Result<ClawHubInstallResult, String> {
    let client = reqwest::Client::new();
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
    let response = reqwest::get(format!("{}/clawhub/installed", gateway_base_url()))
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
    let response = reqwest::get(url)
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
    let client = reqwest::Client::new();
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
    let client = reqwest::Client::new();
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
    let client = reqwest::Client::new();
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
    let client = reqwest::Client::new();
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
    let response = reqwest::get(url)
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
    let response = reqwest::get(format!("{}/audit/logs?limit={}", gateway_base_url(), cap))
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
pub async fn clawhub_get_skill_details(slug: String) -> Result<Option<ClawHubSkill>, String> {
    let response = reqwest::get(format!(
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

