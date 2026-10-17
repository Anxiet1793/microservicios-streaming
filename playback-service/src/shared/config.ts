import { z } from "zod";
const integer = (fallback: number, min = 1, max = 2147483647) => z.coerce.number().int().min(min).max(max).default(fallback);
const schema = z.object({
  MONGODB_URI: z.string().min(1), MONGODB_DATABASE: z.string().regex(/^[a-zA-Z0-9_]+$/).default("playback_service"),
  MINIO_ENDPOINT: z.string().min(1), MINIO_PORT: integer(9000, 1, 65535), MINIO_USE_SSL: z.enum(["true", "false"]).default("false").transform(v => v === "true"),
  MINIO_ACCESS_KEY: z.string().min(3), MINIO_SECRET_KEY: z.string().min(16), MINIO_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9-]{2,62}$/).default("streaming-media"),
  MINIO_PUBLIC_URL: z.url(), PLAYBACK_URL_TTL: integer(900, 60, 3600),
  CATALOG_SERVICE_URL: z.url(), USERS_JWKS_URL: z.url(), JWT_ISSUER: z.string().default("users-service"), JWT_AUDIENCE: z.string().default("streaming-services"),
  MAX_UPLOAD_BYTES: integer(268435456, 1024, 1073741824), UPLOAD_LIMIT_PER_HOUR: integer(10, 1, 100),
  FFPROBE_PATH: z.string().default("ffprobe"), APP_ORIGIN: z.url().default("http://localhost:3002"),
});
export type Config = z.infer<typeof schema>;
export function config(): Config { const result = schema.safeParse(process.env); if (!result.success) throw new Error("Invalid environment configuration"); return result.data; }
