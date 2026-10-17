import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { UsersError, unauthorized } from "../modules/users/domain/errors";
import type { AccessClaims } from "../modules/users/application/ports";
import type { Role } from "../modules/users/domain/user";
import type { Config } from "./config";
import { RateLimitError } from "../modules/users/infrastructure/security/rate-limit";
export type Context = { params: Promise<{ tituloId?: string }> };
export type Handler = (request: Request, context: Context) => Promise<Response>;
export type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE" | "HEAD" | "OPTIONS";
export const cookieName = "users_refresh";
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const value = schema.safeParse(input);
  if (!value.success) throw new UsersError("VALIDATION_ERROR", 400, "La solicitud contiene campos inválidos.");
  return value.data;
}
export function query(request: Request) {
  const result: Record<string, string> = Object.create(null);
  for (const [key, value] of new URL(request.url).searchParams) { if (Object.hasOwn(result, key)) throw new UsersError("VALIDATION_ERROR", 400, "Parámetros repetidos."); result[key] = value; }
  return result;
}
export async function json(request: Request, max: number): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json" || ![null, "identity"].includes(request.headers.get("content-encoding"))) throw new UsersError("UNSUPPORTED_MEDIA_TYPE", 415, "Se requiere JSON UTF-8 sin compresión.");
  const length = request.headers.get("content-length");
  if (length !== null && !/^\d+$/.test(length)) throw new UsersError("VALIDATION_ERROR", 400, "Content-Length inválido.");
  const large = () => new UsersError("PAYLOAD_TOO_LARGE", 413, "Cuerpo demasiado grande.");
  if (Number(length) > max) throw large();
  if (!request.body) throw new UsersError("VALIDATION_ERROR", 400, "Se requiere JSON.");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > max) { await reader.cancel(); throw large(); } chunks.push(part.value); }
  } catch (error) { if (error instanceof UsersError) throw error; throw new UsersError("VALIDATION_ERROR", 400, "Cuerpo ilegible."); }
  finally { reader.releaseLock(); }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))); }
  catch { throw new UsersError("VALIDATION_ERROR", 400, "JSON inválido."); }
}
export function checkOrigin(request: Request, config: Config, cookieAuth = false) {
  const origin = request.headers.get("origin");
  if ((origin !== null && origin !== config.APP_ORIGIN) || request.headers.get("sec-fetch-site") === "cross-site"
    || (cookieAuth && origin === null && request.headers.get("x-csrf-protection") !== "1")) throw new UsersError("FORBIDDEN", 403, "Origen de petición no permitido.");
}
export function refreshCookie(request: Request): string | undefined {
  const values = (request.headers.get("cookie") ?? "").split(";").map(v => v.trim()).filter(v => v.startsWith(`${cookieName}=`));
  if (values.length > 1) unauthorized();
  return values[0]?.slice(cookieName.length + 1);
}
export function cookie(config: Config, raw = "", expires = new Date(0)): string {
  const maxAge = raw ? Math.max(0, Math.floor((expires.getTime() - Date.now()) / 1000)) : 0;
  return `${cookieName}=${raw}; Path=/api/v1/auth; HttpOnly; SameSite=Strict; Max-Age=${maxAge}; Expires=${expires.toUTCString()}${config.APP_ENV === "production" ? "; Secure" : ""}`;
}
export function bearer(request: Request): string {
  const match = /^Bearer ([A-Za-z0-9_.-]+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match || match[1]!.length > 8192) unauthorized(); return match[1]!;
}
export function requireRole(claims: AccessClaims, role: Role) { if (claims.role !== role) throw new UsersError("FORBIDDEN", 403, "Permisos insuficientes."); }
export function route(path: string, handlers: Partial<Record<Method, Handler>>, errorCookie?: () => string): Record<Method, Handler> {
  const allow = [...Object.keys(handlers), ...(handlers.GET ? ["HEAD"] : []), "OPTIONS"].join(", ");
  return Object.fromEntries((["GET", "POST", "PATCH", "PUT", "DELETE", "HEAD", "OPTIONS"] as Method[]).map(method => [method, async (request: Request, context: Context) => {
    const requestId = randomUUID(); const start = performance.now(); let response: Response;
    try {
      if (method === "OPTIONS") response = new Response(null, { status: 204, headers: { allow } });
      else { const handler = handlers[method] ?? (method === "HEAD" ? handlers.GET : undefined); if (!handler) throw new UsersError("METHOD_NOT_ALLOWED", 405, "Método no permitido."); response = await handler(request, context); }
    } catch (error) {
      const known = error instanceof UsersError;
      const status = known ? error.status : 500;
      response = Response.json({ error: { code: known ? error.code : "INTERNAL_SERVER_ERROR", message: known ? error.message : "No se pudo completar la operación.", requestId } }, { status });
      if (status === 405) response.headers.set("allow", allow);
      if (status === 401) { response.headers.set("www-authenticate", "Bearer"); if (errorCookie) response.headers.set("set-cookie", errorCookie()); }
      if (error instanceof RateLimitError) response.headers.set("retry-after", String(error.retryAfter));
    }
    response.headers.set("x-request-id", requestId); response.headers.set("cache-control", "no-store"); response.headers.set("x-content-type-options", "nosniff");
    console.info(JSON.stringify({ level: "info", event: "http_request", requestId, endpoint: path, method, statusCode: response.status, durationMs: Math.round(performance.now() - start) }));
    return method === "HEAD" ? new Response(null, { status: response.status, headers: response.headers }) : response;
  }])) as Record<Method, Handler>;
}
