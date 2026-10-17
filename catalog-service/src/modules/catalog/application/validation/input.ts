import { ApplicationError } from "../errors/application-error";
import type { Clock } from "../ports/clock";

export function assertFields(value: unknown, allowed: readonly string[], required: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.keys(value).some(key => !allowed.includes(key))
    || required.some(key => !Object.hasOwn(value, key) || (value as Record<string, unknown>)[key] === undefined)) {
    throw new ApplicationError("VALIDATION_ERROR", "La entrada contiene campos desconocidos o faltan campos obligatorios.");
  }
}

export function readClock(clock: Clock): Date {
  const value = clock.now();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new ApplicationError("INVALID_DEPENDENCY_RESULT", "El reloj no devolvió una fecha válida.");
  }
  return new Date(value);
}
