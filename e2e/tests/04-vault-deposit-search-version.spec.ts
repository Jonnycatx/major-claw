import { test, expect } from "../fixtures/criticalTest";

test("vault deposit/search/version critical path @critical", async ({ gateway }) => {
  const title = `E2E Vault ${Date.now()}`;
  const deposit = await gateway.request<{ entry: { id: string; title: string } }>("/vault/deposit", {
    method: "POST",
    body: JSON.stringify({
      type: "kb",
      title,
      markdown_summary: "Important runbook entry for e2e validation.",
      importance_score: 9,
      tags: ["e2e", "runbook"],
      agent_id: "agent_cso"
    })
  });
  expect(deposit.status).toBe(200);
  expect(deposit.body.entry.title).toBe(title);

  const found = await gateway.request<{ items: Array<{ id: string; title: string }> }>(
    `/vault/search?query=${encodeURIComponent("runbook")}&limit=20`
  );
  expect(found.status).toBe(200);
  expect(found.body.items.some((item) => item.id === deposit.body.entry.id)).toBeTruthy();

  const version = await gateway.request<{ version: { entryId: string; versionNum: number } }>(
    `/vault/entries/${encodeURIComponent(deposit.body.entry.id)}/versions`,
    {
      method: "POST",
      body: JSON.stringify({
        markdown_summary: "Second version edit from e2e",
        diff: "added validation notes",
        importance_score: 10,
        tags: ["e2e", "v2"]
      })
    }
  );
  expect(version.status).toBe(200);
  expect(version.body.version.versionNum).toBeGreaterThan(1);

  const listVersions = await gateway.request<{ versions: Array<{ entryId: string }> }>(
    `/vault/entries/${encodeURIComponent(deposit.body.entry.id)}/versions`
  );
  expect(listVersions.status).toBe(200);
  expect(listVersions.body.versions.length).toBeGreaterThanOrEqual(2);
});

