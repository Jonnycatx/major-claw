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
      // retry
    }
    await sleep(150);
  }
  throw new Error("gateway did not become ready in time");
}

test("gateway supports graceful shutdown endpoint", async (t) => {
  const port = 4950 + Math.floor(Math.random() * 300);
  const token = `test-token-${Date.now()}`;
  const tempDir = mkdtempSync(join(tmpdir(), "majorclaw-gateway-lifecycle-"));
  const dbPath = join(tempDir, "gateway-lifecycle.db");
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

    const response = await fetch(`${baseUrl}/system/shutdown`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": token
      },
      body: JSON.stringify({ reason: "test", actor: "test" })
    });
    assert.equal(response.status, 200);

    const exited = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 10_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
    assert.equal(exited, true);
  } finally {
    child.kill("SIGTERM");
    rmSync(tempDir, { recursive: true, force: true });
  }
});

