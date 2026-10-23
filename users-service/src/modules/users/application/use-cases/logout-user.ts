import type { Dependencies } from "../ports";
export class LogoutUser {
  constructor(private readonly d: Dependencies) {}
  async execute(raw?: string) {
    if (raw) await this.d.sessions.revoke(this.d.refresh.hash(raw), this.d.now());
  }
}
