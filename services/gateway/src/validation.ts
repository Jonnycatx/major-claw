import { z } from "zod";

export class RequestValidationError extends Error {
  constructor(
    message: string,
    readonly issues: string[]
  ) {
    super(message);
  }
}

const idPattern = /^[a-zA-Z0-9._:-]+$/;
const safeString = (min = 1, max = 256) => z.string().trim().min(min).max(max);
const idString = safeString(1, 120).regex(idPattern, "must use only [a-zA-Z0-9._:-]");

const taskStatus = z.enum(["inbox", "assigned", "in_progress", "review", "done", "failed"]);
const taskPriority = z.enum(["low", "normal", "high"]);
const agentStatus = z.enum(["online", "offline", "degraded", "idle", "busy", "error"]);

export const chatSendSchema = z.object({
  thread_id: safeString(1, 120).optional().default("thread_cso_default"),
  content: safeString(1, 8000),
  user_id: safeString(1, 120).optional().default("user")
});

export const chatQuickSchema = z.object({
  thread_id: safeString(1, 120).optional().default("thread_cso_default"),
  action: z.enum(["morning_briefing", "status_report", "suggest_skills", "delegate_task"])
});

export const chatRewindSchema = z.object({
  thread_id: safeString(1, 120).optional().default("thread_cso_default"),
  checkpoint_id: idString,
  edit_prompt: safeString(1, 2000).optional()
});

export const budgetPatchSchema = z.object({
  token_limit: z.number().int().min(1).max(100_000_000),
  cost_limit_usd: z.number().min(0).max(10_000_000),
  hard_kill: z.boolean()
});

export const mcpRegisterSchema = z.object({
  url: z.url().max(2048),
  name: safeString(1, 120).optional(),
  capabilities: z.array(safeString(1, 120)).max(80).optional().default([])
});

export const mcpConnectSchema = z.object({
  scopes: z.array(safeString(1, 120)).max(80).optional().default([])
});

export const mcpInvokeSchema = z.object({
  tool_id: idString,
  agent_id: idString.optional().default("agent_cso"),
  args: z.record(z.string(), z.unknown()).optional().default({})
});

export const taskCreateSchema = z.object({
  title: safeString(1, 220),
  description: z.string().trim().max(5000).optional().nullable(),
  status: taskStatus.optional().default("inbox"),
  priority: taskPriority.optional().default("normal"),
  assignee_agent_id: idString.optional().nullable(),
  parent_task_id: idString.optional().nullable()
});

export const taskPatchSchema = z.object({
  title: safeString(1, 220).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  status: taskStatus.optional(),
  priority: taskPriority.optional(),
  assignee_agent_id: idString.optional().nullable()
});

export const createAgentSchema = z.object({
  name: safeString(1, 120),
  role: safeString(2, 120),
  parent_id: idString.optional().nullable(),
  model_provider: safeString(2, 64).optional().default("anthropic"),
  model_name: safeString(2, 120).optional().default("claude-3-5-sonnet"),
  api_key: z.string().trim().max(4096).optional(),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  max_tokens: z.number().int().min(256).max(200_000).optional().default(8192)
});

export const reorderAgentsSchema = z.object({
  order: z.array(idString).max(300)
});

export const agentConfigPatchSchema = z.object({
  model_provider: safeString(2, 64).optional(),
  model_name: safeString(2, 120).optional(),
  api_key: z.string().trim().max(4096).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(256).max(200_000).optional(),
  status: agentStatus.optional()
});

export const agentActionSchema = z.object({
  action: z.enum(["pause", "clone", "delete", "logs"])
});

export const agentTestConnectionSchema = z.object({
  api_key: z.string().trim().max(4096).optional()
});

export const integrationsConnectSchema = z.object({
  target_agent_ids: z.array(idString).max(100).optional().default([]),
  config: z.record(z.string(), z.string().max(4096)).optional().default({})
});

export const clawhubInstallSchema = z.object({
  slug: safeString(1, 220),
  target_agent: idString.optional()
});

export const clawhubToggleSchema = z.object({
  agent_id: idString,
  slug: safeString(1, 220),
  enabled: z.boolean()
});

export const permissionsRequestSchema = z.object({
  agent_id: idString,
  capabilities: z.array(safeString(1, 120)).min(1).max(100),
  context: z.record(z.string(), z.unknown()).optional().default({})
});

export const permissionDecisionSchema = z.object({
  grant_id: idString
});

export const redPhoneSchema = z.object({
  reason: safeString(3, 600),
  actor: safeString(1, 80).optional().default("user")
});

export const shutdownSchema = z.object({
  reason: safeString(1, 600).optional().default("gateway_shutdown"),
  actor: safeString(1, 80).optional().default("system")
});

export const vaultDepositSchema = z.object({
  type: z.enum(["archive", "file", "kb"]),
  title: safeString(1, 220),
  markdown_summary: safeString(1, 20_000),
  importance_score: z.number().int().min(1).max(10).optional().default(7),
  tags: z.array(safeString(1, 80)).max(80).optional().default([]),
  agent_id: idString,
  task_id: idString.optional(),
  encrypted: z.boolean().optional().default(false)
});

export const vaultPruneSchema = z.object({
  max_importance: z.number().int().min(1).max(10).optional().default(3)
});

export const vaultRelocateSchema = z.object({
  path: safeString(3, 4096),
  move_existing: z.boolean().optional().default(true)
});

export const vaultPatchSchema = z.object({
  title: safeString(1, 220).optional(),
  markdown_summary: safeString(1, 20_000).optional(),
  importance_score: z.number().int().min(1).max(10).optional(),
  tags: z.array(safeString(1, 80)).max(80).optional(),
  encrypted: z.boolean().optional()
});

export const vaultVersionSchema = z.object({
  markdown_summary: safeString(1, 20_000).optional(),
  blob_path: safeString(1, 4096).optional(),
  diff: safeString(1, 20_000).optional(),
  importance_score: z.number().int().min(1).max(10).optional(),
  tags: z.array(safeString(1, 80)).max(80).optional()
});

export function parseWithSchema<T>(schema: z.ZodType<T>, payload: unknown, context: string): T {
  const parsed = schema.safeParse(payload);
  if (parsed.success) {
    return parsed.data;
  }
  const issues = parsed.error.issues.map((issue) => {
    const path = issue.path.join(".") || "payload";
    return `${path}: ${issue.message}`;
  });
  throw new RequestValidationError(`invalid ${context} payload`, issues);
}

export function parseRouteId(value: unknown, label: string): string {
  return parseWithSchema(idString, value, label);
}

