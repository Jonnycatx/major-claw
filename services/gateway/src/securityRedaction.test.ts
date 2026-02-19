import test from "node:test";
import assert from "node:assert/strict";
import { redactSensitiveObject, redactSensitiveString } from "./securityRedaction.js";

test("redactSensitiveString masks common secret patterns", () => {
  const input = "token=abc123 api_key: sk-ant-very-secret Authorization: Bearer xyz987";
  const output = redactSensitiveString(input);
  assert.equal(output.includes("abc123"), false);
  assert.equal(output.includes("sk-ant-very-secret"), false);
  assert.equal(output.includes("xyz987"), false);
  assert.equal(output.includes("[REDACTED]"), true);
});

test("redactSensitiveObject masks sensitive keys recursively", () => {
  const output = redactSensitiveObject({
    api_key: "super-secret",
    nested: { token: "private-token", ok: "value" },
    list: [{ password: "abc" }]
  }) as Record<string, unknown>;
  assert.equal(output.api_key, "[REDACTED]");
  assert.deepEqual(output.nested, { token: "[REDACTED]", ok: "value" });
});

