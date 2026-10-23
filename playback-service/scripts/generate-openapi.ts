import { mkdir, writeFile } from "node:fs/promises";
import YAML from "yaml";
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const date = { type: "string", format: "date-time" };
const id = (prefix: string) => ({
  type: "string",
  pattern: `^${prefix}_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`,
});
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({
  type: "object",
  additionalProperties: false,
  ...(required.length ? { required } : {}),
  properties,
});
const position = {
  type: "number",
  minimum: 0,
  description: "Segundos absolutos; máximo durationSeconds + 2, normalizado a la duración.",
};
const schemas = {
  Error: object({ error: object({ code: { type: "string" }, message: { type: "string" } }) }),
  Progress: object({
    positionSeconds: position,
    durationSeconds: { type: "number", exclusiveMinimum: true, minimum: 0 },
    percentage: { type: "number", minimum: 0, maximum: 100, readOnly: true },
    updatedAt: date,
  }),
  Asset: object({
    assetId: id("ast"),
    contentType: { type: "string", enum: ["video/mp4"] },
    originalFilename: { type: "string" },
    sizeBytes: { type: "integer", minimum: 1 },
    durationSeconds: { type: "number" },
    codec: { type: "string", enum: ["h264"] },
    width: { type: "integer" },
    height: { type: "integer" },
    status: { type: "string", enum: ["READY", "DELETED"] },
    createdAt: date,
    updatedAt: date,
  }),
  Session: object({
    sessionId: id("ses"),
    tituloId: id("ttl"),
    assetId: id("ast"),
    status: { type: "string", enum: ["REQUESTED", "ACTIVE", "PAUSED", "COMPLETED", "FAILED"] },
    progress: ref("Progress"),
    startedAt: date,
    lastActivityAt: date,
    completedAt: { ...date, nullable: true },
  }),
  PlaybackUrl: object({
    url: {
      type: "string",
      format: "uri",
      description: "URL S3 privada firmada; no guardar ni registrar en logs.",
    },
    expiresIn: { type: "integer", minimum: 60, maximum: 3600 },
  }),
  PlaybackResponse: object({ session: ref("Session"), playback: ref("PlaybackUrl") }),
  SessionResponse: object({ session: ref("Session") }),
  Pagination: object({
    page: { type: "integer" },
    limit: { type: "integer" },
    total: { type: "integer" },
    totalPages: { type: "integer" },
  }),
  ContinuePage: object({
    data: {
      type: "array",
      items: object({ tituloId: id("ttl"), progress: ref("Progress"), lastPlayedAt: date }),
    },
    pagination: ref("Pagination"),
  }),
  HistoryPage: object({
    data: {
      type: "array",
      items: object({ tituloId: id("ttl"), lastPlayedAt: date, completed: { type: "boolean" } }),
    },
    pagination: ref("Pagination"),
  }),
  Health: object({
    status: { type: "string", enum: ["ok", "unavailable"] },
    service: { type: "string", enum: ["playback-service"] },
    dependencies: object({
      mongodb: { type: "string", enum: ["up", "down"] },
      objectStorage: { type: "string", enum: ["up", "down"] },
    }),
  }),
};
const errors: Record<string, string> = {
  "400": "VALIDATION_ERROR",
  "401": "UNAUTHORIZED",
  "403": "FORBIDDEN",
  "404": "TITLE_NOT_FOUND / MEDIA_ASSET_NOT_FOUND / PLAYBACK_SESSION_NOT_FOUND",
  "409":
    "INVALID_PLAYBACK_TRANSITION / TITLE_NOT_PUBLISHED / MEDIA_ASSET_IN_USE / SESSION_SUPERSEDED",
  "413": "FILE_TOO_LARGE",
  "415": "UNSUPPORTED_MEDIA_TYPE",
  "429": "RATE_LIMITED",
  "500": "INTERNAL_SERVER_ERROR",
  "503": "CATALOG_SERVICE_UNAVAILABLE / STORAGE_UNAVAILABLE",
};
const response = (description: string, schema: unknown) => ({
  description,
  content: { "application/json": { schema } },
});
const paths: Record<string, Record<string, unknown>> = {};
function add(
  path: string,
  method: string,
  operationId: string,
  summary: string,
  success: unknown,
  status = 200,
  body?: unknown,
  multipart = false,
) {
  const parameters: unknown[] = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({
    name: m[1],
    in: "path",
    required: true,
    schema: id(m[1] === "assetId" ? "ast" : "ses"),
  }));
  if (path.includes("/me/"))
    parameters.push(
      {
        name: "page",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 10000, default: 1 },
      },
      {
        name: "limit",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      },
    );
  paths[path] ??= {};
  paths[path][method] = {
    operationId,
    summary,
    security: path === "/api/health" ? [] : [{ bearerAuth: [] }],
    ...(parameters.length ? { parameters } : {}),
    ...(body
      ? {
          requestBody: {
            required: operationId !== "pausePlayback",
            content: { [multipart ? "multipart/form-data" : "application/json"]: { schema: body } },
          },
        }
      : {}),
    responses: {
      [status]:
        status === 204
          ? { description: "Sin contenido" }
          : response("Operación completada", success),
      ...Object.fromEntries(
        Object.entries(errors).map(([code, message]) => [code, response(message, ref("Error"))]),
      ),
    },
  };
}
add("/api/health", "get", "health", "Estado de MongoDB y MinIO", ref("Health"));
add(
  "/api/v1/media/assets",
  "post",
  "uploadAsset",
  "ADMIN: cargar MP4 H.264/AAC; máximo configurable 256 MiB",
  object({ asset: ref("Asset") }),
  201,
  object({ file: { type: "string", format: "binary" } }),
  true,
);
add(
  "/api/v1/media/assets/{assetId}",
  "get",
  "getAsset",
  "ADMIN: consultar metadata técnica",
  object({ asset: ref("Asset") }),
);
add(
  "/api/v1/media/assets/{assetId}",
  "delete",
  "deleteAsset",
  "ADMIN: eliminación lógica; 409 si existen sesiones ACTIVE/PAUSED",
  {},
  204,
);
add(
  "/api/v1/playback/sessions",
  "post",
  "startSession",
  "Iniciar sesión desde el progreso anterior; reemplaza la sesión abierta",
  ref("PlaybackResponse"),
  201,
  object({ tituloId: id("ttl") }),
);
add(
  "/api/v1/playback/sessions/{sessionId}/progress",
  "patch",
  "updateProgress",
  "Guardar posición absoluta; repetir posición es idempotente",
  ref("SessionResponse"),
  200,
  object({ positionSeconds: position }),
);
add(
  "/api/v1/playback/sessions/{sessionId}/pause",
  "post",
  "pausePlayback",
  "Pausar; posición opcional",
  ref("SessionResponse"),
  200,
  object({ positionSeconds: position }, []),
);
add(
  "/api/v1/playback/sessions/{sessionId}/resume",
  "post",
  "resumePlayback",
  "Reanudar sesión pausada y entregar URL nueva",
  ref("PlaybackResponse"),
);
add(
  "/api/v1/playback/sessions/{sessionId}/complete",
  "post",
  "completePlayback",
  "Completar una sola vez; posición final igual a duración",
  ref("SessionResponse"),
);
add(
  "/api/v1/playback/sessions/{sessionId}/refresh-url",
  "post",
  "refreshPlaybackUrl",
  "Renovar URL de una sesión propia abierta",
  object({ playback: ref("PlaybackUrl") }),
);
add(
  "/api/v1/playback/me/continue-watching",
  "get",
  "continueWatching",
  "Títulos sin completar y con porcentaje menor a 90",
  ref("ContinuePage"),
);
add(
  "/api/v1/playback/me/history",
  "get",
  "history",
  "Última reproducción por título; paginación",
  ref("HistoryPage"),
);
await mkdir("docs", { recursive: true });
await writeFile(
  "docs/openapi.yaml",
  YAML.stringify({
    openapi: "3.0.3",
    info: {
      title: "Playback Service",
      version: "0.1.0",
      description:
        "JWT RS256 emitido por Users Service. Todas las sesiones se limitan al propietario. Los MP4 se sirven desde MinIO con URLs firmadas, no desde esta API.",
    },
    servers: [{ url: "http://localhost:3002" }],
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      schemas,
    },
  }),
);
