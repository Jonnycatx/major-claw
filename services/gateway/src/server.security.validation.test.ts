import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitReady(baseUrl: string, attempts = 40): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${baseUrl}/ready`);
      if (res.ok) {
        return;
      }
    } catch {
      // keep retrying
    }
    await sleep(150);
  }
  throw new Error("gateway did not become ready in time");
}

test("mutating routes reject invalid payloads with 422", async (t) => {
  const port = 5000 + Math.floor(Math.random() * 300);
  const token = `test-token-${Date.now()}`;
  const tempDir = mkdtempSync(join(tmpdir(), "majorclaw-gateway-validate-"));
  const dbPath = join(tempDir, "gateway-validate.db");
  const pidPath = join(tempDir, "gateway.pid");
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn("node", ["--import", "tsx", "src/server.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MAJORCLAW_GATEWAY_PORT: String(port),
      MAJORCLAW_GATEWAY_SESSION_TOKEN: token,
      MAJORCLAW_DB_PATH: dbPath,
      MAJORCLAW_GATEWAY_PID_FILE: pidPath
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    try {
      await waitReady(baseUrl);
    } catch (error) {
      if (stderr.includes("EPERM: operation not permitted")) {
        t.skip("sandbox environment does not allow listening sockets");
        return;
      }
      throw error;
    }

    const invalid = await fetch(`${baseUrl}/tasks/create`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": token
      },
      body: JSON.stringify({ title: "" })
    });
    assert.equal(invalid.status, 422);
    const payload = (await invalid.json()) as { error?: { code?: string } };
    assert.equal(payload.error?.code, "ValidationError");
  } finally {
    child.kill("SIGTERM");
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("malformed API key test does not mark key as stored", async (t) => {
  const port = 5400 + Math.floor(Math.random() * 300);
  const token = `test-token-${Date.now()}`;
  const tempDir = mkdtempSync(join(tmpdir(), "majorclaw-gateway-key-"));
  const dbPath = join(tempDir, "gateway-key.db");
  const pidPath = join(tempDir, "gateway.pid");
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn("node", ["--import", "tsx", "src/server.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MAJORCLAW_GATEWAY_PORT: String(port),
      MAJORCLAW_GATEWAY_SESSION_TOKEN: token,
      MAJORCLAW_DB_PATH: dbPath,
      MAJORCLAW_GATEWAY_PID_FILE: pidPath
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    try {
      await waitReady(baseUrl);
    } catch (error) {
      if (stderr.includes("EPERM: operation not permitted")) {
        t.skip("sandbox environment does not allow listening sockets");
        return;
      }
      throw error;
    }

    const create = await fetch(`${baseUrl}/agents/create`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": token
      },
      body: JSON.stringify({
        name: "Key Test Agent",
        role: "researcher",
        model_provider: "anthropic",
        model_name: "claude-3-5-sonnet"
      })
    });
    assert.equal(create.status, 200);
    const created = (await create.json()) as { agent: { id: string } };
    const agentId = created.agent.id;

    const tested = await fetch(`${baseUrl}/agents/${agentId}/test-connection`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": token
      },
      body: JSON.stringify({ api_key: "bad-key" })
    });
    assert.equal(tested.status, 200);
    const testedPayload = (await tested.json()) as { result: { ok: boolean } };
    assert.equal(testedPayload.result.ok, false);

    const full = await fetch(`${baseUrl}/agents/${agentId}/full`, {
      headers: { "x-session-token": token }
    });
    assert.equal(full.status, 200);
    const fullPayload = (await full.json()) as { agent: { apiKeyMasked: string } };
    assert.equal(fullPayload.agent.apiKeyMasked, "");
  } finally {
    child.kill("SIGTERM");
    rmSync(tempDir, { recursive: true, force: true });
  }
});

