import type { AccessClaims, Dependencies } from "../ports";
import { currentUser, pageInput } from "../current-user";
export class GetWatchlist {
  constructor(private readonly d: Dependencies) {}
  async execute(claims: AccessClaims, page?: number, limit?: number) { const pagination = pageInput(page, limit); const user = await currentUser(this.d, claims); return this.d.watchlist.list(user.userId, pagination); }
}
