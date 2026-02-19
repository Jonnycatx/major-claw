import { createServer, type IncomingMessage, ServerResponse, type ServerResponse as ServerResponseType } from "node:http";
import type { AgentQuickAction, AppErrorCode, TaskRecord } from "@majorclaw/shared-types";
import type { ZodType } from "zod";
import { bootGatewayFromRegistry } from "./index.js";
import { GatewayLifecycle } from "./lifecycle.js";
import { redactSensitiveString } from "./securityRedaction.js";
import {
  agentActionSchema,
  agentConfigPatchSchema,
  agentTestConnectionSchema,
  budgetPatchSchema,
  chatQuickSchema,
  chatRewindSchema,
  chatSendSchema,
  clawhubInstallSchema,
  clawhubToggleSchema,
  createAgentSchema,
  integrationsConnectSchema,
  mcpConnectSchema,
  mcpInvokeSchema,
  mcpRegisterSchema,
  parseRouteId,
  parseWithSchema,
  permissionDecisionSchema,
  permissionsRequestSchema,
  redPhoneSchema,
  reorderAgentsSchema,
  RequestValidationError,
  shutdownSchema,
  taskCreateSchema,
  taskPatchSchema,
  vaultDepositSchema,
  vaultPatchSchema,
  vaultPruneSchema,
  vaultRelocateSchema,
  vaultVersionSchema
} from "./validation.js";

const port = Number(process.env.MAJORCLAW_GATEWAY_PORT ?? "4455");
const runtime = bootGatewayFromRegistry(process.env.MAJORCLAW_INSTANCE_CONFIG);
const startedAt = new Date().toISOString();
const gatewaySessionToken = process.env.MAJORCLAW_GATEWAY_SESSION_TOKEN ?? "";
const maxBodyBytes = Number(process.env.MAJORCLAW_MAX_BODY_BYTES ?? "1048576");
const rateLimitWindowMs = Number(process.env.MAJORCLAW_RATE_LIMIT_WINDOW_MS ?? "60000");
const rateLimitMax = Number(process.env.MAJORCLAW_RATE_LIMIT_MAX ?? "100");
const allowedOrigins = new Set(
  (process.env.MAJORCLAW_ALLOWED_ORIGINS ??
    "tauri://localhost,http://localhost:1420,http://127.0.0.1:1420,https://openclaw.ai")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
);

type ApiErrorCode =
  | AppErrorCode
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

type RateBucket = {
  count: number;
  resetAt: number;
};

const rateBuckets = new Map<string, RateBucket>();

function requestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return req.socket.remoteAddress ?? "unknown";
}

function allowedOrigin(req: IncomingMessage): string | null {
  const origin = req.headers.origin;
  if (typeof origin !== "string" || !origin.trim()) {
    return null;
  }
  return allowedOrigins.has(origin) ? origin : null;
}

function applyCors(req: IncomingMessage, res: ServerResponse) {
  const origin = allowedOrigin(req);
  if (origin) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "Origin");
  }
  res.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,x-session-token");
}

function sendJson(
  reqOrRes: IncomingMessage | ServerResponseType,
  resOrData: ServerResponseType | unknown,
  dataOrCode?: unknown | number,
  maybeCode = 200
) {
  if (reqOrRes instanceof ServerResponse) {
    const res = reqOrRes;
    const data = resOrData;
    const code = typeof dataOrCode === "number" ? dataOrCode : 200;
    res.statusCode = code;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(data));
    return;
  }
  const req = reqOrRes;
  const res = resOrData as ServerResponseType;
  const data = dataOrCode;
  const code = maybeCode;
  applyCors(req, res);
  res.statusCode = code;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(data));
}

function normalizeErrorCode(errorCode: ApiErrorCode): AppErrorCode {
  switch (errorCode) {
    case "VALIDATION_ERROR":
    case "BAD_REQUEST":
    case "ValidationError":
      return "ValidationError";
    case "UNAUTHORIZED":
    case "AuthError":
      return "AuthError";
    case "FORBIDDEN":
    case "PermissionDenied":
      return "PermissionDenied";
    case "NOT_FOUND":
    case "NotFound":
      return "NotFound";
    case "RATE_LIMITED":
    case "RateLimited":
      return "RateLimited";
    case "NetworkError":
      return "NetworkError";
    case "VaultStorageFull":
      return "VaultStorageFull";
    default:
      return "InternalServerError";
  }
}

