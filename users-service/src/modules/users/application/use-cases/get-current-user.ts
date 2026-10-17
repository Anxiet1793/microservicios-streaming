import type { AccessClaims, Dependencies } from "../ports";
import { currentUser } from "../current-user";
import { publicUser } from "../dto";
export class GetCurrentUser {
  constructor(private readonly d: Dependencies) {}
  async execute(claims: AccessClaims) { return publicUser(await currentUser(this.d, claims)); }
}
