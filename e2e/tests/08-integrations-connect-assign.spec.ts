import { test, expect } from "../fixtures/criticalTest";

test("integrations connect and assign to agent @critical", async ({ gateway }) => {
  const list = await gateway.request<{ items: Array<{ slug: string; category: string }> }>(
    "/integrations/all?query=&category=AI%20Models"
  );
  expect(list.status).toBe(200);
  const target = list.body.items.find((item) => item.slug === "openai") ?? list.body.items[0];
  expect(target).toBeTruthy();

  const connected = await gateway.request<{ integration: { status: string; assignedAgentIds: string[] } }>(
    `/integrations/${encodeURIComponent(target!.slug)}/connect`,
    {
      method: "POST",
      body: JSON.stringify({
        target_agent_ids: ["agent_cso"],
        config: { apiKey: "sk-e2e-test-key", model: "gpt-4.1-mini" }
      })
    }
  );
  expect(connected.status).toBe(200);
  expect(connected.body.integration.status).toBe("connected");
  expect(connected.body.integration.assignedAgentIds).toContain("agent_cso");

  const status = await gateway.request<{ status: string }>(`/integrations/${encodeURIComponent(target!.slug)}/status`);
  expect(status.status).toBe(200);
  expect(status.body.status).toBe("connected");
});

