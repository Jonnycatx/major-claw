import { test, expect } from "../fixtures/criticalTest";

test("marketplace install path with assignment @critical", async ({ gateway }) => {
  const live = await gateway.request<{ skills: Array<{ slug: string }> }>("/clawhub/live?sort=downloads&nonSuspicious=true");
  expect(live.status).toBe(200);

  const slug = live.body.skills[0]?.slug ?? "community/e2e-skill";
  const install = await gateway.request<{ result: { installed: boolean; assignedAgentId?: string } }>("/clawhub/install", {
    method: "POST",
    body: JSON.stringify({
      slug,
      target_agent: "agent_cso"
    })
  });
  expect(install.status).toBe(200);
  expect(install.body.result.installed).toBeTruthy();
  expect(install.body.result.assignedAgentId).toBe("agent_cso");

  const installed = await gateway.request<{ skills: Array<{ slug: string; installed: boolean }> }>(
    "/clawhub/installed?agentId=agent_cso"
  );
  expect(installed.status).toBe(200);
  expect(installed.body.skills.some((skill) => skill.slug === slug && skill.installed)).toBeTruthy();
});

