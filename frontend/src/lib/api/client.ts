export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly retryAfter = 0,
  ) {
    super(message);
  }
}
const messages: Record<string, string> = {
  INVALID_CREDENTIALS: "El correo o la contraseña no son correctos.",
  EMAIL_ALREADY_EXISTS: "Ya existe una cuenta con ese correo.",
  UNAUTHORIZED: "Tu sesión venció. Inicia sesión para continuar.",
  FORBIDDEN: "Tu cuenta no tiene acceso a esta acción.",
  SESSION_SUPERSEDED: "Este título se abrió en otro reproductor.",
  TITLE_NOT_PUBLISHED: "Este título no está disponible para reproducir.",
  MEDIA_ASSET_NOT_FOUND: "Este video ya no está disponible.",
  RATE_LIMITED: "Hay demasiados intentos. Espera un momento.",
  UNSUPPORTED_MEDIA_TYPE: "Usa un MP4 con video H.264 y audio AAC opcional.",
  FILE_TOO_LARGE: "El archivo supera el tamaño permitido de 256 MiB.",
  VALIDATION_ERROR: "Revisa los campos e inténtalo otra vez.",
  SESSION_UNCERTAIN:
    "No pudimos confirmar la renovación. Vuelve a iniciar sesión.",
};
export function errorMessage(code: string) {
  return (
    messages[code] || "No pudimos completar la operación. Inténtalo otra vez."
  );
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/bff/${path}`, {
    method,
    signal,
    credentials: "same-origin",
    headers: {
      "X-Nevaro-Request": "1",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const value = await response.json().catch(() => ({}));
    const code = value.error?.code || "SERVICE_UNAVAILABLE";
    if (
      response.status === 401 &&
      code === "UNAUTHORIZED" &&
      !path.startsWith("auth/")
    )
      window.dispatchEvent(new Event("nevaro:expired"));
    throw new ApiError(
      code,
      response.status,
      errorMessage(code),
      Math.min(3600, Number(response.headers.get("retry-after")) || 0),
    );
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}
