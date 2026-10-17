import { normalizeEmail } from "../../domain/user";
import { invalidCredentials } from "../../domain/errors";
import type { Dependencies } from "../ports";
import { authUser } from "../dto";
export class LoginUser {
  constructor(private readonly d: Dependencies) {}
  async execute(input: { email: string; password: string }) {
    const user = await this.d.users.findByEmail(normalizeEmail(input.email));
    const valid = await this.d.passwords.verify(input.password, user?.passwordHash ?? null);
    if (!valid || !user || user.status !== "ACTIVE") invalidCredentials();
    const token = this.d.refresh.issue();
    const now = this.d.now();
    const expiresAt = new Date(now.getTime() + this.d.refreshTtl * 1000);
    const accessToken = await this.d.access.sign(user);
    if (!await this.d.sessions.create({ id: this.d.uuid(), familyId: this.d.uuid(), userId: user.userId, tokenHash: token.hash, expiresAt, createdAt: now }, user.passwordHash)) invalidCredentials();
    return { accessToken, expiresIn: this.d.accessTtl, user: authUser(user), refreshToken: token.raw, refreshExpiresAt: expiresAt };
  }
}
