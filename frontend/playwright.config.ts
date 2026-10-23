import { defineConfig, devices } from "@playwright/test";
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3003";
if (!process.env.E2E_FIXTURE)
  throw new Error("Use npm run test:e2e to create an isolated test stack.");
if (!["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname))
  throw new Error("E2E only supports the local development environment.");
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  retries: 0,
  forbidOnly: !!process.env.CI,
  globalTimeout: 15 * 60 * 1000,
  reporter: [
    ["./tests/support/redact-reporter.ts"],
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
  ],
  use: {
    baseURL,
    trace: process.env.CI ? { mode: "retain-on-failure", snapshots: false, sources: false } : "off",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