function sendError(req: IncomingMessage, res: ServerResponseType, code: number, errorCode: ApiErrorCode, message: string, reqId: string) {
  const normalizedCode = normalizeErrorCode(errorCode);
  sendJson(
    req,
    res,
    {
      success: false,
      error: {
        code: normalizedCode,
        message,
        details: { requestId: reqId },
        timestamp: new Date().toISOString()
      }
    },
    code
  );
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of req) {
    const normalized = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    size += normalized.byteLength;
    if (size > maxBodyBytes) {
      throw new Error("payload_too_large");
    }
    chunks.push(normalized);
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

async function readValidatedBody<T>(req: IncomingMessage, schema: ZodType<T>, context: string): Promise<T> {
  const payload = await readJsonBody(req);
  return parseWithSchema(schema, payload, context);
}

function requiresAuth(req: IncomingMessage): boolean {
  if (!req.url) {
    return false;
  }
  if (req.url === "/health" || req.url === "/ready") {
    return false;
  }
  return true;
}

function hasValidSession(req: IncomingMessage): boolean {
  if (!gatewaySessionToken) {
    return true;
  }
  const headerToken = req.headers["x-session-token"];
  if (typeof headerToken === "string" && headerToken === gatewaySessionToken) {
    return true;
  }
  if (req.url) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.searchParams.get("token") === gatewaySessionToken) {
      return true;
    }
  }
  return false;
}

function assertRateLimit(req: IncomingMessage): boolean {
  const token = typeof req.headers["x-session-token"] === "string" ? req.headers["x-session-token"] : "anonymous";
  const key = `${clientIp(req)}:${token}`;
  const now = Date.now();
  const existing = rateBuckets.get(key);
  if (!existing || now >= existing.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
    return true;
  }
  if (existing.count >= rateLimitMax) {
    return false;
  }
  existing.count += 1;
  return true;
}

let lifecycle: GatewayLifecycle;

