export class UsersError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "UsersError";
  }
}
export function invalid(message = "La solicitud contiene valores inválidos."): never {
  throw new UsersError("VALIDATION_ERROR", 400, message);
}
export function unauthorized(): never {
  throw new UsersError("UNAUTHORIZED", 401, "Autenticación requerida o sesión inválida.");
}
export function invalidCredentials(): never {
  throw new UsersError("INVALID_CREDENTIALS", 401, "Credenciales inválidas.");
}
