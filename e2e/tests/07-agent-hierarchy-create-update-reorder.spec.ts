import { test, expect } from "../fixtures/criticalTest";

test("agent hierarchy create update reorder path @critical", async ({ gateway }) => {
  const create = await gateway.request<{ agent: { id: string } }>("/agents/create", {
    method: "POST",
    body: JSON.stringify({
      name: `Hierarchy Agent ${Date.now()}`,
      role: "analysis",
      parent_id: "agent_cso",
      model_provider: "google",
      model_name: "gemini-2.0-flash"
    })
  });
  expect(create.status).toBe(200);
  const agentId = create.body.agent.id;

  const update = await gateway.request<{ agent: { modelProvider?: string; modelName?: string } }>(
    `/agents/${encodeURIComponent(agentId)}/config`,
    {
      method: "PATCH",
      body: JSON.stringify({
        model_provider: "openai",
        model_name: "gpt-4.1-mini",
        temperature: 0.2
      })
    }
  );
  expect(update.status).toBe(200);
  expect(update.body.agent.modelProvider).toBe("openai");

  const agents = await gateway.request<{ agents: Array<{ id: string }> }>("/agents");
  const reordered = await gateway.request<{ agents: Array<{ id: string }> }>("/agents/reorder", {
    method: "POST",
    body: JSON.stringify({
      order: [agentId, ...agents.body.agents.map((agent) => agent.id).filter((id) => id !== agentId)]
    })
  });
  expect(reordered.status).toBe(200);
  expect(reordered.body.agents[0]?.id).toBe(agentId);
});

