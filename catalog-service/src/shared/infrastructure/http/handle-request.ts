import { randomUUID } from "node:crypto";
import { ApplicationError } from "../../../modules/catalog/application/errors/application-error";
import { CatalogError } from "../../../modules/catalog/domain/errors/catalog-error";
import { PersistenceError } from "../mongodb/persistence-error";
import { logRequest } from "../logging/request-logger";
import { HttpError } from "./http-error";

function publicError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof CatalogError) {
    if (error.code === "CATALOG_TITLE_NOT_FOUND") return new HttpError(404, error.code, error.message);
    if (error.code === "CONCURRENT_MODIFICATION") return new HttpError(409, error.code, error.message);
    if (error.code === "INVALID_PUBLICATION_TRANSITION") return new HttpError(422, error.code, error.message);
    if (error.code !== "INVALID_CATALOG_STATE") return new HttpError(400, "VALIDATION_ERROR", error.message);
  }
  if (error instanceof ApplicationError && error.code === "VALIDATION_ERROR") return new HttpError(400, error.code, error.message);
  if (error instanceof PersistenceError) {
    if (error.code === "PERSISTENCE_OUTCOME_UNKNOWN") return new HttpError(503, error.code, "No se pudo confirmar la escritura. Consulte el estado antes de reintentar.");
    if (["DATABASE_UNAVAILABLE", "PERSISTENCE_READ_FAILED"].includes(error.code)) return new HttpError(503, "DATABASE_UNAVAILABLE", "La base de datos no está disponible temporalmente.");
  }
  return new HttpError(500, "INTERNAL_SERVER_ERROR", "No se pudo completar la operación.");
}

export async function handleRequest(request: Request, endpoint: string, action: () => Promise<Response>): Promise<Response> {
  const requestId = randomUUID();
  const started = performance.now();
  let response: Response;
  try { response = await action(); }
  catch (error) {
    const safe = publicError(error);
    response = Response.json({ error: {
      code: safe.code, message: safe.message, requestId,
      ...(safe.issues ? { issues: safe.issues } : {}),
    } }, { status: safe.status });
  }
  response.headers.set("x-request-id", requestId);
  response.headers.set("cache-control", "no-store");
  response.headers.set("x-content-type-options", "nosniff");
  logRequest({ requestId, endpoint, method: request.method, statusCode: response.status, durationMs: Math.round((performance.now() - started) * 100) / 100 });
  return response;
}
