import { Usuario, validatePassword } from "../../domain/user";
import type { Dependencies } from "../ports";
import { authUser } from "../dto";
export class RegisterUser {
  constructor(private readonly d: Dependencies) {}
  async execute(input: { email: string; password: string; displayName: string }) {
    validatePassword(input.password);
    const user = Usuario.register({ userId: `usr_${this.d.uuid()}`, email: input.email, passwordHash: await this.d.passwords.hash(input.password),
      profile: { displayName: input.displayName, avatarUrl: null, preferredLanguage: "es" } }, this.d.now());
    return { user: authUser(await this.d.users.create(user.snapshot())) };
  }
}
