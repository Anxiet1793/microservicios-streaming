import { z } from "zod";
const schema = z.object({
  DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//),
  APP_ENV: z.enum(["development", "test", "production"]).default("production"),
  APP_ORIGIN: z.url(),
  JWT_ISSUER: z.string().min(1).default("users-service"),
  JWT_AUDIENCE: z.string().min(1).default("streaming-services"),
  JWT_KEY_ID: z
    .string()
    .regex(/^[\w-]{1,100}$/)
    .default("users-key-1"),
  JWT_PRIVATE_KEY: z.string().min(100),
  JWT_PUBLIC_KEY: z.string().min(100),
  ACCESS_TOKEN_TTL: z.coerce.number().int().min(60).max(1800).default(900),
  REFRESH_TOKEN_TTL: z.coerce.number().int().min(3600).max(2592000).default(2592000),
  REQUEST_MAX_BYTES: z.coerce.number().int().min(1024).max(65536).default(16384),
  AUTH_RATE_WINDOW: z.coerce.number().int().min(60).max(3600).default(900),
  AUTH_GLOBAL_LIMIT: z.coerce.number().int().min(1).max(10000).default(200),
  LOGIN_RATE_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
  REGISTER_RATE_LIMIT: z.coerce.number().int().min(1).max(100).default(5),
});
export type Config = z.infer<typeof schema>;
export function readConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success)
    throw new Error(
      `Configuración inválida: ${[...new Set(parsed.error.issues.map((i) => i.path[0]))].join(", ")}`,
    );
  const config = parsed.data;
  const origin = new URL(config.APP_ORIGIN);
  if (
    origin.origin !== config.APP_ORIGIN ||
    origin.username ||
    origin.password ||
    !["http:", "https:"].includes(origin.protocol) ||
    (config.APP_ENV === "production" && origin.protocol !== "https:")
  )
    throw new Error("APP_ORIGIN inválido; producción requiere HTTPS.");
  return config;
}
