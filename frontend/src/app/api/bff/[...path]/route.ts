import { randomUUID } from "node:crypto";
import { z } from "zod";
import { config } from "../../../../lib/server/config";
import { currentUser, login, logout, authorized } from "../../../../lib/server/session";
import { ServiceError, upstream } from "../../../../lib/server/http";
import { catalog, compose, title } from "../../../../lib/server/catalog";
import type { Pagination, Reference } from "../../../../lib/models";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const titleId = new RegExp(`^ttl_${uuid}$`),
  sessionId = new RegExp(`^ses_${uuid}$`),
  assetId = new RegExp(`^ast_${uuid}$`);
async function json(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ServiceError(415, "UNSUPPORTED_MEDIA_TYPE");
  if (!request.body) throw new ServiceError(400, "VALIDATION_ERROR");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 65536) {
        await reader.cancel();
        throw new ServiceError(413, "FILE_TOO_LARGE");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new ServiceError(400, "VALIDATION_ERROR");
  }
}
const jsonInit = (method: string, body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const result = async (response: Response) =>
  response.status === 204
    ? new Response(null, { status: 204 })
    : Response.json(await response.json(), { status: response.status });
async function references(kind: string, query: string) {
  const users = ["watchlist", "preferences"].includes(kind),
    response = await authorized(
      users ? "USERS" : "PLAYBACK",
      `/api/v1/${users ? "users/me" : "playback/me"}/${kind}?${query}`,
    );
  const data = (await response.json()) as {
    items?: Reference[];
    data?: Reference[];
    pagination: Pagination;
  };
  return { data: data.items ?? data.data ?? [], pagination: data.pagination };
}
async function dispatch(request: Request, context: Context): Promise<Response> {
  const parts = (await context.params).path,
    path = parts.join("/"),
    method = request.method,
    query = new URL(request.url).searchParams;
  if (method !== "GET") {
    const origin = request.headers.get("origin");
    if (
      request.headers.get("x-nevaro-request") !== "1" ||
      request.headers.get("sec-fetch-site") === "cross-site" ||
      (origin !== null && origin !== config().APP_ORIGIN)
    )
      throw new ServiceError(403, "FORBIDDEN");
  }
  if (path === "auth/login" && method === "POST")
    return Response.json(
      await login(
        z
          .strictObject({
            email: z.string().trim().toLowerCase().pipe(z.email()),
            password: z.string().min(1).max(256),
          })
          .parse(await json(request)),
      ),
    );
  if (path === "auth/register" && method === "POST")
    return result(
      await upstream(
        "USERS",
        "/api/v1/auth/register",
        jsonInit(
          "POST",
          z
            .strictObject({
              email: z.string().trim().toLowerCase().pipe(z.email()),
              password: z.string().min(12).max(128),
              displayName: z.string().trim().min(1).max(100),
            })
            .parse(await json(request)),
        ),
      ),
    );
  if (path === "auth/logout" && method === "POST") return Response.json(await logout());
  const user = await currentUser(),
    isAdmin = user.role === "ADMIN";
  if (path === "me" && method === "GET") return Response.json(user);
  if (path === "me" && method === "PATCH")
    return result(
      await authorized("USERS", "/api/v1/users/me", jsonInit(method, await json(request))),
    );
  if (path === "me/change-password" && method === "POST") {
    await authorized(
      "USERS",
      "/api/v1/users/me/change-password",
      jsonInit(method, await json(request)),
    );
    await logout();
    return new Response(null, { status: 204 });
  }
  if (path === "catalog" && method === "GET") return Response.json(await catalog(query));
  if (parts[0] === "catalog" && parts.length === 2 && titleId.test(parts[1]!) && method === "GET")
    return Response.json(await title(parts[1]!));
  if (
    parts[0] === "library" &&
    parts.length === 2 &&
    ["watchlist", "preferences", "continue-watching", "history"].includes(parts[1]!) &&
    method === "GET"
  ) {
    const page = await references(parts[1]!, query.toString());
    return Response.json({ ...page, data: await compose(page.data) });
  }
  if (parts[0] === "state" && parts.length === 2 && titleId.test(parts[1]!) && method === "GET") {
    async function find(kind: string) {
      for (let n = 1; n <= 10; n++) {
        const response = await references(kind, `page=${n}&limit=100`);
        const found = response.data.find((item) => item.tituloId === parts[1]);
        if (found) return { known: true, item: found };
        if (n >= response.pagination.totalPages) return { known: true, item: null };
      }
      return { known: false, item: null };
    }
    const [watchlist, preference] = await Promise.all([find("watchlist"), find("preferences")]);
    return Response.json({ watchlist, preference });
  }
  if (
    ["watchlist", "preferences"].includes(parts[0]!) &&
    parts.length === 2 &&
    titleId.test(parts[1]!) &&
    ((parts[0] === "watchlist" && ["POST", "DELETE"].includes(method)) ||
      (parts[0] === "preferences" && ["PUT", "DELETE"].includes(method)))
  )
    return result(
      await authorized(
        "USERS",
        `/api/v1/users/me/${path}`,
        method === "PUT"
          ? jsonInit(
              method,
              z.strictObject({ value: z.enum(["LIKE", "DISLIKE"]) }).parse(await json(request)),
            )
          : { method },
      ),
    );
  if (path === "sessions" && method === "POST")
    return result(
      await authorized(
        "PLAYBACK",
        "/api/v1/playback/sessions",
        jsonInit(
          method,
          z.strictObject({ tituloId: z.string().regex(titleId) }).parse(await json(request)),
        ),
      ),
    );
  if (
    parts[0] === "sessions" &&
    parts.length === 3 &&
    sessionId.test(parts[1]!) &&
    ["progress", "pause", "resume", "complete", "refresh-url"].includes(parts[2]!) &&
    method === (parts[2] === "progress" ? "PATCH" : "POST")
  )
    return result(
      await authorized(
        "PLAYBACK",
        `/api/v1/playback/${path}`,
        ["progress", "pause"].includes(parts[2]!)
          ? jsonInit(method, await json(request))
          : { method },
      ),
    );
  if (parts[0] === "admin") {
    if (!isAdmin) throw new ServiceError(403, "FORBIDDEN");
    if (path === "admin/catalog" && method === "GET")
      return Response.json(await catalog(query, true));
    if (path === "admin/catalog" && method === "POST") {
      const input = await json(request);
      return result(
        await authorized("CATALOG", "/api/v1/catalog/bulk", jsonInit("POST", { items: [input] })),
      );
    }
    if (parts[1] === "catalog" && titleId.test(parts[2] || "")) {
      if (parts.length === 3 && method === "GET")
        return Response.json(await title(parts[2]!, true));
      if (parts.length === 3 && method === "PATCH")
        return result(
          await authorized(
            "CATALOG",
            `/api/v1/catalog/${parts[2]}`,
            jsonInit(method, await json(request)),
          ),
        );
      if (parts.length === 4 && parts[3] === "publication-status" && method === "PATCH") {
        const input = z
          .strictObject({
            publicationStatusId: z.union([z.literal(2), z.literal(3)]),
          })
          .parse(await json(request));
        if (input.publicationStatusId === 2) {
          const t = await title(parts[2]!, true);
          if (t.typeId === 1) {
            const a = await (
              await authorized("PLAYBACK", `/api/v1/media/assets/${t.playbackReference?.assetId}`)
            ).json();
            if (a.asset.status !== "READY") throw new ServiceError(409, "MEDIA_ASSET_NOT_FOUND");
          }
        }
        return result(
          await authorized(
            "CATALOG",
            `/api/v1/catalog/${parts[2]}/publication-status`,
            jsonInit(method, input),
          ),
        );
      }
    }
    if (path === "admin/assets" && method === "POST") {
      if (!request.headers.get("content-type")?.startsWith("multipart/form-data;"))
        throw new ServiceError(415, "UNSUPPORTED_MEDIA_TYPE");
      if (Number(request.headers.get("content-length") || 0) > 268500992)
        throw new ServiceError(413, "FILE_TOO_LARGE");
      let bytes = 0;
      const limited = request.body?.pipeThrough(
        new TransformStream({
          transform(chunk: Uint8Array, controller) {
            bytes += chunk.length;
            if (bytes > 268500992) throw new ServiceError(413, "FILE_TOO_LARGE");
            controller.enqueue(chunk);
          },
        }),
      );
      const init: RequestInit & { duplex: string } = {
        method: "POST",
        headers: { "Content-Type": request.headers.get("content-type")! },
        body: limited,
        duplex: "half",
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(120000)]),
      };
      return result(await authorized("PLAYBACK", "/api/v1/media/assets", init));
    }
    if (
      parts[1] === "assets" &&
      parts.length === 3 &&
      assetId.test(parts[2]!) &&
      ["GET", "DELETE"].includes(method)
    )
      return result(
        await authorized("PLAYBACK", `/api/v1/media/assets/${parts[2]}`, {
          method,
        }),
      );
  }
  throw new ServiceError(404, "NOT_FOUND");
}
async function handle(request: Request, context: Context) {
  const started = Date.now(),
    requestId = randomUUID();
  let response: Response;
  try {
    response = await dispatch(request, context);
  } catch (error) {
    const status =
        error instanceof z.ZodError ? 400 : error instanceof ServiceError ? error.status : 503,
      code =
        error instanceof z.ZodError
          ? "VALIDATION_ERROR"
          : error instanceof ServiceError
            ? error.code
            : "SERVICE_UNAVAILABLE";
    response = Response.json({ error: { code, requestId } }, { status });
    if (error instanceof ServiceError && error.retryAfter && /^\d+$/.test(error.retryAfter))
      response.headers.set("Retry-After", error.retryAfter);
  }
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Request-Id", requestId);
  console.info(
    JSON.stringify({
      service: "nevaro",
      operation: request.method,
      status: response.status,
      requestId,
      durationMs: Date.now() - started,
    }),
  );
  return response;
}
export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
