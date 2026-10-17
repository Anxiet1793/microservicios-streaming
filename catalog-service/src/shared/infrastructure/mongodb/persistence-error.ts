export type PersistenceErrorCode = "DATABASE_UNAVAILABLE" | "PERSISTENCE_READ_FAILED" | "PERSISTENCE_WRITE_FAILED" | "PERSISTENCE_OUTCOME_UNKNOWN" | "PERSISTENCE_DATA_INVALID" | "DATABASE_INITIALIZATION_FAILED";

/** Mensajes seguros: no contienen URI, errores crudos del driver ni documentos. */
export class PersistenceError extends Error {
  constructor(readonly code: PersistenceErrorCode) {
    super(code);
    this.name = "PersistenceError";
  }
}
