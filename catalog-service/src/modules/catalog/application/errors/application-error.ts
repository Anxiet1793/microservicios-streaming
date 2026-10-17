export type ApplicationErrorCode = "VALIDATION_ERROR" | "INVALID_APPLICATION_CONFIGURATION" | "INVALID_DEPENDENCY_RESULT" | "INVALID_REPOSITORY_RESULT";

/** Errores independientes del transporte. HTTP decidirá los códigos de respuesta. */
export class ApplicationError extends Error {
  constructor(readonly code: ApplicationErrorCode, message: string) {
    super(message);
    this.name = "ApplicationError";
  }
}
