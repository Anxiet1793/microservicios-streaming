import type { z } from "zod";
import { HttpError, type ValidationIssue } from "./http-error";

export function validationIssues(error: z.ZodError): ValidationIssue[] {
  // No copiar valores de entrada ni mensajes que puedan incluirlos.
  return error.issues
    .slice(0, 20)
    .map((issue) => ({ path: issue.path.map(String).join("."), code: issue.code }));
}

export function parseSchema<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "La solicitud contiene campos inválidos.",
      validationIssues(result.error),
    );
  return result.data;
}

export function queryObject(request: Request): Record<string, string> {
  const result: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [key, value] of new URL(request.url).searchParams) {
    if (Object.hasOwn(result, key))
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "No se permiten parámetros de consulta repetidos.",
      );
    result[key] = value;
  }
  return result;
}
