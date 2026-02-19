import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { GatewayHarness } from "../fixtures/gatewayHarness";

test("daemon restart and orphan prevention via pid lock @critical", async ({}, testInfo) => {
  const gateway = new GatewayHarness();
  try {
    await gateway.start();
  } catch (error) {
    if (error instanceof Error && error.message === "E2E_GATEWAY_BIND_EPERM") {
      if (process.env.E2E_REQUIRE_RUNTIME === "true") {
        throw new Error("Critical E2E runtime requirement not met: gateway socket bind failed.");
      }
      testInfo.skip(true, "sandbox does not allow binding sockets for gateway E2E");
    }
    throw error;
  }
  try {
    const duplicate = spawn("node", ["--import", "tsx", "src/server.ts"], {
      cwd: `${process.cwd()}/services/gateway`,
      env: {
        ...process.env,
        MAJORCLAW_GATEWAY_PORT: String(gateway.port + 1),
        MAJORCLAW_GATEWAY_SESSION_TOKEN: gateway.token,
        MAJORCLAW_DB_PATH: gateway.dbPath,
        MAJORCLAW_GATEWAY_PID_FILE: gateway.pidPath
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    const exited = await new Promise<number | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 2500);
      duplicate.once("exit", (code) => {
        clearTimeout(timeout);
        resolve(code);
      });
    });
    expect(exited).not.toBeNull();
    expect(exited).not.toBe(0);

    const shutdown = await gateway.request("/system/shutdown", {
      method: "POST",
      body: JSON.stringify({ reason: "e2e-daemon-restart", actor: "qa" })
    });
    expect(shutdown.status).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 1100));
    await gateway.start();
    const ready = await fetch(`${gateway.baseUrl}/ready`, { headers: { "x-session-token": gateway.token } });
    expect(ready.ok).toBeTruthy();
  } finally {
    await gateway.stop();
  }
});

