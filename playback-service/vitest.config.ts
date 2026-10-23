import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/{unit,api,contract}/**/*.test.ts"],
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
