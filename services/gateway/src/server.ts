import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AgentQuickAction } from "@majorclaw/shared-types";
import { bootGatewayFromRegistry } from "./index.js";

const port = Number(process.env.MAJORCLAW_GATEWAY_PORT ?? "4455");
const runtime = bootGatewayFromRegistry(process.env.MAJORCLAW_INSTANCE_CONFIG);
const startedAt = new Date().toISOString();

function applyCors(res: ServerResponse) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
}

function sendJson(res: ServerResponse, data: unknown, code = 200) {
  applyCors(res);
  res.statusCode = code;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(data));
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    res.end("invalid request");
    return;
  }
  if (req.method === "OPTIONS") {
    applyCors(res);
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.url === "/health") {
    const instances = runtime.connectionManager.discoverInstances();
    sendJson(res, {
      status: "ok",
      startedAt,
      instanceCount: instances.length,
      instances: instances.map((item) => ({ id: item.id, name: item.name, wsUrl: item.wsUrl }))
    });
    return;
  }

  if (req.url === "/ready") {
    sendJson(res, { ready: true });
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
    applyCors(res);
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
    const payload = await readJsonBody(req);
    const threadId = String(payload.thread_id ?? "thread_cso_default");
    const content = String(payload.content ?? "");
    const userId = String(payload.user_id ?? "user");
    const emitted = runtime.chatService.sendMessage(threadId, content, userId);
    sendJson(res, { emitted });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/chat/quick")) {
    const payload = await readJsonBody(req);
    const threadId = String(payload.thread_id ?? "thread_cso_default");
    const action = String(payload.action ?? "status_report") as "morning_briefing" | "status_report" | "suggest_skills" | "delegate_task";
    const emitted = runtime.chatService.runQuickAction(threadId, action);
    sendJson(res, { emitted });
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

  if (req.method === "GET" && req.url.startsWith("/agents?") || (req.method === "GET" && req.url === "/agents")) {
    const agents = runtime.agentManager.listAgents();
    sendJson(res, { agents });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/agents/create")) {
    const payload = await readJsonBody(req);
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
      name: String(payload.name ?? "New Agent"),
      role: String(payload.role ?? "custom"),
      parentId: typeof payload.parent_id === "string" ? payload.parent_id : null,
      modelProvider: String(payload.model_provider ?? "anthropic"),
      modelName: String(payload.model_name ?? "claude-3-5-sonnet"),
      temperature: Number(payload.temperature ?? 0.7),
      maxTokens: Number(payload.max_tokens ?? 8192)
    };
    if (typeof payload.api_key === "string" && payload.api_key.trim()) {
      createPayload.apiKey = payload.api_key;
    }
    const agent = runtime.agentManager.createAgent(createPayload);
    sendJson(res, { agent });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/agents/reorder")) {
    const payload = await readJsonBody(req);
    const order = Array.isArray(payload.order) ? payload.order.map((item) => String(item)) : [];
    const agents = runtime.agentManager.reorderAgents(order);
    sendJson(res, { agents });
    return;
  }

  if (req.method === "PATCH" && req.url.startsWith("/agents/") && req.url.endsWith("/config")) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const parts = url.pathname.split("/");
    const agentId = parts[2] ?? "";
    const payload = await readJsonBody(req);
    const patch: {
      modelProvider?: string;
      modelName?: string;
      apiKey?: string;
      temperature?: number;
      maxTokens?: number;
      status?: "online" | "offline" | "degraded" | "idle" | "busy" | "error";
    } = {};
    if (typeof payload.model_provider === "string") {
      patch.modelProvider = payload.model_provider;
    }
    if (typeof payload.model_name === "string") {
      patch.modelName = payload.model_name;
    }
    if (typeof payload.api_key === "string" && payload.api_key.trim()) {
      patch.apiKey = payload.api_key;
    }
    if (typeof payload.temperature === "number") {
      patch.temperature = payload.temperature;
    }
    if (typeof payload.max_tokens === "number") {
      patch.maxTokens = payload.max_tokens;
    }
    if (typeof payload.status === "string") {
      patch.status = payload.status as "online" | "offline" | "degraded" | "idle" | "busy" | "error";
    }
    const agent = runtime.agentManager.updateAgentConfig(agentId, patch);
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
    const agentId = parts[2] ?? "";
    const payload = await readJsonBody(req);
    const action = String(payload.action ?? "logs") as AgentQuickAction;
    const result = runtime.agentManager.quickAction(agentId, action);
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
    const agentId = parts[2] ?? "";
    const payload = await readJsonBody(req);
    const apiKey = typeof payload.api_key === "string" ? payload.api_key : undefined;
    const result = runtime.agentManager.testConnection(agentId, apiKey);
    sendJson(res, { result });
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
    const slug = parts[2] ?? "";
    const payload = await readJsonBody(req);
    const targetAgentIds = Array.isArray(payload.target_agent_ids) ? payload.target_agent_ids.map((item) => String(item)) : [];
    const config = payload.config && typeof payload.config === "object" ? (payload.config as Record<string, string>) : {};
    const integration = runtime.integrations.connect(slug, targetAgentIds, config);
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
    const payload = await readJsonBody(req);
    const slug = String(payload.slug ?? "");
    const agentId = typeof payload.target_agent === "string" ? payload.target_agent : undefined;
    const result = await runtime.clawHub.install(slug, agentId);
    sendJson(res, { result });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/clawhub/toggle")) {
    const payload = await readJsonBody(req);
    const agentId = String(payload.agent_id ?? "");
    const slug = String(payload.slug ?? "");
    const enabled = Boolean(payload.enabled);
    const result = runtime.clawHub.toggleSkill(agentId, slug, enabled);
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
    const payload = await readJsonBody(req);
    const agentId = String(payload.agent_id ?? "");
    const capabilities = Array.isArray(payload.capabilities) ? payload.capabilities.map((item) => String(item)) : [];
    const context = (payload.context ?? {}) as Record<string, unknown>;
    const grants = runtime.safetyWorkflow.requestCapabilities(agentId, capabilities, context);
    sendJson(res, { grants });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/permissions/approve")) {
    const payload = await readJsonBody(req);
    const grantId = String(payload.grant_id ?? "");
    const grant = runtime.safetyWorkflow.approve(grantId);
    sendJson(res, { grant });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/permissions/deny")) {
    const payload = await readJsonBody(req);
    const grantId = String(payload.grant_id ?? "");
    const grant = runtime.safetyWorkflow.deny(grantId);
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

  res.statusCode = 404;
  res.end("not found");
});

server.listen(port, "127.0.0.1", () => {
  // eslint-disable-next-line no-console
  console.log(`[majorclaw-gateway] listening on http://127.0.0.1:${port}`);
});
