import type { Profile } from "../../domain/user";
import type { AccessClaims, Dependencies } from "../ports";
import { currentUser } from "../current-user";
import { publicUser } from "../dto";
export class UpdateProfile {
  constructor(private readonly d: Dependencies) {}
  async execute(claims: AccessClaims, patch: Partial<Profile>) {
    const user = await currentUser(this.d, claims);
    return publicUser(await this.d.users.updateProfile(user.userId, patch, this.d.now()));
  }
}
