import { validateTitleId } from "../../domain/user";
import type { AccessClaims, Dependencies } from "../ports";
import { currentUser } from "../current-user";
export class RemoveFromWatchlist {
  constructor(private readonly d: Dependencies) {}
  async execute(claims: AccessClaims, tituloId: string) {
    validateTitleId(tituloId);
    const user = await currentUser(this.d, claims);
    await this.d.watchlist.remove(user.userId, tituloId);
  }
}
