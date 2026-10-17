import { unauthorized } from "../domain/errors";
import type { AccessClaims, Dependencies } from "./ports";
export async function currentUser(d: Dependencies, claims: AccessClaims) {
  const user = await d.users.findById(claims.userId);
  if (!user || user.status !== "ACTIVE" || user.authVersion !== claims.authVersion || user.role !== claims.role) unauthorized();
  return user;
}
export function pageInput(page = 1, limit = 20) {
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit) || page < 1 || limit < 1 || limit > 100 || (page - 1) * limit > 10000) throw new UsersError("VALIDATION_ERROR", 400, "Paginación inválida.");
  return { page, limit };
}
import { UsersError } from "../domain/errors";
