import { test, expect } from "../fixtures/criticalTest";

test("permissions request approve deny lifecycle @critical", async ({ gateway }) => {
  const requested = await gateway.request<{ grants: Array<{ id: string; capability: string }> }>("/permissions/request", {
    method: "POST",
    body: JSON.stringify({
      agent_id: "agent_cso",
      capabilities: ["vault.write", "network.http"],
      context: { flow: "e2e_approval" }
    })
  });
  expect(requested.status).toBe(200);
  expect(requested.body.grants.length).toBe(2);

  const pendingBefore = await gateway.request<{ pending: Array<{ id: string }> }>("/permissions/pending?agentId=agent_cso");
  expect(pendingBefore.body.pending.length).toBeGreaterThanOrEqual(2);

  const [first, second] = requested.body.grants;
  const approved = await gateway.request<{ grant: { granted: boolean } }>("/permissions/approve", {
    method: "POST",
    body: JSON.stringify({ grant_id: first.id })
  });
  expect(approved.status).toBe(200);
  expect(approved.body.grant.granted).toBeTruthy();

  const denied = await gateway.request<{ grant: { granted: boolean } }>("/permissions/deny", {
    method: "POST",
    body: JSON.stringify({ grant_id: second.id })
  });
  expect(denied.status).toBe(200);
  expect(denied.body.grant.granted).toBeFalsy();

  const logs = await gateway.request<{ logs: Array<{ category: string; action: string }> }>("/audit/logs?limit=30");
  const actions = logs.body.logs.map((entry) => `${entry.category}:${entry.action}`);
  expect(actions).toContain("permissions:request");
  expect(actions).toContain("permissions:approve");
  expect(actions).toContain("permissions:deny");
});

