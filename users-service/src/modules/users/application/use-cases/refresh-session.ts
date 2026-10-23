import { unauthorized } from "../../domain/errors";
import type { Dependencies } from "../ports";
import { authUser } from "../dto";
export class RefreshSession {
  constructor(private readonly d: Dependencies) {}
  async execute(raw: string) {
    const hash = this.d.refresh.hash(raw);
    const next = this.d.refresh.issue();
    const result = await this.d.sessions.rotate(
      hash,
      { id: this.d.uuid(), tokenHash: next.hash },
      this.d.now(),
    );
    if (result.kind !== "ok") unauthorized();
    return {
      accessToken: await this.d.access.sign(result.user),
      expiresIn: this.d.accessTtl,
      user: authUser(result.user),
      refreshToken: next.raw,
      refreshExpiresAt: result.expiresAt,
    };
  }
}
