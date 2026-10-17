import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
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
        },
      },
    ],
  },
});
