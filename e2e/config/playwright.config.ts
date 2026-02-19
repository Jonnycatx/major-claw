import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "../tests",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000
  },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "../../playwright-report", open: "never" }]],
  outputDir: "../../test-results/playwright",
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  }
});

