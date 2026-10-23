import { z } from "zod";
import { CATALOG_LIMITS } from "../../../modules/catalog/domain/limits";

export class ConfigurationError extends Error {
  constructor(readonly fields: readonly string[]) {
    super(`Configuración inválida: ${fields.join(", ")}.`);
    this.name = "ConfigurationError";
  }
}

const environmentSchema = z.object({
  MONGODB_URI: z
    .string()
    .min(1)
    .refine((value) => /^mongodb(?:\+srv)?:\/\//.test(value)),
  MONGODB_DATABASE: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,63}$/)
    .default("catalog_service"),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: z.coerce.number().int().min(100).max(120_000).default(5000),
  MONGODB_QUERY_TIMEOUT_MS: z.coerce.number().int().min(100).max(120_000).default(5000),
  BULK_MAX_ITEMS: z.coerce.number().int().min(1).max(CATALOG_LIMITS.maxBulkItems).default(500),
  REQUEST_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(10 * 1024 * 1024)
    .default(5 * 1024 * 1024),
});
export type Environment = Readonly<z.infer<typeof environmentSchema>>;

/** Evaluación diferida: importar módulos no abre conexiones ni requiere secretos. */
export function readEnvironment(
  input: Readonly<Record<string, string | undefined>> = process.env,
): Environment {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    // No incluir issues completos: podrían contener datos de la configuración.
    throw new ConfigurationError([
      ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    ]);
  }
  return Object.freeze(result.data);
}
