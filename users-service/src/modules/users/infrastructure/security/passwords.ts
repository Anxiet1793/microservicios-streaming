import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import type { PasswordHasher } from "../../application/ports";
export class Argon2Passwords implements PasswordHasher {
  private dummy: Promise<string> | undefined;
  hash(password: string) { return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1, hashLength: 32 }); }
  async verify(password: string, hash: string | null): Promise<boolean> {
    if (!hash) this.dummy ??= this.hash(randomBytes(32).toString("hex"));
    const target = hash ?? await this.dummy!;
    const result = await argon2.verify(target, password);
    return hash !== null && result;
  }
}