const server = createServer(async (req, res) => {
  lifecycle.trackRequestStart(req);
  res.on("finish", () => lifecycle.trackRequestFinish(res));
  const reqId = requestId();
  const started = Date.now();
  if (!req.url) {
    sendError(req, res, 400, "BAD_REQUEST", "invalid request", reqId);
    return;
  }
  const originHeader = req.headers.origin;
  if (typeof originHeader === "string" && originHeader.trim() && !allowedOrigin(req)) {
    sendError(req, res, 403, "FORBIDDEN", "origin not allowed", reqId);
    return;
  }
  if (req.method === "OPTIONS") {
    applyCors(req, res);
    res.statusCode = 204;
    res.end();
    return;
  }
  if (requiresAuth(req) && !hasValidSession(req)) {
    sendError(req, res, 401, "UNAUTHORIZED", "missing or invalid session token", reqId);
    return;
  }
  if (!assertRateLimit(req)) {
    sendError(req, res, 429, "RATE_LIMITED", "rate limit exceeded", reqId);
    return;
  }
  if (lifecycle.isShuttingDown() && req.url !== "/health" && req.url !== "/ready" && !req.url.startsWith("/system/shutdown")) {
    sendError(req, res, 503, "INTERNAL_ERROR", "gateway is shutting down", reqId);
    return;
  }
  const doneLog = () => {
    const elapsedMs = Date.now() - started;
    const safePath = req.url?.startsWith("/chat/stream")
      ? "/chat/stream?token=REDACTED"
      : redactSensitiveString(req.url ?? "");
    // eslint-disable-next-line no-console
    console.info(
      JSON.stringify({
        level: "info",
        event: "http_request",
        requestId: reqId,
        method: req.method,
        path: safePath,
        statusCode: res.statusCode,
        elapsedMs
      })
    );
  };
  res.on("finish", doneLog);

  try {
  if (req.url === "/health") {
    const instances = runtime.connectionManager.discoverInstances();
    sendJson(req, res, {
      status: "ok",
      startedAt,
      instanceCount: instances.length,
      instances: instances.map((item) => ({ id: item.id, name: item.name, wsUrl: item.wsUrl }))
    });
    return;
  }

  if (req.url === "/ready") {
    sendJson(req, res, { ready: true });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/chat/threads")) {
    const threads = runtime.chatService.listThreads();
    sendJson(res, { threads });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/chat/summary")) {
    const summary = runtime.chatService.getSummary();
    sendJson(res, { summary });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/chat/messages")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const threadId = url.searchParams.get("threadId") ?? "thread_cso_default";
    const messages = runtime.chatService.listMessages(threadId);
    sendJson(res, { messages });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/chat/stream")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const threadId = url.searchParams.get("threadId") ?? "thread_cso_default";
    applyCors(req, res);
    res.statusCode = 200;
    res.setHeader("content-type", "text/event-stream");
    res.setHeader("cache-control", "no-cache, no-transform");
    res.setHeader("connection", "keep-alive");
    res.setHeader("x-accel-buffering", "no");
    res.flushHeaders();

    const writeEvent = (event: string, payload: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    let lastCount = 0;
    const initial = runtime.chatService.listMessages(threadId);
    lastCount = initial.length;
    writeEvent("messages", initial);
    writeEvent("summary", runtime.chatService.getSummary());

    const streamTimer = setInterval(() => {
      const next = runtime.chatService.listMessages(threadId);
      if (next.length > lastCount) {
        writeEvent("messages", next.slice(lastCount));
        lastCount = next.length;
      }
    }, 1000);
    const summaryTimer = setInterval(() => {
      writeEvent("summary", runtime.chatService.getSummary());
    }, 4000);
    const pingTimer = setInterval(() => {
      writeEvent("ping", { at: new Date().toISOString() });
    }, 15000);

    req.on("close", () => {
      clearInterval(streamTimer);
      clearInterval(summaryTimer);
      clearInterval(pingTimer);
    });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/chat/send")) {
    const payload = await readValidatedBody(req, chatSendSchema, "chat.send");
    const threadId = payload.thread_id;
    const content = payload.content;
    const userId = payload.user_id;
    const emitted = runtime.chatService.sendMessage(threadId, content, userId);
    sendJson(res, { emitted });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/chat/quick")) {
    const payload = await readValidatedBody(req, chatQuickSchema, "chat.quick");
    const threadId = payload.thread_id;
    const action = payload.action;
    const emitted = runtime.chatService.runQuickAction(threadId, action);
    sendJson(res, { emitted });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/chat/checkpoints")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const swarmId = url.searchParams.get("swarmId") ?? "swarm_main";
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const checkpoints = runtime.chatService.listCheckpoints(swarmId, limit);
    sendJson(res, { checkpoints });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/chat/rewind")) {
    const payload = await readValidatedBody(req, chatRewindSchema, "chat.rewind");
    const threadId = payload.thread_id;
    const checkpointId = payload.checkpoint_id;
    const editPrompt = payload.edit_prompt;
    const emitted = runtime.chatService.rewind(threadId, checkpointId, editPrompt);
    sendJson(res, { emitted });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/budgets")) {
    const snapshot = runtime.budgets.list();
    sendJson(res, snapshot);
    return;
  }

  if (req.method === "PATCH" && req.url.startsWith("/budgets/")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const parts = url.pathname.split("/");
    const agentId = parseRouteId(parts[2] ?? "agent_cso", "budget.agent_id");
    const payload = await readValidatedBody(req, budgetPatchSchema, "budgets.patch");
    const budget = runtime.budgets.configure({
      agentId,
      tokenLimit: payload.token_limit,
      costLimitUsd: payload.cost_limit_usd,
      hardKill: payload.hard_kill
    });
    sendJson(res, { budget });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/mcp/servers")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const query = url.searchParams.get("query") ?? "";
    const servers = runtime.mcp.list(query);
    sendJson(res, { servers });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/mcp/servers/register")) {
    const payload = await readValidatedBody(req, mcpRegisterSchema, "mcp.register");
    const server = runtime.mcp.register(payload.url, payload.name, payload.capabilities);
    sendJson(res, { server });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/mcp/servers/") && req.url.endsWith("/connect")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const parts = url.pathname.split("/");
    const serverId = parseRouteId(parts[3] ?? "", "mcp.server_id");
    const payload = await readValidatedBody(req, mcpConnectSchema, "mcp.connect");
    const server = runtime.mcp.connect(serverId, payload.scopes);
    sendJson(res, { server });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/mcp/servers/") && req.url.endsWith("/disconnect")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const parts = url.pathname.split("/");
    const serverId = parseRouteId(parts[3] ?? "", "mcp.server_id");
    const server = runtime.mcp.disconnect(serverId);
    sendJson(res, { server });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/mcp/servers/") && req.url.endsWith("/tools")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const parts = url.pathname.split("/");
    const serverId = parts[3] ?? "";
    const tools = runtime.mcp.listTools(serverId);
    sendJson(res, { tools });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/mcp/servers/") && req.url.endsWith("/invoke")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const parts = url.pathname.split("/");
    const serverId = parseRouteId(parts[3] ?? "", "mcp.server_id");
    const payload = await readValidatedBody(req, mcpInvokeSchema, "mcp.invoke");
    const toolId = payload.tool_id;
    const agentId = payload.agent_id;
    const args = payload.args;
    const result = runtime.mcp.invoke(serverId, toolId, agentId, args);
    sendJson(res, { result });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/clawhub/search")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const query = url.searchParams.get("query") ?? "";
    const sort = (url.searchParams.get("sort") ?? "downloads") as "downloads" | "newest";
    const skills = await runtime.clawHub.search(query, sort);
    sendJson(res, { skills });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/tasks")) {
    const tasks = runtime.repository.listTasks();
    sendJson(res, { tasks });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/tasks/create")) {
    const payload = await readValidatedBody(req, taskCreateSchema, "tasks.create");
    const now = new Date().toISOString();
    const description = typeof payload.description === "string" && payload.description.trim() ? payload.description.trim() : null;
    const task: TaskRecord = {
      id: `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      title: payload.title,
      status: payload.status,
      priority: payload.priority,
      assigneeAgentId: payload.assignee_agent_id ?? null,
      parentTaskId: payload.parent_task_id ?? null,
      createdAt: now,
      updatedAt: now
    };
    if (description) {
      task.description = description;
    }
    runtime.repository.upsertTask(task);
    sendJson(res, { task });
    return;
  }

  if (req.method === "PATCH" && req.url.startsWith("/tasks/")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const parts = url.pathname.split("/");
    const taskId = parseRouteId(parts[2] ?? "", "task.id");
    const existing = runtime.repository.getTask(taskId);
    if (!existing) {
      sendError(req, res, 404, "NOT_FOUND", "task not found", reqId);
      return;
    }
    const payload = await readValidatedBody(req, taskPatchSchema, "tasks.patch");
    const next: TaskRecord = {
      ...existing,
      title: payload.title ?? existing.title,
      status: payload.status ?? existing.status,
      priority: payload.priority ?? existing.priority,
      assigneeAgentId: payload.assignee_agent_id !== undefined ? payload.assignee_agent_id : existing.assigneeAgentId,
      updatedAt: new Date().toISOString()
    };
    if (payload.description === null) {
      delete next.description;
    } else if (typeof payload.description === "string") {
      const desc = payload.description.trim();
      if (desc) {
        next.description = desc;
      } else {
        delete next.description;
      }
    }
    runtime.repository.upsertTask(next);
    sendJson(res, { task: next });
    return;
  }

  if (req.method === "DELETE" && req.url.startsWith("/tasks/")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const parts = url.pathname.split("/");
    const taskId = parseRouteId(parts[2] ?? "", "task.id");
    const existing = runtime.repository.getTask(taskId);
    if (!existing) {
      sendError(req, res, 404, "NOT_FOUND", "task not found", reqId);
      return;
    }
    runtime.repository.deleteTask(taskId);
    sendJson(res, { success: true });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/agents?") || (req.method === "GET" && req.url === "/agents")) {
    const agents = runtime.agentManager.listAgents();
    sendJson(res, { agents });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/agents/create")) {
    const payload = await readValidatedBody(req, createAgentSchema, "agents.create");
    const createPayload: {
      name: string;
      role: string;
      parentId: string | null;
      modelProvider: string;
      modelName: string;
      apiKey?: string;
      temperature: number;
      maxTokens: number;
    } = {
      name: payload.name,
      role: payload.role,
      parentId: payload.parent_id ?? null,
      modelProvider: payload.model_provider,
      modelName: payload.model_name,
      temperature: payload.temperature,
      maxTokens: payload.max_tokens
    };
    if (payload.api_key?.trim()) {
      createPayload.apiKey = payload.api_key;
    }
    const agent = runtime.agentManager.createAgent(createPayload);
    runtime.telemetry.record({
      category: "agent",
      source: "gateway.agent.create",
      message: "Agent created",
      metadata: { agentId: agent.id, role: agent.role }
    });
    sendJson(res, { agent });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/agents/reorder")) {
    const payload = await readValidatedBody(req, reorderAgentsSchema, "agents.reorder");
    const agents = runtime.agentManager.reorderAgents(payload.order);
    sendJson(res, { agents });
    return;
  }

  if (req.method === "PATCH" && req.url.startsWith("/agents/") && req.url.endsWith("/config")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const parts = url.pathname.split("/");
    const agentId = parseRouteId(parts[2] ?? "", "agent.id");
    const payload = await readValidatedBody(req, agentConfigPatchSchema, "agents.config");
    const patch: {
      modelProvider?: string;
      modelName?: string;
      apiKey?: string;
      temperature?: number;
      maxTokens?: number;
      status?: "online" | "offline" | "degraded" | "idle" | "busy" | "error";
    } = {};
    if (payload.model_provider !== undefined) {
      patch.modelProvider = payload.model_provider;
    }
    if (payload.model_name !== undefined) {
      patch.modelName = payload.model_name;
    }
    if (payload.api_key?.trim()) {
      patch.apiKey = payload.api_key;
    }
    if (payload.temperature !== undefined) {
      patch.temperature = payload.temperature;
    }
    if (payload.max_tokens !== undefined) {
      patch.maxTokens = payload.max_tokens;
    }
    if (payload.status !== undefined) {
      patch.status = payload.status;
    }
    const agent = runtime.agentManager.updateAgentConfig(agentId, patch);
    runtime.telemetry.record({
      category: "agent",
      source: "gateway.agent.config",
      message: "Agent config updated",
      metadata: { agentId, changed: Object.keys(patch) }
    });
    sendJson(res, { agent });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/agents/") && req.url.endsWith("/full")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const parts = url.pathname.split("/");
    const agentId = parts[2] ?? "";
    const agent = runtime.agentManager.getAgentWithConfig(agentId);
    sendJson(res, { agent });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/agents/") && req.url.endsWith("/action")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const parts = url.pathname.split("/");
    const agentId = parseRouteId(parts[2] ?? "", "agent.id");
    const payload = await readValidatedBody(req, agentActionSchema, "agents.action");
    const action = payload.action as AgentQuickAction;
    const result = runtime.agentManager.quickAction(agentId, action);
    runtime.telemetry.record({
      category: "agent",
      source: "gateway.agent.action",
      severity: result.success ? "info" : "warning",
      message: `Agent quick action: ${action}`,
      metadata: { agentId, success: result.success }
    });
    sendJson(res, { result });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/agents/") && req.url.endsWith("/logs")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const parts = url.pathname.split("/");
    const agentId = parts[2] ?? "";
    const limit = Number(url.searchParams.get("limit") ?? "40");
    const logs = runtime.agentManager.getAgentLogs(agentId, limit);
    sendJson(res, { logs });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/agents/") && req.url.endsWith("/test-connection")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const parts = url.pathname.split("/");
    const agentId = parseRouteId(parts[2] ?? "", "agent.id");
    const payload = await readValidatedBody(req, agentTestConnectionSchema, "agents.test_connection");
    const apiKey = payload.api_key;
    const result = runtime.agentManager.testConnection(agentId, apiKey);
    runtime.telemetry.record({
      category: "agent",
      source: "gateway.agent.test_connection",
      severity: result.ok ? "info" : "warning",
      message: "Agent connection test finished",
      metadata: { agentId, ok: result.ok, status: result.status }
    });
    sendJson(res, { result });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/telemetry/snapshot")) {
    const snapshot = runtime.telemetry.snapshot(startedAt);
    sendJson(res, { snapshot });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/telemetry/events")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const limit = Number(url.searchParams.get("limit") ?? "150");
    const category = url.searchParams.get("category") as
      | "lifecycle"
      | "gateway"
      | "agent"
      | "vault"
      | "error"
      | "system"
      | null;
    const events = runtime.telemetry.listEvents(limit, category ?? undefined);
    sendJson(res, { events });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/telemetry/stream")) {
    applyCors(req, res);
    res.statusCode = 200;
    res.setHeader("content-type", "text/event-stream");
    res.setHeader("cache-control", "no-cache, no-transform");
    res.setHeader("connection", "keep-alive");
    res.setHeader("x-accel-buffering", "no");
    res.flushHeaders();
    const lastEventId = typeof req.headers["last-event-id"] === "string" ? req.headers["last-event-id"] : null;

    const writeEvent = (event: string, payload: unknown, id?: string) => {
      if (id) {
        res.write(`id: ${id}\n`);
      }
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    for (const item of runtime.telemetry.listSince(lastEventId, 120)) {
      writeEvent("telemetry", item, item.id);
    }
    writeEvent("snapshot", runtime.telemetry.snapshot(startedAt));

    const unsubscribe = runtime.telemetry.subscribe((event) => {
      writeEvent("telemetry", event, event.id);
    });

    const snapshotTimer = setInterval(() => {
      writeEvent("snapshot", runtime.telemetry.snapshot(startedAt));
    }, 5000);
    const pingTimer = setInterval(() => {
      writeEvent("ping", { at: new Date().toISOString() });
    }, 15000);

    req.on("close", () => {
      unsubscribe();
      clearInterval(snapshotTimer);
      clearInterval(pingTimer);
    });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/telemetry/export")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const format = (url.searchParams.get("format") ?? "json") as "json" | "csv";
    const limit = Number(url.searchParams.get("limit") ?? "300");
    const payload = runtime.telemetry.exportEvents(format === "csv" ? "csv" : "json", limit);
    sendJson(res, {
      format: format === "csv" ? "csv" : "json",
      generatedAt: new Date().toISOString(),
      payload
    });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/analytics/snapshot")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const rangeParam = url.searchParams.get("range");
    const range = rangeParam === "7d" || rangeParam === "30d" || rangeParam === "90d" ? rangeParam : "30d";
    const snapshot = runtime.analytics.snapshot(range);
    sendJson(res, { snapshot });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/analytics/export")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const rangeParam = url.searchParams.get("range");
    const range = rangeParam === "7d" || rangeParam === "30d" || rangeParam === "90d" ? rangeParam : "30d";
    const formatParam = url.searchParams.get("format");
    const format = formatParam === "csv" ? "csv" : "json";
    const payload = runtime.analytics.exportSnapshot(range, format);
    sendJson(res, {
      range,
      format,
      generatedAt: new Date().toISOString(),
      payload
    });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/clawhub/live")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const sort = (url.searchParams.get("sort") ?? "downloads") as "downloads" | "newest";
    const nonSuspicious = url.searchParams.get("nonSuspicious") !== "false";
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const result = await runtime.clawHub.getLiveSkills(sort, nonSuspicious, cursor);
    sendJson(res, result);
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/integrations/all")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const query = url.searchParams.get("query") ?? "";
    const category = url.searchParams.get("category") ?? "All Categories";
    const result = runtime.integrations.list(query, category);
    sendJson(res, result);
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/integrations/model-providers")) {
    const providers = runtime.integrations.connectedModelProviders();
    sendJson(res, { providers });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/integrations/") && req.url.endsWith("/status")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const parts = url.pathname.split("/");
    const slug = parts[2] ?? "";
    const result = runtime.integrations.getStatus(slug);
    sendJson(res, result);
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/integrations/") && req.url.endsWith("/connect")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const parts = url.pathname.split("/");
    const slug = parseRouteId(parts[2] ?? "", "integrations.slug");
    const payload = await readValidatedBody(req, integrationsConnectSchema, "integrations.connect");
    const integration = runtime.integrations.connect(slug, payload.target_agent_ids, payload.config);
    sendJson(res, { integration });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/clawhub/installed")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const agentId = url.searchParams.get("agentId") ?? undefined;
    const skills = await runtime.clawHub.listInstalled(agentId);
    sendJson(res, { skills });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/clawhub/details")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const slug = url.searchParams.get("slug") ?? "";
    const skill = await runtime.clawHub.getSkillDetails(slug);
    sendJson(res, { skill });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/clawhub/install")) {
    const payload = await readValidatedBody(req, clawhubInstallSchema, "clawhub.install");
    const slug = payload.slug;
    const agentId = payload.target_agent;
    const result = await runtime.clawHub.install(slug, agentId);
    sendJson(res, { result });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/clawhub/toggle")) {
    const payload = await readValidatedBody(req, clawhubToggleSchema, "clawhub.toggle");
    const result = runtime.clawHub.toggleSkill(payload.agent_id, payload.slug, payload.enabled);
    sendJson(res, { result });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/permissions/pending")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const agentId = url.searchParams.get("agentId") ?? undefined;
    const pending = runtime.safetyWorkflow.listPending(agentId);
    sendJson(res, { pending });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/permissions/request")) {
    const payload = await readValidatedBody(req, permissionsRequestSchema, "permissions.request");
    const grants = runtime.safetyWorkflow.requestCapabilities(payload.agent_id, payload.capabilities, payload.context);
    sendJson(res, { grants });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/permissions/approve")) {
    const payload = await readValidatedBody(req, permissionDecisionSchema, "permissions.approve");
    const grant = runtime.safetyWorkflow.approve(payload.grant_id);
    sendJson(res, { grant });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/permissions/deny")) {
    const payload = await readValidatedBody(req, permissionDecisionSchema, "permissions.deny");
    const grant = runtime.safetyWorkflow.deny(payload.grant_id);
    sendJson(res, { grant });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/audit/logs")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const limit = Number(url.searchParams.get("limit") ?? "100");
    const logs = runtime.safetyWorkflow.listAuditLogs(limit);
    sendJson(res, { logs });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/system/red-phone")) {
    const payload = await readValidatedBody(req, redPhoneSchema, "system.red_phone");
    const reason = payload.reason;
    const actor = payload.actor;
    const log = runtime.safetyWorkflow.recordAudit("system", "red_phone_shutdown", actor, {
      reason,
      requestedAt: new Date().toISOString()
    });
    runtime.telemetry.record({
      category: "lifecycle",
      source: "gateway.red_phone",
      severity: "critical",
      message: "Red Phone activated",
      metadata: { reason, actor }
    });
    sendJson(res, { log });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/system/shutdown")) {
    const payload = await readValidatedBody(req, shutdownSchema, "system.shutdown");
    const reason = payload.reason;
    const actor = payload.actor;
    sendJson(req, res, {
      success: true,
      status: "accepted",
      reason,
      actor
    });
    runtime.telemetry.record({
      category: "lifecycle",
      source: "gateway.shutdown",
      severity: "warning",
      message: "Gateway shutdown accepted",
      metadata: { reason, actor }
    });
    setTimeout(() => {
      void lifecycle
        .requestShutdown(reason, actor)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    }, 0);
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/vault/summary")) {
    const summary = runtime.vault.summary();
    sendJson(res, { summary });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/vault/capacity")) {
    const stats = runtime.vault.capacity();
    sendJson(res, { stats });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/vault/recent")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const limit = Number(url.searchParams.get("limit") ?? "40");
    const items = runtime.vault.recent(limit);
    sendJson(res, { items });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/vault/search")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const query = url.searchParams.get("query") ?? "";
    const limit = Number(url.searchParams.get("limit") ?? "40");
    const items = runtime.vault.search(query, limit);
    sendJson(res, { items });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/vault/deposit")) {
    const payload = await readValidatedBody(req, vaultDepositSchema, "vault.deposit");
    const depositInput: {
      type: "archive" | "file" | "kb";
      title: string;
      markdownSummary: string;
      importanceScore: number;
      tags: string[];
      agentId: string;
      taskId?: string;
      encrypted: boolean;
    } = {
      type: payload.type,
      title: payload.title,
      markdownSummary: payload.markdown_summary,
      importanceScore: payload.importance_score,
      tags: payload.tags,
      agentId: payload.agent_id,
      encrypted: payload.encrypted
    };
    if (payload.task_id) {
      depositInput.taskId = payload.task_id;
    }
    const entry = runtime.vault.deposit(depositInput);
    runtime.telemetry.record({
      category: "vault",
      source: "gateway.vault.deposit",
      message: "Vault entry deposited",
      metadata: { entryId: entry.id, type: entry.type, importanceScore: entry.importanceScore }
    });
    sendJson(res, { entry });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/vault/prune")) {
    const payload = await readValidatedBody(req, vaultPruneSchema, "vault.prune");
    const result = runtime.vault.prune(payload.max_importance);
    runtime.telemetry.record({
      category: "vault",
      source: "gateway.vault.prune",
      severity: result.removed > 0 ? "warning" : "info",
      message: "Vault prune completed",
      metadata: { maxImportance: payload.max_importance, removed: result.removed }
    });
    sendJson(res, { result });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/vault/storage/info")) {
    const info = await runtime.vault.storageInfo();
    sendJson(res, { info });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/vault/storage/relocate")) {
    const payload = await readValidatedBody(req, vaultRelocateSchema, "vault.storage.relocate");
    try {
      const info = await runtime.vault.relocate(payload.path, payload.move_existing);
      runtime.telemetry.record({
        category: "vault",
        source: "gateway.vault.relocate",
        severity: info.isOfflineFallback ? "warning" : "info",
        message: "Vault storage relocated",
        metadata: { rootPath: info.rootPath, isOfflineFallback: info.isOfflineFallback }
      });
      sendJson(res, { info });
    } catch (error) {
      sendJson(
        res,
        {
          error: error instanceof Error ? error.message : "vault relocation failed"
        },
        400
      );
    }
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/vault/entries/") && req.url.endsWith("/versions")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const parts = url.pathname.split("/");
    const entryId = parts[3] ?? "";
    const versions = runtime.vault.versions(entryId);
    sendJson(res, { versions });
    return;
  }

  if (req.method === "PATCH" && req.url.startsWith("/vault/entries/")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const parts = url.pathname.split("/");
    const entryId = parseRouteId(parts[3] ?? "", "vault.entry_id");
    const payload = await readValidatedBody(req, vaultPatchSchema, "vault.entry.patch");
    const patch: {
      title?: string;
      markdownSummary?: string;
      importanceScore?: number;
      tags?: string[];
      encrypted?: boolean;
    } = {};
    if (payload.title !== undefined) {
      patch.title = payload.title;
    }
    if (payload.markdown_summary !== undefined) {
      patch.markdownSummary = payload.markdown_summary;
    }
    if (payload.importance_score !== undefined) {
      patch.importanceScore = payload.importance_score;
    }
    if (payload.tags !== undefined) {
      patch.tags = payload.tags;
    }
    if (payload.encrypted !== undefined) {
      patch.encrypted = payload.encrypted;
    }
    const entry = runtime.vault.updateEntry(entryId, patch);
    sendJson(res, { entry });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/vault/entries/") && req.url.endsWith("/versions")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const parts = url.pathname.split("/");
    const entryId = parseRouteId(parts[3] ?? "", "vault.entry_id");
    const payload = await readValidatedBody(req, vaultVersionSchema, "vault.version.create");
    const versionInput: {
      markdownSummary?: string;
      blobPath?: string;
      diff?: string;
      importanceScore?: number;
      tags?: string[];
    } = {};
    if (payload.markdown_summary !== undefined) {
      versionInput.markdownSummary = payload.markdown_summary;
    }
    if (payload.blob_path !== undefined) {
      versionInput.blobPath = payload.blob_path;
    }
    if (payload.diff !== undefined) {
      versionInput.diff = payload.diff;
    }
    if (payload.importance_score !== undefined) {
      versionInput.importanceScore = payload.importance_score;
    }
    if (payload.tags !== undefined) {
      versionInput.tags = payload.tags;
    }
    const version = runtime.vault.createVersion(entryId, versionInput);
    sendJson(res, { version });
    return;
  }

  sendError(req, res, 404, "NOT_FOUND", "not found", reqId);
  } catch (error) {
    if (!res.writableEnded) {
      if (error instanceof Error && error.message === "payload_too_large") {
        sendError(req, res, 413, "BAD_REQUEST", "request body too large", reqId);
      } else if (error instanceof SyntaxError) {
        sendError(req, res, 422, "VALIDATION_ERROR", "invalid JSON payload", reqId);
      } else if (error instanceof RequestValidationError) {
        sendError(req, res, 422, "VALIDATION_ERROR", `${error.message}: ${error.issues.join("; ")}`, reqId);
      } else {
        runtime.telemetry.record({
          category: "error",
          source: "gateway.http",
          severity: "critical",
          message: error instanceof Error ? error.message : "request failed",
          metadata: { requestId: reqId, path: req.url ?? "", method: req.method ?? "" }
        });
        // eslint-disable-next-line no-console
        console.error(
          JSON.stringify({
            level: "error",
            event: "http_request_error",
            requestId: reqId,
            method: req.method,
            path: redactSensitiveString(req.url ?? ""),
            message: redactSensitiveString(error instanceof Error ? error.message : "unknown error")
          })
        );
        sendError(req, res, 500, "INTERNAL_ERROR", "request failed", reqId);
      }
    }
  }
});

lifecycle = new GatewayLifecycle(server, runtime);
try {
  lifecycle.acquirePidLock();
} catch (error) {
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      level: "error",
      event: "gateway_pid_lock_failed",
      message: error instanceof Error ? error.message : "unknown error"
    })
  );
  process.exit(1);
}

process.on("SIGTERM", () => {
  void lifecycle
    .requestShutdown("signal:SIGTERM", "signal")
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
});

process.on("SIGINT", () => {
  void lifecycle
    .requestShutdown("signal:SIGINT", "signal")
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
});

process.on("exit", () => {
  lifecycle.releasePidLock();
});

server.listen(port, "127.0.0.1", () => {
  runtime.telemetry.record({
    category: "lifecycle",
    source: "gateway.boot",
    message: "Gateway listening",
    metadata: { port, startedAt }
  });
  // eslint-disable-next-line no-console
  console.log(`[majorclaw-gateway] listening on http://127.0.0.1:${port}`);
});
