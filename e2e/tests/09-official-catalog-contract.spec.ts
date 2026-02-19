import { test, expect } from "../fixtures/criticalTest";

test("official catalog data contract remains intact @critical", async ({ gateway }) => {
  const response = await gateway.request<{
    items: Array<{ slug: string; name: string; category: string; setup: string[]; permissions: string[] }>;
    categories: Array<{ name: string; totalCount: number }>;
  }>("/integrations/all?query=&category=All%20Categories");
  expect(response.status).toBe(200);
  expect(response.body.items.length).toBeGreaterThan(30);
  expect(response.body.categories.some((entry) => entry.name === "All Categories")).toBeTruthy();

  const requiredSlugs = ["whatsapp", "openai", "github", "browser", "image-gen"];
  for (const slug of requiredSlugs) {
    expect(response.body.items.some((item) => item.slug === slug)).toBeTruthy();
  }

  for (const item of response.body.items.slice(0, 10)) {
    expect(item.setup.length).toBeGreaterThan(0);
    expect(item.permissions.length).toBeGreaterThan(0);
  }
});

