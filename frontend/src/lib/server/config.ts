import "server-only";
import { z } from "zod";
export function config() {
  const parsed = z
    .object({
      USERS_SERVICE_URL: z.url().default("http://127.0.0.1:3001"),
      CATALOG_SERVICE_URL: z.url().default("http://127.0.0.1:3000"),
      PLAYBACK_SERVICE_URL: z.url().default("http://127.0.0.1:3002"),
      REDIS_URL: z.string().default("redis://127.0.0.1:6380"),
      APP_ORIGIN: z.url().default("http://localhost:3003"),
      SESSION_SECRET: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .safeParse(process.env);
  if (!parsed.success) throw new Error("Invalid frontend server configuration");
  return parsed.data;
}
