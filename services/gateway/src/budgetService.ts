import { randomUUID } from "node:crypto";
import type { Repository } from "@majorclaw/db";
import type { AgentBudget, UsageReport } from "@majorclaw/shared-types";
import type { EventBus } from "./eventBus.js";
import type { GatewayEvent } from "./types.js";

type BudgetConfigInput = {
  agentId: string;
  tokenLimit: number;
  costLimitUsd: number;
  hardKill: boolean;
};

export class BudgetService {
  constructor(
    private readonly repository: Repository,
    private readonly events: EventBus<GatewayEvent>
  ) {}

  list(): { global: AgentBudget; agents: AgentBudget[] } {
    const agents = this.repository.listAgents();
    const global = this.repository.getBudget("global");
    const perAgent = agents.map((agent) => this.repository.getBudget(agent.id));
    return { global, agents: perAgent };
  }

  configure(input: BudgetConfigInput): AgentBudget {
    const updated = this.repository.setBudget(input);
    this.repository.addAuditLog({
      id: randomUUID(),
      category: "budget",
      action: "configure",
      actor: "user",
      metadata: {
        agentId: input.agentId,
        tokenLimit: input.tokenLimit,
        costLimitUsd: input.costLimitUsd,
        hardKill: input.hardKill
      },
      createdAt: new Date().toISOString()
    });
    this.events.emit({
      type: "budget.configured",
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
      payload: {
        agentId: input.agentId
      }
    });
    return updated;
  }

  registerUsage(report: UsageReport): { allowed: boolean; reason?: string; budget: AgentBudget } {
    const agentBudget = this.repository.applyUsageToBudget(
      report.agentId,
      report.promptTokens,
      report.completionTokens,
      report.costUsd
    );
    const globalBudget = this.repository.applyUsageToBudget("global", report.promptTokens, report.completionTokens, report.costUsd);
    this.repository.addUsageReport(report);
    const blockedAgent = this.isExceeded(agentBudget);
    const blockedGlobal = this.isExceeded(globalBudget);
    if ((blockedAgent && agentBudget.hardKill) || (blockedGlobal && globalBudget.hardKill)) {
      const reason = blockedGlobal ? "Global budget limit reached." : "Agent budget limit reached.";
      this.repository.addAuditLog({
        id: randomUUID(),
        category: "budget",
        action: "hard_kill",
        actor: "system",
        metadata: { agentId: report.agentId, reason },
        createdAt: new Date().toISOString()
      });
      this.events.emit({
        type: "budget.hard_kill",
        timestamp: new Date().toISOString(),
        requestId: randomUUID(),
        payload: { agentId: report.agentId, reason }
      });
      return { allowed: false, reason, budget: agentBudget };
    }
    if (blockedAgent || blockedGlobal) {
      const reason = blockedGlobal ? "Global budget threshold exceeded." : "Agent budget threshold exceeded.";
      this.repository.addAuditLog({
        id: randomUUID(),
        category: "budget",
        action: "warning",
        actor: "system",
        metadata: { agentId: report.agentId, reason },
        createdAt: new Date().toISOString()
      });
      this.events.emit({
        type: "budget.warning",
        timestamp: new Date().toISOString(),
        requestId: randomUUID(),
        payload: { agentId: report.agentId, reason }
      });
    }
    return { allowed: true, budget: agentBudget };
  }

  canRun(agentId: string): { allowed: boolean; reason?: string } {
    const budget = this.repository.getBudget(agentId);
    const global = this.repository.getBudget("global");
    const blockedAgent = this.isExceeded(budget) && budget.hardKill;
    const blockedGlobal = this.isExceeded(global) && global.hardKill;
    if (blockedAgent || blockedGlobal) {
      return { allowed: false, reason: blockedGlobal ? "Global hard kill active." : "Agent hard kill active." };
    }
    return { allowed: true };
  }

  private isExceeded(budget: AgentBudget): boolean {
    return budget.currentTokens >= budget.tokenLimit || budget.currentCostUsd >= budget.costLimitUsd;
  }
}
