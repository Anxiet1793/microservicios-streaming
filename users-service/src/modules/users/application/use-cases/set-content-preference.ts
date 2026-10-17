import { validateTitleId, type PreferenceValue } from "../../domain/user";
import { invalid } from "../../domain/errors";
import type { AccessClaims, Dependencies } from "../ports";
import { currentUser } from "../current-user";
export class SetContentPreference {
  constructor(private readonly d: Dependencies) {}
  async execute(claims: AccessClaims, tituloId: string, value: PreferenceValue) {
    validateTitleId(tituloId); if (!["LIKE", "DISLIKE"].includes(value)) invalid();
    const user = await currentUser(this.d, claims); return this.d.preferences.set(user.userId, tituloId, value, this.d.now());
  }
}
