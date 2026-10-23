import { validatePassword } from "../../domain/user";
import { invalidCredentials } from "../../domain/errors";
import type { AccessClaims, Dependencies } from "../ports";
import { currentUser } from "../current-user";
export class ChangePassword {
  constructor(private readonly d: Dependencies) {}
  async execute(claims: AccessClaims, input: { currentPassword: string; newPassword: string }) {
    const user = await currentUser(this.d, claims);
    validatePassword(input.newPassword);
    if (!(await this.d.passwords.verify(input.currentPassword, user.passwordHash)))
      invalidCredentials();
    const hash = await this.d.passwords.hash(input.newPassword);
    if (!(await this.d.users.changePassword(user.userId, user.passwordHash, hash, this.d.now())))
      invalidCredentials();
  }
}
