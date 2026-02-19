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
      // Keep retrying until timeout.
    }
    await sleep(150);
  }
  throw new Error("gateway did not become ready in time");
}

test("gateway enforces session token for protected routes", async (t) => {
  const port = 4600 + Math.floor(Math.random() * 300);
  const token = `test-token-${Date.now()}`;
  const tempDir = mkdtempSync(join(tmpdir(), "majorclaw-gateway-auth-"));
  const dbPath = join(tempDir, "gateway-auth.db");
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

    const unauthorized = await fetch(`${baseUrl}/chat/threads`);
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`${baseUrl}/chat/threads`, {
      headers: { "x-session-token": token }
    });
    assert.equal(authorized.status, 200);
    const payload = (await authorized.json()) as { threads?: unknown[] };
    assert.equal(Array.isArray(payload.threads), true);
  } finally {
    child.kill("SIGTERM");
    rmSync(tempDir, { recursive: true, force: true });
  }
});
