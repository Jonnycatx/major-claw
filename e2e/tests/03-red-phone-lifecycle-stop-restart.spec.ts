import { test, expect } from "@playwright/test";
import { GatewayHarness } from "../fixtures/gatewayHarness";

test("red phone audit + lifecycle stop/restart @critical", async ({}, testInfo) => {
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
    const redPhone = await gateway.request<{ log: { action: string; metadata: { reason?: string } } }>("/system/red-phone", {
      method: "POST",
      body: JSON.stringify({ reason: "E2E emergency stop", actor: "qa" })
    });
    expect(redPhone.status).toBe(200);
    expect(redPhone.body.log.action).toBe("red_phone_shutdown");
    expect(redPhone.body.log.metadata.reason).toContain("E2E emergency stop");

    const shutdown = await gateway.request("/system/shutdown", {
      method: "POST",
      body: JSON.stringify({ reason: "E2E lifecycle stop", actor: "qa" })
    });
    expect(shutdown.status).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 1200));
    const readyAfterStop = await fetch(`${gateway.baseUrl}/ready`).catch(() => null);
    expect(readyAfterStop).toBeNull();

    await gateway.start();
    const readyAfterRestart = await fetch(`${gateway.baseUrl}/ready`, {
      headers: { "x-session-token": gateway.token }
    });
    expect(readyAfterRestart.ok).toBeTruthy();
  } finally {
    await gateway.stop();
  }
});

