import { afterEach, expect, it, vi } from "vitest";
import { config } from "../../src/shared/config";
import { storageConfig } from "../support/containers";
afterEach(() => vi.unstubAllEnvs());
it("validates runtime config without leaking invalid secrets", () => {
  for (const [key, value] of Object.entries(storageConfig())) vi.stubEnv(key, String(value));
  expect(config().MINIO_USE_SSL).toBe(false);
  expect(config().MAX_UPLOAD_BYTES).toBe(1024);
  vi.stubEnv("MINIO_USE_SSL", "true");
  expect(config().MINIO_USE_SSL).toBe(true);
  vi.stubEnv("MINIO_SECRET_KEY", "bad");
  expect(() => config()).toThrow("Invalid environment configuration");
});
