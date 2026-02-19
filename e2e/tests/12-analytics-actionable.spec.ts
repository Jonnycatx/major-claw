import { test, expect } from "../fixtures/criticalTest";

test("analytics snapshot includes trends deltas and forecasts @critical", async ({ gateway }) => {
  for (let i = 0; i < 10; i += 1) {
    const report = await gateway.request("/chat/send", {
      method: "POST",
      body: JSON.stringify({
        thread_id: "thread_cso_default",
        content: `analytics probe ${i} research budget trend`,
        user_id: i % 2 === 0 ? "operator" : "planner"
      })
    });
    expect(report.status).toBe(200);
  }

  const snapshot = await gateway.request<{
    snapshot: {
      range: string;
      trends: { spend: unknown[]; vaultUsage: unknown[]; activeAgents: unknown[] };
      perAgent: unknown[];
      forecasts: unknown[];
      recommendations: string[];
    };
  }>("/analytics/snapshot?range=30d");
  expect(snapshot.status).toBe(200);
  expect(snapshot.body.snapshot.range).toBe("30d");
  expect(snapshot.body.snapshot.trends.spend.length).toBe(30);
  expect(snapshot.body.snapshot.trends.vaultUsage.length).toBe(30);
  expect(snapshot.body.snapshot.trends.activeAgents.length).toBe(30);
  expect(snapshot.body.snapshot.perAgent.length).toBeGreaterThan(0);
  expect(snapshot.body.snapshot.forecasts.length).toBeGreaterThan(0);
  expect(Array.isArray(snapshot.body.snapshot.recommendations)).toBeTruthy();
});

test("analytics export returns valid json and csv payloads @critical", async ({ gateway }) => {
  const jsonExport = await gateway.request<{ format: string; payload: string }>("/analytics/export?range=7d&format=json");
  expect(jsonExport.status).toBe(200);
  expect(jsonExport.body.format).toBe("json");
  const parsed = JSON.parse(jsonExport.body.payload) as { range: string; kpis?: unknown };
  expect(parsed.range).toBe("7d");
  expect(parsed.kpis).toBeTruthy();

  const csvExport = await gateway.request<{ format: string; payload: string }>("/analytics/export?range=7d&format=csv");
  expect(csvExport.status).toBe(200);
  expect(csvExport.body.format).toBe("csv");
  expect(csvExport.body.payload.includes("section,key,value")).toBeTruthy();
  expect(csvExport.body.payload.includes("kpi,spend.value")).toBeTruthy();
});

