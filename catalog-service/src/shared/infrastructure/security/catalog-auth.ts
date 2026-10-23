import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { ConfigurationError } from "../config/environment";
import { HttpError } from "../http/http-error";

const schema = z.object({
  USERS_JWKS_URL: z
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        !url.hash &&
        !url.search
      );
    })
    .default("http://localhost:3001/.well-known/jwks.json"),
  JWT_ISSUER: z.string().min(1).default("users-service"),
  JWT_AUDIENCE: z.string().min(1).default("streaming-services"),
});
type AuthConfig = z.infer<typeof schema>;
const userId = /^usr_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const unauthorized = () => new HttpError(401, "UNAUTHORIZED", "Autenticación requerida.");

/** Only the configured Users JWKS is trusted; token-supplied jku/x5u are never used. */
export class CatalogAuthenticator {
  private readonly jwks;
  constructor(private readonly config: AuthConfig) {
    this.jwks = createRemoteJWKSet(new URL(config.USERS_JWKS_URL), {
      timeoutDuration: 4000,
      cooldownDuration: 30000,
      cacheMaxAge: 600000,
    });
  }
  async requireAdmin(request: Request): Promise<void> {
    const authorization = request.headers.get("authorization");
    if (
      !authorization ||
      authorization.length > 8192 ||
      !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization)
    )
      throw unauthorized();
    let role: unknown;
    try {
      const { payload, protectedHeader } = await jwtVerify(authorization.slice(7), this.jwks, {
        algorithms: ["RS256"],
        issuer: this.config.JWT_ISSUER,
        audience: this.config.JWT_AUDIENCE,
        requiredClaims: ["sub", "exp", "iat", "jti"],
        clockTolerance: 5,
        maxTokenAge: 1800,
      });
      if (
        protectedHeader.typ !== "JWT" ||
        typeof payload.sub !== "string" ||
        !userId.test(payload.sub) ||
        payload.userId !== payload.sub ||
        typeof payload.jti !== "string" ||
        !payload.jti ||
        (payload.role !== "USER" && payload.role !== "ADMIN")
      )
        throw unauthorized();
      role = payload.role;
    } catch {
      throw unauthorized();
    }
    if (role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Se requiere el rol ADMIN.");
  }
}

let cached: { key: string; authenticator: CatalogAuthenticator } | undefined;
export async function requireCatalogAdmin(request: Request): Promise<void> {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success)
    throw new ConfigurationError([
      ...new Set(parsed.error.issues.map((issue) => String(issue.path[0]))),
    ]);
  const key = JSON.stringify(parsed.data);
  if (cached?.key !== key) cached = { key, authenticator: new CatalogAuthenticator(parsed.data) };
  await cached.authenticator.requireAdmin(request);
}
