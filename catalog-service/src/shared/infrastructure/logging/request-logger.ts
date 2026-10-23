export interface RequestLog {
  readonly requestId: string;
  readonly endpoint: string;
  readonly method: string;
  readonly statusCode: number;
  readonly durationMs: number;
}

export function logRequest(entry: RequestLog): void {
  console.info(
    JSON.stringify({
      level: entry.statusCode >= 500 ? "error" : "info",
      event: "http_request",
      requestId: entry.requestId,
      endpoint: entry.endpoint,
      method: entry.method,
      statusCode: entry.statusCode,
      durationMs: entry.durationMs,
    }),
  );
}
