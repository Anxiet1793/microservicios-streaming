import { randomUUID } from "node:crypto";
import { z } from "zod";
import { container } from "../../../../bootstrap/container";
import { fail, identifier, PlaybackError } from "../../domain/model";
import * as useCases from "../../application/use-cases";
import { rateLimit } from "../../infrastructure/adapters";
import { receiveUpload } from "./upload";

type Context = { params: Promise<Record<string, string>> };
type Handler = (request: Request, context: Context) => Promise<Response>;
const statuses: Record<string, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  TITLE_NOT_FOUND: 404,
  MEDIA_ASSET_NOT_FOUND: 404,
  PLAYBACK_SESSION_NOT_FOUND: 404,
  INVALID_PLAYBACK_TRANSITION: 409,
  TITLE_NOT_PUBLISHED: 409,
  MEDIA_ASSET_IN_USE: 409,
  SESSION_SUPERSEDED: 409,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  CATALOG_SERVICE_UNAVAILABLE: 503,
  STORAGE_UNAVAILABLE: 503,
};
export function handle(action: string, handler: Handler): Handler {
  return async (request, context) => {
    const requestId = randomUUID(),
      started = Date.now();
    let response: Response;
    let allowedOrigin: string | undefined;
    try {
      const c = container();
      allowedOrigin = c.config.APP_ORIGIN;
      const origin = request.headers.get("origin");
      if (origin && origin !== c.config.APP_ORIGIN) fail("FORBIDDEN");
      response = await handler(request, context);
    } catch (error) {
      const code =
        error instanceof z.ZodError
          ? "VALIDATION_ERROR"
          : error instanceof PlaybackError
            ? error.code
            : "INTERNAL_SERVER_ERROR";
      response = Response.json(
        {
          error: {
            code,
            message: code === "INTERNAL_SERVER_ERROR" ? "No se pudo completar la operación." : code,
          },
        },
        { status: statuses[code] ?? 500 },
      );
      if (code === "RATE_LIMITED") response.headers.set("Retry-After", "60");
    }
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Request-Id", requestId);
    const origin = request.headers.get("origin");
    if (origin && origin === allowedOrigin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Vary", "Origin");
    }
    console.log(
      JSON.stringify({
        level: response.status >= 500 ? "error" : "info",
        service: "playback-service",
        action,
        requestId,
        status: response.status,
        durationMs: Date.now() - started,
      }),
    );
    return response;
  };
}
async function json(request: Request, optional = false) {
  if (!request.body) {
    if (optional) return {};
    fail("VALIDATION_ERROR");
  }
  const reader = request.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4096) {
        await reader.cancel();
        fail("FILE_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (size === 0 && optional) return {};
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    fail("UNSUPPORTED_MEDIA_TYPE");
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    fail("VALIDATION_ERROR");
  }
}
const position = z.number().finite().nonnegative();
const pagination = z.strictObject({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const id = async (context: Context, key: string, prefix: string) =>
  z
    .string()
    .regex(identifier(prefix))
    .parse((await context.params)[key]);
async function authenticated(request: Request) {
  const c = container(),
    who = await c.auth.verify(request);
  await rateLimit(c.db, `api:${who.userId}`, 240, 60);
  return who;
}
export const uploadAsset = handle("uploadAsset", async (request) => {
  const c = container(),
    who = await authenticated(request);
  useCases.admin(who);
  await rateLimit(c.db, `upload:${who.userId}`, c.config.UPLOAD_LIMIT_PER_HOUR, 3600);
  return Response.json(
    await receiveUpload(request, c.config, (file) =>
      new useCases.UploadMediaAsset(c.dependencies).execute(who, file),
    ),
    { status: 201 },
  );
});
export const getAsset = handle("getAsset", async (r, ctx) =>
  Response.json(
    await new useCases.GetMediaAsset(container().dependencies).execute(
      await authenticated(r),
      await id(ctx, "assetId", "ast"),
    ),
  ),
);
export const deleteAsset = handle("deleteAsset", async (r, ctx) => {
  await new useCases.DeleteMediaAsset(container().dependencies).execute(
    await authenticated(r),
    await id(ctx, "assetId", "ast"),
  );
  return new Response(null, { status: 204 });
});
export const startSession = handle("startSession", async (r) => {
  const who = await authenticated(r),
    body = z.strictObject({ tituloId: z.string().regex(identifier("ttl")) }).parse(await json(r));
  return Response.json(
    await new useCases.StartPlaybackSession(container().dependencies).execute(who, body.tituloId),
    { status: 201 },
  );
});
export const updateProgress = handle("updateProgress", async (r, ctx) => {
  const who = await authenticated(r),
    body = z.strictObject({ positionSeconds: position }).parse(await json(r));
  return Response.json(
    await new useCases.UpdatePlaybackProgress(container().dependencies).execute(
      who,
      await id(ctx, "sessionId", "ses"),
      body.positionSeconds,
    ),
  );
});
export const pause = handle("pause", async (r, ctx) => {
  const who = await authenticated(r),
    body = z.strictObject({ positionSeconds: position.optional() }).parse(await json(r, true));
  return Response.json(
    await new useCases.PausePlayback(container().dependencies).execute(
      who,
      await id(ctx, "sessionId", "ses"),
      body.positionSeconds,
    ),
  );
});
export const resume = handle("resume", async (r, ctx) => {
  const who = await authenticated(r);
  z.strictObject({}).parse(await json(r, true));
  return Response.json(
    await new useCases.ResumePlayback(container().dependencies).execute(
      who,
      await id(ctx, "sessionId", "ses"),
    ),
  );
});
export const complete = handle("complete", async (r, ctx) => {
  const who = await authenticated(r);
  z.strictObject({}).parse(await json(r, true));
  return Response.json(
    await new useCases.CompletePlayback(container().dependencies).execute(
      who,
      await id(ctx, "sessionId", "ses"),
    ),
  );
});
export const refreshUrl = handle("refreshUrl", async (r, ctx) => {
  const who = await authenticated(r);
  z.strictObject({}).parse(await json(r, true));
  return Response.json(
    await new useCases.RefreshPlaybackUrl(container().dependencies).execute(
      who,
      await id(ctx, "sessionId", "ses"),
    ),
  );
});
export const continuing = handle("continueWatching", async (r) => {
  const who = await authenticated(r),
    p = pagination.parse(Object.fromEntries(new URL(r.url).searchParams));
  return Response.json(
    await new useCases.GetContinueWatching(container().dependencies).execute(who, p.page, p.limit),
  );
});
export const history = handle("history", async (r) => {
  const who = await authenticated(r),
    p = pagination.parse(Object.fromEntries(new URL(r.url).searchParams));
  return Response.json(
    await new useCases.GetPlaybackHistory(container().dependencies).execute(who, p.page, p.limit),
  );
});
export const health = handle("health", async () => {
  const c = container();
  const [mongo, storage] = await Promise.allSettled([
    c.db.command({ ping: 1 }),
    c.storage.health(),
  ]);
  const ok = mongo.status === "fulfilled" && storage.status === "fulfilled" && storage.value;
  return Response.json(
    {
      status: ok ? "ok" : "unavailable",
      service: "playback-service",
      dependencies: {
        mongodb: mongo.status === "fulfilled" ? "up" : "down",
        objectStorage: storage.status === "fulfilled" && storage.value ? "up" : "down",
      },
    },
    { status: ok ? 200 : 503 },
  );
});
export const options = handle(
  "options",
  async () =>
    new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "600",
      },
    }),
);
