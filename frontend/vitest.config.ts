import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    fileParallelism: false,
    reporters: ["default", "json", "junit"],
    outputFile: { json: "coverage/test-results.json", junit: "coverage/junit.xml" },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html", "lcov"],
      include: [
        "src/components/**/*.{ts,tsx}",
        "src/features/**/*.{ts,tsx}",
        "src/lib/api/client.ts",
        "src/lib/models.ts",
      ],
      exclude: ["**/*.css"],
      thresholds: { lines: 75, statements: 75, branches: 65, functions: 65 },
    },
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "components",
          include: ["tests/component/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["tests/support/setup.ts"],
        },
      },
    ],
  },
});
