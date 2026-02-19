import { test, expect } from "../fixtures/criticalTest";

test("onboarding path can create first additional agent @critical", async ({ gateway }) => {
  const name = `Onboarding Agent ${Date.now()}`;
  const created = await gateway.request<{ agent: { id: string; name: string; role: string } }>("/agents/create", {
    method: "POST",
    body: JSON.stringify({
      name,
      role: "research",
      parent_id: "agent_cso",
      model_provider: "anthropic",
      model_name: "claude-3-5-sonnet",
      temperature: 0.4,
      max_tokens: 4096
    })
  });
  expect(created.status).toBe(200);
  expect(created.body.agent.name).toBe(name);

  const full = await gateway.request<{ agent: { id: string; installedSkills: string[]; stats: { tokensToday: number } } }>(
    `/agents/${encodeURIComponent(created.body.agent.id)}/full`
  );
  expect(full.status).toBe(200);
  expect(full.body.agent.id).toBe(created.body.agent.id);
  expect(full.body.agent.stats.tokensToday).toBeGreaterThanOrEqual(0);
});

