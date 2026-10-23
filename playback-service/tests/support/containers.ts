import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, basename, join, resolve } from "node:path";
import assert from "node:assert/strict";
import { promisify } from "node:util";
import { MongoClient } from "mongodb";
import type { Config } from "../../src/shared/config";

const exec = promisify(execFile);
export async function docker(...args: string[]) {
  try {
    return (
      await exec("docker", args, { timeout: 180000, maxBuffer: 1024 * 1024, windowsHide: true })
    ).stdout.trim();
  } catch {
    throw new Error(`Test Docker operation failed: ${args[0]}`);
  }
}
async function wait(ready: () => Promise<boolean>) {
  for (let n = 0; n < 60; n++) {
    try {
      if (await ready()) return;
    } catch {
      /* Owned container still starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Owned test container did not become ready");
}
async function mappedPort(name: string, port: string) {
  const match = /^127\.0\.0\.1:(\d+)$/.exec(await docker("port", name, port));
  if (!match) throw new Error("Test port must be ephemeral and loopback only");
  return Number(match[1]);
}
export async function ownedMongo() {
  const name = `playback-vitest-${randomUUID()}`;
  let client: MongoClient | undefined;
  try {
    await docker(
      "run",
      "-d",
      "--rm",
      "--name",
      name,
      "-p",
      "127.0.0.1::27017",
      "mongo:8.0",
      "--replSet",
      "rs0",
      "--bind_ip_all",
    );
    await wait(async () => {
      await docker("exec", name, "mongosh", "--quiet", "--eval", "db.adminCommand({ping:1})");
      return true;
    });
    await docker(
      "exec",
      name,
      "mongosh",
      "--quiet",
      "--eval",
      'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})',
    );
    client = new MongoClient(
      `mongodb://127.0.0.1:${await mappedPort(name, "27017/tcp")}/?replicaSet=rs0&directConnection=true`,
      { serverSelectionTimeoutMS: 2000 },
    );
    await wait(async () => !!(await client!.db().admin().command({ hello: 1 })).isWritablePrimary);
    const db = client.db(`playback_test_${randomUUID().replaceAll("-", "")}`);
    return {
      client,
      db,
      async close() {
        try {
          await client!.close();
        } finally {
          await docker("rm", "-f", name);
        }
      },
    };
  } catch (error) {
    await client?.close();
    await docker("rm", "-f", name).catch(() => undefined);
    throw error;
  }
}
export function storageConfig(port = 9000): Config {
  return {
    MONGODB_URI: "mongodb://127.0.0.1:1",
    MONGODB_DATABASE: "unused_test",
    MINIO_ENDPOINT: "127.0.0.1",
    MINIO_PORT: port,
    MINIO_USE_SSL: false,
    MINIO_ACCESS_KEY: "test-owned",
    MINIO_SECRET_KEY: randomBytes(32).toString("hex"),
    MINIO_BUCKET: "owned-test-media",
    MINIO_PUBLIC_URL: `http://127.0.0.1:${port}`,
    PLAYBACK_URL_TTL: 60,
    CATALOG_SERVICE_URL: "http://127.0.0.1:1",
    USERS_JWKS_URL: "http://127.0.0.1:1/jwks",
    JWT_ISSUER: "users-service",
    JWT_AUDIENCE: "streaming-services",
    MAX_UPLOAD_BYTES: 1024,
    UPLOAD_LIMIT_PER_HOUR: 10,
    FFPROBE_PATH: "ffprobe",
    APP_ORIGIN: "http://localhost:3002",
  };
}
export async function ownedMinio() {
  const name = `playback-storage-${randomUUID()}`,
    directory = await mkdtemp(join(tmpdir(), "playback-storage-test-"));
  const config = storageConfig();
  const cleanup = async () => {
    const target = resolve(directory);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith("playback-storage-test-"));
    await rm(target, { recursive: true, force: true });
  };
  try {
    const env = join(directory, "test.env");
    await writeFile(
      env,
      `MINIO_ROOT_USER=${config.MINIO_ACCESS_KEY}\nMINIO_ROOT_PASSWORD=${config.MINIO_SECRET_KEY}\n`,
      { mode: 0o600 },
    );
    await docker(
      "run",
      "-d",
      "--rm",
      "--name",
      name,
      "--env-file",
      env,
      "-p",
      "127.0.0.1::9000",
      "playback-minio:2025-10-15",
      "server",
      "/data",
    );
    config.MINIO_PORT = await mappedPort(name, "9000/tcp");
    config.MINIO_PUBLIC_URL = `http://127.0.0.1:${config.MINIO_PORT}`;
    await wait(
      async () =>
        (
          await fetch(`${config.MINIO_PUBLIC_URL}/minio/health/live`, {
            signal: AbortSignal.timeout(1000),
          })
        ).ok,
    );
    return {
      config,
      directory,
      async close() {
        try {
          await docker("rm", "-f", name);
        } finally {
          await cleanup();
        }
      },
    };
  } catch (error) {
    await docker("rm", "-f", name).catch(() => undefined);
    await cleanup();
    throw error;
  }
}
