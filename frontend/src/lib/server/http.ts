import "server-only";
import { config } from "./config";
export class ServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly retryAfter?: string | null,
  ) {
    super(code);
  }
}
export type Service = "USERS" | "CATALOG" | "PLAYBACK";
export async function upstream(
  service: Service,
  path: string,
  init: RequestInit = {},
) {
  const c = config();
  let response: Response;
  try {
    response = await fetch(c[`${service}_SERVICE_URL`] + path, {
      ...init,
      cache: "no-store",
      redirect: "error",
      signal: init.signal ?? AbortSignal.timeout(10000),
    });
  } catch {
    throw new ServiceError(503, "SERVICE_UNAVAILABLE");
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ServiceError(
      response.status,
      typeof error.error?.code === "string"
        ? error.error.code
        : "SERVICE_UNAVAILABLE",
      response.headers.get("retry-after"),
    );
  }
  return response;
}
