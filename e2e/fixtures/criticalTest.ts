import { test as base, expect } from "@playwright/test";
import { GatewayHarness } from "./gatewayHarness";

type CriticalFixtures = {
  gateway: GatewayHarness;
};

export const test = base.extend<CriticalFixtures>({
  gateway: [
    async ({}, use, testInfo) => {
      const gateway = new GatewayHarness();
      try {
        await gateway.start();
      } catch (error) {
        if (error instanceof Error && error.message === "E2E_GATEWAY_BIND_EPERM") {
          if (process.env.E2E_REQUIRE_RUNTIME === "true") {
            throw new Error(
              "Critical E2E runtime requirement not met: sandbox/environment blocked socket binding."
            );
          }
          testInfo.skip(true, "sandbox does not allow binding sockets for gateway E2E");
        }
        throw error;
      }
      await use(gateway);
      await gateway.stop();
    },
    { scope: "test" }
  ]
});

export { expect };

