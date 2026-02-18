import test from "node:test";
import assert from "node:assert/strict";
import { ModelRouter, StubProviderAdapter } from "./index.js";

test("routes to primary model when available", () => {
  const router = new ModelRouter();
  router.registerAdapter(new StubProviderAdapter("local"));
  router.setBinding({
    agentId: "agent_research",
    primary: "llama3.1:70b",
    fallbackChain: ["llama3.1:8b"],
    provider: "local"
  });

  const result = router.route("agent_research");
  assert.equal(result.model, "llama3.1:70b");
});

test("falls back when primary model unavailable", () => {
  const router = new ModelRouter();
  router.registerAdapter(new StubProviderAdapter("local"));
  router.setBinding({
    agentId: "agent_research",
    primary: "llama3.1:70b",
    fallbackChain: ["llama3.1:8b"],
    provider: "local"
  });
  router.markUnavailable("llama3.1:70b");

  const result = router.route("agent_research");
  assert.equal(result.model, "llama3.1:8b");
});
