import { createHash, randomBytes, randomUUID } from "node:crypto";
import { exportJWK, importPKCS8, importSPKI, jwtVerify, SignJWT } from "jose";
import type { AccessClaims, AccessTokens, RefreshTokens } from "../../application/ports";
import { USER_ID, type UserState } from "../../domain/user";
import { unauthorized } from "../../domain/errors";
import type { Config } from "../../../../shared/config";

export class OpaqueRefreshTokens implements RefreshTokens {
  issue() {
    const raw = randomBytes(32).toString("base64url");
    return { raw, hash: this.hash(raw) };
  }
  hash(raw: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) unauthorized();
    return createHash("sha256").update(raw).digest("hex");
  }
}
export class RsaAccessTokens implements AccessTokens {
  private keys: Promise<{ privateKey: CryptoKey; publicKey: CryptoKey }> | undefined;
  constructor(private readonly config: Config) {}
  private getKeys() {
    this.keys ??= (async () => {
      const [privateKey, publicKey] = await Promise.all([
        importPKCS8(this.config.JWT_PRIVATE_KEY.replace(/\\n/g, "\n"), "RS256"),
        importSPKI(this.config.JWT_PUBLIC_KEY.replace(/\\n/g, "\n"), "RS256", {
          extractable: true,
        }),
      ]);
      const proof = await new SignJWT({}).setProtectedHeader({ alg: "RS256" }).sign(privateKey);
      await jwtVerify(proof, publicKey, { algorithms: ["RS256"] });
      return { privateKey, publicKey };
    })();
    return this.keys;
  }
  async sign(user: UserState) {
    const { privateKey } = await this.getKeys();
    return new SignJWT({ userId: user.userId, role: user.role, ver: user.authVersion })
      .setProtectedHeader({ alg: "RS256", kid: this.config.JWT_KEY_ID, typ: "JWT" })
      .setSubject(user.userId)
      .setIssuer(this.config.JWT_ISSUER)
      .setAudience(this.config.JWT_AUDIENCE)
      .setIssuedAt()
      .setJti(randomUUID())
      .setExpirationTime(`${this.config.ACCESS_TOKEN_TTL}s`)
      .sign(privateKey);
  }
  async verify(token: string): Promise<AccessClaims> {
    const { publicKey } = await this.getKeys();
    try {
      const { payload, protectedHeader } = await jwtVerify(token, publicKey, {
        algorithms: ["RS256"],
        issuer: this.config.JWT_ISSUER,
        audience: this.config.JWT_AUDIENCE,
        requiredClaims: ["sub", "iat", "exp", "jti"],
        clockTolerance: 5,
        maxTokenAge: 1800,
      });
      if (
        protectedHeader.kid !== this.config.JWT_KEY_ID ||
        protectedHeader.typ !== "JWT" ||
        typeof payload.sub !== "string" ||
        !USER_ID.test(payload.sub) ||
        payload.userId !== payload.sub ||
        (payload.role !== "USER" && payload.role !== "ADMIN") ||
        typeof payload.jti !== "string" ||
        !payload.jti ||
        !Number.isSafeInteger(payload.ver) ||
        Number(payload.ver) < 1
      )
        unauthorized();
      return {
        userId: payload.sub,
        role: payload.role as AccessClaims["role"],
        authVersion: payload.ver as number,
      };
    } catch {
      unauthorized();
    }
  }
  async jwks() {
    const { publicKey } = await this.getKeys();
    return {
      keys: [
        { ...(await exportJWK(publicKey)), kid: this.config.JWT_KEY_ID, alg: "RS256", use: "sig" },
      ],
    };
  }
}
