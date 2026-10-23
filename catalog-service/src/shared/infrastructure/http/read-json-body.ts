import { HttpError } from "./http-error";

/** Límite sobre bytes recibidos, incluso con transferencia chunked o sin Content-Length. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const mediaType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "application/json")
    throw new HttpError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Se requiere Content-Type application/json.",
    );
  const encoding = request.headers.get("content-encoding");
  if (encoding && encoding.toLowerCase() !== "identity")
    throw new HttpError(
      415,
      "UNSUPPORTED_CONTENT_ENCODING",
      "Se requiere un cuerpo JSON sin compresión.",
    );
  const length = request.headers.get("content-length");
  if (length !== null && !/^\d+$/.test(length))
    throw new HttpError(400, "INVALID_CONTENT_LENGTH", "Content-Length inválido.");
  if (length !== null && Number(length) > maxBytes)
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "El cuerpo excede el límite permitido.");
  if (!request.body) throw new HttpError(400, "INVALID_JSON", "Se requiere un cuerpo JSON.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      received += part.value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new HttpError(413, "PAYLOAD_TOO_LARGE", "El cuerpo excede el límite permitido.");
      }
      chunks.push(part.value);
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "INVALID_REQUEST_BODY", "No se pudo leer el cuerpo de la petición.");
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new HttpError(400, "INVALID_JSON", "El cuerpo debe ser JSON válido codificado en UTF-8.");
  }
}
