import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/{unit,api,contract,integration}/**/*.test.ts"],
    restoreMocks: true,
    clearMocks: true,
    fileParallelism: false,
    reporters: ["default", "json", "junit"],
    outputFile: { json: "coverage/test-results.json", junit: "coverage/junit.xml" },
    testTimeout: 30000,
    hookTimeout: 300000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text", "json-summary", "json", "html", "lcov"],
      reportsDirectory: "coverage",
      thresholds: {
        lines: 70,
        statements: 70,
        branches: 70,
        functions: 70,
        "src/modules/**/domain/**/*.ts": { lines: 80, statements: 80, branches: 80, functions: 80 },
        "src/modules/**/application/**/*.ts": {
          lines: 80,
          statements: 80,
          branches: 80,
          functions: 80,
        },
      },
    },
  },
});
