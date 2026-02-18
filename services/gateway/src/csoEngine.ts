import type { TaskRecord, TaskStatus } from "@majorclaw/shared-types";

export interface DelegationRule {
  taskType: string;
  defaultAgentId: string;
  overrideAgentIds?: string[];
}

export interface TaskIntent {
  id: string;
  title: string;
  type: string;
  description?: string;
  priority: "low" | "normal" | "high";
}

interface RetryState {
  attempts: number;
  lastError?: string;
}

export class CsoOrchestrationEngine {
  private readonly rules = new Map<string, DelegationRule>();
  private readonly retries = new Map<string, RetryState>();
  private readonly deadLetterQueue: TaskIntent[] = [];
  private readonly manualInterventions = new Map<string, string>();

  registerRule(rule: DelegationRule): void {
    this.rules.set(rule.taskType, rule);
  }

  createTask(intent: TaskIntent): TaskRecord {
    const task: TaskRecord = {
      id: intent.id,
      title: intent.title,
      status: "inbox",
      priority: intent.priority,
      assigneeAgentId: null,
      parentTaskId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (intent.description) {
      task.description = intent.description;
    }
    return task;
  }

  createSubTask(parentTask: TaskRecord, intent: TaskIntent): TaskRecord {
    return {
      ...this.createTask(intent),
      parentTaskId: parentTask.id
    };
  }

  delegate(task: TaskRecord, overrideAgentId?: string): TaskRecord {
    return this.delegateByType(task, "default", overrideAgentId);
  }

  delegateByType(task: TaskRecord, taskType: string, overrideAgentId?: string): TaskRecord {
    const defaultRule = this.rules.get("default");
    const rule = this.rules.get(taskType) ?? defaultRule;
    const assignee = overrideAgentId ?? rule?.defaultAgentId;
    if (!assignee) {
      throw new Error("No delegation target configured");
    }
    return { ...task, assigneeAgentId: assignee, status: "assigned", updatedAt: new Date().toISOString() };
  }

  transition(task: TaskRecord, nextStatus: TaskStatus): TaskRecord {
    const transitions: Record<TaskStatus, TaskStatus[]> = {
      inbox: ["assigned", "failed"],
      assigned: ["in_progress", "failed"],
      in_progress: ["review", "failed"],
      review: ["done", "in_progress", "failed"],
      done: [],
      failed: ["assigned"]
    };
    if (!transitions[task.status].includes(nextStatus)) {
      throw new Error(`Invalid transition ${task.status} -> ${nextStatus}`);
    }
    return { ...task, status: nextStatus, updatedAt: new Date().toISOString() };
  }

  scheduleRetry(taskId: string, error: string): number {
    const state = this.retries.get(taskId) ?? { attempts: 0 };
    const nextAttempts = state.attempts + 1;
    this.retries.set(taskId, { attempts: nextAttempts, lastError: error });
    return Math.min(2 ** nextAttempts, 30);
  }

  sendToDeadLetter(intent: TaskIntent): void {
    this.deadLetterQueue.push(intent);
  }

  getDeadLetterQueue(): TaskIntent[] {
    return this.deadLetterQueue;
  }

  flagManualIntervention(taskId: string, reason: string): void {
    this.manualInterventions.set(taskId, reason);
  }

  getManualInterventionReason(taskId: string): string | undefined {
    return this.manualInterventions.get(taskId);
  }
}
