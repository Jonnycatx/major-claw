import test from "node:test";
import assert from "node:assert/strict";
import { CsoOrchestrationEngine } from "./csoEngine.js";

test("delegates task using rule", () => {
  const cso = new CsoOrchestrationEngine();
  cso.registerRule({ taskType: "research", defaultAgentId: "agent_research" });
  cso.registerRule({ taskType: "default", defaultAgentId: "agent_review" });

  const task = cso.createTask({ id: "task_1", title: "Gather sources", type: "research", priority: "normal" });
  const delegated = cso.delegateByType(task, "research");

  assert.equal(delegated.assigneeAgentId, "agent_research");
  assert.equal(delegated.status, "assigned");
});

test("creates retry backoff and dead-letter records", () => {
  const cso = new CsoOrchestrationEngine();
  const seconds = cso.scheduleRetry("task_2", "timeout");
  cso.sendToDeadLetter({ id: "task_2", title: "Long job", type: "analysis", priority: "high" });

  assert.ok(seconds > 0);
  assert.equal(cso.getDeadLetterQueue().length, 1);
});
