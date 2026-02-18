import { randomUUID } from "node:crypto";
import type { Repository } from "@majorclaw/db";
import type {
  DelegationPlanStep,
  SkillSuggestionPayload,
  SwarmChatMessage,
  SwarmChatThread,
  SwarmSummary
} from "@majorclaw/shared-types";
import type { CsoOrchestrationEngine, TaskIntent } from "./csoEngine.js";

const DEFAULT_THREAD_ID = "thread_cso_default";

function nowIso(): string {
  return new Date().toISOString();
}

function markdownPlan(goal: string, steps: DelegationPlanStep[]): string {
  const lines = [`### CSO Plan`, `Goal: ${goal}`, ``];
  for (const [index, step] of steps.entries()) {
    lines.push(`${index + 1}. ${step.task} -> @${step.agentId}`);
  }
  return lines.join("\n");
}

function maybeSuggestion(input: string): SkillSuggestionPayload | null {
  const lowered = input.toLowerCase();
  if (lowered.includes("research") || lowered.includes("market") || lowered.includes("latest")) {
    return {
      slug: "tavily-search",
      name: "Tavily Web Search",
      reason: "Fresh external data would unblock research quality and speed.",
      targetAgentId: "agent_research",
      permissions: ["network.http", "filesystem.read"]
    };
  }
  if (lowered.includes("email") || lowered.includes("inbox") || lowered.includes("outreach")) {
    return {
      slug: "gog",
      name: "Gog",
      reason: "Email automation is needed for reliable outbound and inbox workflows.",
      targetAgentId: "agent_cso",
      permissions: ["gmail.read", "gmail.send", "network.http"]
    };
  }
  return null;
}

export class ChatService {
  private lastPulseAt = 0;

  constructor(
    private readonly repository: Repository,
    private readonly cso: CsoOrchestrationEngine
  ) {
    const existing = this.repository.listChatThreads();
    if (existing.length === 0) {
      this.repository.upsertChatThread({
        id: DEFAULT_THREAD_ID,
        title: "CSO Command Chat",
        createdAt: nowIso(),
        updatedAt: nowIso()
      });
      this.repository.appendSwarmMessage({
        id: randomUUID(),
        threadId: DEFAULT_THREAD_ID,
        type: "system",
        author: "system",
        content: "Swarm online. Ask the CSO anything.",
        createdAt: nowIso()
      });
    }
  }

  listThreads(): SwarmChatThread[] {
    return this.repository.listChatThreads();
  }

  getSummary(): SwarmSummary {
    return this.repository.getSwarmSummary();
  }

  listMessages(threadId = DEFAULT_THREAD_ID): SwarmChatMessage[] {
    this.maybePulse(threadId);
    return this.repository.listSwarmMessages(threadId);
  }

