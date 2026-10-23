import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { Client } from "minio";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import type { Db } from "mongodb";
import type { Config } from "../../../shared/config";
import type { CatalogGateway, Identity, MediaStorage } from "../application/ports";
import { fail, identifier, PlaybackError } from "../domain/model";

export class HttpCatalogGateway implements CatalogGateway {
  constructor(private baseUrl: string) {}
  async get(tituloId: string) {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/catalog/${encodeURIComponent(tituloId)}`,
        { signal: AbortSignal.timeout(4000), redirect: "error", cache: "no-store" },
      );
      if (response.status === 404) fail("TITLE_NOT_FOUND");
      if (!response.ok) fail("CATALOG_SERVICE_UNAVAILABLE");
      const data = z
        .object({
          tituloId: z.literal(tituloId),
          publicationStatusId: z.number().int(),
          playbackReference: z.object({ assetId: z.string().min(1).max(256) }).nullable(),
        })
        .safeParse(await response.json());
      if (!data.success) fail("CATALOG_SERVICE_UNAVAILABLE");
      const candidate = data.data.playbackReference?.assetId;
      return {
        published: data.data.publicationStatusId === 2,
        assetId: candidate && identifier("ast").test(candidate) ? candidate : null,
      };
    } catch (error) {
      if (error instanceof PlaybackError) throw error;
      fail("CATALOG_SERVICE_UNAVAILABLE");
    }
  }
}
export class MinioMediaStorage implements MediaStorage {
  readonly client: Client;
  private signer: Client;
  constructor(private c: Config) {
    const credentials = {
      accessKey: c.MINIO_ACCESS_KEY,
      secretKey: c.MINIO_SECRET_KEY,
      region: "us-east-1",
    };
    this.client = new Client({
      ...credentials,
      endPoint: c.MINIO_ENDPOINT,
      port: c.MINIO_PORT,
      useSSL: c.MINIO_USE_SSL,
    });
    const publicUrl = new URL(c.MINIO_PUBLIC_URL);
    if (
      publicUrl.pathname !== "/" ||
      publicUrl.search ||
      publicUrl.username ||
      publicUrl.password ||
      !["http:", "https:"].includes(publicUrl.protocol)
    )
      throw new Error("Invalid public storage endpoint");
    this.signer = new Client({
      ...credentials,
      endPoint: publicUrl.hostname,
      port: Number(publicUrl.port || (publicUrl.protocol === "https:" ? 443 : 80)),
      useSSL: publicUrl.protocol === "https:",
    });
  }
  async initialize() {
    if (!(await this.client.bucketExists(this.c.MINIO_BUCKET)))
      await this.client.makeBucket(this.c.MINIO_BUCKET, "us-east-1");
    await this.client.setBucketPolicy(this.c.MINIO_BUCKET, "");
  }
  async health() {
    return await this.client.bucketExists(this.c.MINIO_BUCKET);
  }
  async upload(key: string, path: string, sizeBytes: number) {
    try {
      await this.client.putObject(this.c.MINIO_BUCKET, key, createReadStream(path), sizeBytes, {
        "Content-Type": "video/mp4",
        "Cache-Control": "private, max-age=0",
      });
    } catch {
      fail("STORAGE_UNAVAILABLE");
    }
  }
  async delete(key: string) {
    try {
      await this.client.removeObject(this.c.MINIO_BUCKET, key);
    } catch {
      fail("STORAGE_UNAVAILABLE");
    }
  }
  async exists(key: string) {
    try {
      await this.client.statObject(this.c.MINIO_BUCKET, key);
      return true;
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && e.code === "NotFound") return false;
      fail("STORAGE_UNAVAILABLE");
    }
  }
  async createPlaybackUrl(key: string) {
    try {
      return {
        url: await this.signer.presignedGetObject(
          this.c.MINIO_BUCKET,
          key,
          this.c.PLAYBACK_URL_TTL,
        ),
        expiresIn: this.c.PLAYBACK_URL_TTL,
      };
    } catch {
      fail("STORAGE_UNAVAILABLE");
    }
  }
}
export class JwksAuthenticator {
  private jwks;
  constructor(private c: Config) {
    this.jwks = createRemoteJWKSet(new URL(c.USERS_JWKS_URL), {
      timeoutDuration: 4000,
      cooldownDuration: 30000,
      cacheMaxAge: 600000,
    });
  }
  async verify(request: Request): Promise<Identity> {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ") || authorization.length > 8192) fail("UNAUTHORIZED");
    try {
      const { payload, protectedHeader } = await jwtVerify(authorization.slice(7), this.jwks, {
        algorithms: ["RS256"],
        issuer: this.c.JWT_ISSUER,
        audience: this.c.JWT_AUDIENCE,
        requiredClaims: ["sub", "exp", "iat", "jti"],
        clockTolerance: 5,
        maxTokenAge: 1800,
      });
      if (
        protectedHeader.typ !== "JWT" ||
        typeof payload.sub !== "string" ||
        !identifier("usr").test(payload.sub) ||
        payload.userId !== payload.sub ||
        (payload.role !== "USER" && payload.role !== "ADMIN") ||
        typeof payload.jti !== "string" ||
        !payload.jti
      )
        fail("UNAUTHORIZED");
      return { userId: payload.sub, role: payload.role as Identity["role"] };
    } catch {
      fail("UNAUTHORIZED");
    }
  }
}
export async function rateLimit(db: Db, identity: string, limit: number, windowSeconds: number) {
  const window = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = createHash("sha256").update(`${identity}:${window}`).digest("hex");
  const collection = db.collection<{ key: string; count: number; expiresAt: Date }>(
    "rate_limit_buckets",
  );
  let value;
  try {
    value = await collection.findOneAndUpdate(
      { key },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date((window + 1) * windowSeconds * 1000) },
      },
      { upsert: true, returnDocument: "after" },
    );
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === 11000)
      value = await collection.findOneAndUpdate(
        { key },
        { $inc: { count: 1 } },
        { returnDocument: "after" },
      );
    else throw e;
  }
  if (!value || value.count > limit) fail("RATE_LIMITED");
}