  sendMessage(threadId: string, content: string, userId: string): SwarmChatMessage[] {
    const emitted: SwarmChatMessage[] = [];
    const userMessage: SwarmChatMessage = {
      id: randomUUID(),
      threadId,
      type: "user",
      author: userId,
      content,
      createdAt: nowIso()
    };
    this.repository.appendSwarmMessage(userMessage);
    emitted.push(userMessage);

    const quick = content.trim().toLowerCase();
    if (quick === "/status") {
      const summary = this.getSummary();
      const message: SwarmChatMessage = {
        id: randomUUID(),
        threadId,
        type: "cso",
        author: "CSO",
        content: `Swarm status: ${summary.onlineAgents} agents online, ${summary.activeTasks} active tasks, $${summary.spendTodayUsd.toFixed(
          2
        )} spend today.`,
        createdAt: nowIso(),
        parentMessageId: userMessage.id
      };
      this.repository.appendSwarmMessage(message);
      emitted.push(message);
      return emitted;
    }

    const needsDelegation = /(plan|build|ship|research|analy|debug|implement|campaign|strategy|delegate)/i.test(content);
    if (!needsDelegation) {
      const direct: SwarmChatMessage = {
        id: randomUUID(),
        threadId,
        type: "cso",
        author: "CSO",
        content:
          "I can help directly, or delegate to specialists. If you want swarm execution, say: 'delegate this' or describe a goal with constraints.",
        createdAt: nowIso(),
        parentMessageId: userMessage.id
      };
      this.repository.appendSwarmMessage(direct);
      emitted.push(direct);
      const suggestion = maybeSuggestion(content);
      if (suggestion) {
        emitted.push(this.pushSuggestion(threadId, userMessage.id, suggestion));
      }
      return emitted;
    }

    const steps: DelegationPlanStep[] = [
      { id: randomUUID(), task: "Clarify scope and success criteria", agentId: "agent_cso", status: "assigned" },
      { id: randomUUID(), task: "Gather external context and references", agentId: "agent_research", status: "assigned" },
      { id: randomUUID(), task: "Synthesize findings into actionable output", agentId: "agent_data", status: "assigned" },
      { id: randomUUID(), task: "Polish final response and QA", agentId: "agent_review", status: "assigned" }
    ];
    const csoPlanMessage: SwarmChatMessage = {
      id: randomUUID(),
      threadId,
      type: "delegation",
      author: "CSO",
      content: markdownPlan(content, steps),
      createdAt: nowIso(),
      parentMessageId: userMessage.id,
      metadata: { steps }
    };
    this.repository.appendSwarmMessage(csoPlanMessage);
    this.repository.upsertDelegationPlan(csoPlanMessage.id, steps);
    emitted.push(csoPlanMessage);

    for (const step of steps) {
      const intent: TaskIntent = {
        id: randomUUID(),
        title: step.task,
        type: "default",
        priority: "normal",
        description: content
      };
      const task = this.cso.createTask(intent);
      const delegated = this.cso.delegate(task, step.agentId);
      this.repository.upsertTask(delegated);

      const update: SwarmChatMessage = {
        id: randomUUID(),
        threadId,
        type: "agent_update",
        author: `@${step.agentId}`,
        content: `Started: ${step.task}`,
        createdAt: nowIso(),
        parentMessageId: csoPlanMessage.id,
        metadata: { status: "in_progress" }
      };
      this.repository.appendSwarmMessage(update);
      emitted.push(update);
    }

    const suggestion = maybeSuggestion(content);
    if (suggestion) {
      emitted.push(this.pushSuggestion(threadId, userMessage.id, suggestion));
    }

    const summary: SwarmChatMessage = {
      id: randomUUID(),
      threadId,
      type: "cso",
      author: "CSO",
      content: "Delegation in motion. I will stream major milestones and raise blockers proactively.",
      createdAt: nowIso(),
      parentMessageId: userMessage.id
    };
    this.repository.appendSwarmMessage(summary);
    emitted.push(summary);
    return emitted;
  }

  runQuickAction(threadId: string, action: "morning_briefing" | "status_report" | "suggest_skills" | "delegate_task"): SwarmChatMessage[] {
    const templates: Record<typeof action, string> = {
      morning_briefing: "Morning briefing: summarize priorities, risks, and immediate next actions.",
      status_report: "/status",
      suggest_skills: "Suggest skills that would improve swarm throughput this week.",
      delegate_task: "Delegate a fresh strategic task across the swarm with a clear execution plan."
    };
    return this.sendMessage(threadId, templates[action], "user");
  }

  private pushSuggestion(threadId: string, parentMessageId: string, suggestion: SkillSuggestionPayload): SwarmChatMessage {
    const message: SwarmChatMessage = {
      id: randomUUID(),
      threadId,
      type: "skill_suggestion",
      author: "CSO",
      content: `${suggestion.name}: ${suggestion.reason}`,
      createdAt: nowIso(),
      parentMessageId,
      metadata: { ...suggestion }
    };
    this.repository.appendSwarmMessage(message);
    this.repository.upsertSkillSuggestion(message.id, suggestion);
    return message;
  }

  private maybePulse(threadId: string): void {
    const now = Date.now();
    if (now - this.lastPulseAt < 20000) {
      return;
    }
    this.lastPulseAt = now;
    const pulse: SwarmChatMessage = {
      id: randomUUID(),
      threadId,
      type: "system",
      author: "system",
      content: "Heartbeat: swarm synced and listening.",
      createdAt: nowIso()
    };
    this.repository.appendSwarmMessage(pulse);
  }
}
