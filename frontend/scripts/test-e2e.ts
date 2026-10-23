import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

// This runner owns every resource it mutates. It never reads developer .env files.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
  frontend = join(root, "frontend");
const project = `nevaro-e2e-${randomBytes(5).toString("hex")}`;
const directory = await mkdtemp(join(tmpdir(), `${project}-`));
const compose = join(directory, "compose.json"),
  fixture = join(directory, "fixture.json");
const exec = promisify(execFile);
const docker = async (...args: string[]) =>
  (
    await exec("docker", args, { windowsHide: true, timeout: 240000, maxBuffer: 4 * 1024 * 1024 })
  ).stdout.trim();
const dc = (...args: string[]) => docker("compose", "-p", project, "-f", compose, ...args);
async function command(executable: string, args: string[], env = process.env) {
  return new Promise<number>((done, reject) => {
    const child = spawn(executable, args, {
      cwd: frontend,
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code) => done(code ?? 1));
  });
}
// Reserve distinct explicit ports; Docker-assigned ports can change on restart.
const reservations = await Promise.all(
  Array.from({ length: 5 }, async () => {
    const server = createServer();
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Port reservation failed");
    return { server, port: address.port };
  }),
);
const [frontPort, usersPort, catalogPort, playbackPort, mediaPort] = reservations.map(
  (r) => r.port,
) as [number, number, number, number, number];
const origin = `http://127.0.0.1:${frontPort}`,
  mediaOrigin = `http://127.0.0.1:${mediaPort}`;
const password = `QA-${randomBytes(24).toString("hex")}`,
  pgPassword = randomBytes(24).toString("hex");
const keys = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const health = (test: string[]) => ({ test, interval: "3s", timeout: "5s", retries: 60 });
const healthy = { condition: "service_healthy" },
  finished = { condition: "service_completed_successfully" };
const build = (service: string, extra = {}) => ({ context: join(root, service), ...extra });
const usersEnv = {
  APP_ENV: "development",
  APP_ORIGIN: origin,
  DATABASE_URL: `postgresql://users:${pgPassword}@postgres:5432/users_e2e`,
  JWT_PRIVATE_KEY: keys.privateKey,
  JWT_PUBLIC_KEY: keys.publicKey,
  JWT_KEY_ID: "e2e-key",
  ACCESS_TOKEN_TTL: "900",
  REFRESH_TOKEN_TTL: "3600",
  SEED_PASSWORD: password,
  LOGIN_RATE_LIMIT: "100",
  REGISTER_RATE_LIMIT: "100",
  AUTH_GLOBAL_LIMIT: "10000",
};
const catalogEnv = {
  USERS_JWKS_URL: "http://users:3001/.well-known/jwks.json",
  MONGODB_URI: "mongodb://catalog-mongo:27017",
  MONGODB_DATABASE: "catalog_e2e",
};
const playbackEnv = {
  MONGODB_URI: "mongodb://mongodb:27017/?replicaSet=rs0",
  MONGODB_DATABASE: "playback_e2e",
  MINIO_ENDPOINT: "minio",
  MINIO_PORT: "9000",
  MINIO_ACCESS_KEY: "e2e-media",
  MINIO_SECRET_KEY: randomBytes(24).toString("hex"),
  MINIO_BUCKET: "e2e-media",
  MINIO_PUBLIC_URL: mediaOrigin,
  CATALOG_SERVICE_URL: "http://catalog:3000",
  USERS_JWKS_URL: "http://users:3001/.well-known/jwks.json",
  APP_ORIGIN: origin,
  PLAYBACK_URL_TTL: "900",
  MAX_UPLOAD_BYTES: "1048576",
  UPLOAD_LIMIT_PER_HOUR: "100",
};
const image = (service: string) => `${project}-${service}:test`;
const application = (service: string, environment: object) => ({
  image: image(service),
  build: build(`${service}-service`),
  environment,
  init: true,
});
const users = application("users", usersEnv),
  catalog = application("catalog", catalogEnv),
  playback = application("playback", playbackEnv);
const manifest = {
  services: {
    postgres: {
      image: "postgres:17-bookworm",
      environment: {
        POSTGRES_USER: "users",
        POSTGRES_PASSWORD: pgPassword,
        POSTGRES_DB: "users_e2e",
      },
      healthcheck: health(["CMD", "pg_isready", "-U", "users", "-d", "users_e2e"]),
    },
    "catalog-mongo": {
      image: "mongo:8.0",
      healthcheck: health([
        "CMD",
        "mongosh",
        "--quiet",
        "--eval",
        "quit(db.adminCommand({ping:1}).ok ? 0 : 1)",
      ]),
    },
    mongodb: {
      image: "mongo:8.0",
      command: ["mongod", "--replSet", "rs0", "--bind_ip_all"],
      healthcheck: health([
        "CMD",
        "mongosh",
        "--quiet",
        "--eval",
        'try { quit(rs.status().ok ? 0 : 1) } catch { rs.initiate({_id:"rs0",members:[{_id:0,host:"mongodb:27017"}]}); quit(1) }',
      ]),
    },
    minio: {
      image: "playback-minio:2025-10-15",
      build: build("playback-service", { dockerfile: "docker/minio.Dockerfile" }),
      command: ["server", "/data"],
      environment: {
        MINIO_ROOT_USER: playbackEnv.MINIO_ACCESS_KEY,
        MINIO_ROOT_PASSWORD: playbackEnv.MINIO_SECRET_KEY,
      },
      ports: [`127.0.0.1:${mediaPort}:9000`],
      healthcheck: health(["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]),
    },
    redis: { image: "redis:7.4-alpine", healthcheck: health(["CMD", "redis-cli", "ping"]) },
    "users-migrate": {
      ...users,
      command: ["node", "dist/migrate.mjs"],
      healthcheck: { disable: true },
      depends_on: { postgres: healthy },
    },
    users: {
      ...users,
      ports: [`127.0.0.1:${usersPort}:3001`],
      depends_on: { "users-migrate": finished },
    },
    "catalog-init": {
      ...catalog,
      command: ["node", "init-mongo.mjs"],
      healthcheck: { disable: true },
      depends_on: { "catalog-mongo": healthy },
    },
    catalog: {
      ...catalog,
      ports: [`127.0.0.1:${catalogPort}:3000`],
      depends_on: { "catalog-init": finished },
    },
    "playback-init": {
      ...playback,
      command: ["node", "dist/init.mjs"],
      healthcheck: { disable: true },
      depends_on: { mongodb: healthy, minio: healthy },
    },
    playback: {
      ...playback,
      ports: [`127.0.0.1:${playbackPort}:3002`],
      depends_on: { "playback-init": finished, catalog: healthy, users: healthy },
    },
    frontend: {
      image: image("frontend"),
      build: build("frontend", { args: { MEDIA_ORIGIN: mediaOrigin } }),
      init: true,
      ports: [`127.0.0.1:${frontPort}:3003`],
      environment: {
        USERS_SERVICE_URL: "http://users:3001",
        CATALOG_SERVICE_URL: "http://catalog:3000",
        PLAYBACK_SERVICE_URL: "http://playback:3002",
        REDIS_URL: "redis://redis:6379",
        SESSION_SECRET: randomBytes(32).toString("hex"),
        APP_ORIGIN: origin,
        E2E_STACK_ID: project,
      },
      depends_on: { redis: healthy, users: healthy, catalog: healthy, playback: healthy },
    },
  },
};
let result = 1;
async function json(base: string, path: string, method = "GET", body?: unknown, token?: string) {
  const multipart = body instanceof FormData;
  const response = await fetch(base + path, {
    method,
    signal: AbortSignal.timeout(60000),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined && !multipart ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Fixture setup failed: ${method} ${path} (${response.status})`);
  return response.status === 204 ? undefined : response.json();
}
try {
  await writeFile(compose, JSON.stringify(manifest), { mode: 0o600 });
  console.log("E2E: building production images from current sources (isolated stack).");
  // Build once per image and sequentially: avoid duplicate init targets and
  // concurrent Next builds exhausting a desktop Docker VM.
  for (const service of ["users", "catalog", "playback", "minio", "frontend"]) {
    if (
      (await command("docker", ["compose", "-p", project, "-f", compose, "build", service])) !== 0
    )
      throw new Error(`E2E ${service} image build failed`);
  }
  await Promise.all(
    reservations.map(({ server }) => new Promise<void>((done) => server.close(() => done()))),
  );
  console.log("E2E: starting private PostgreSQL, MongoDB, MinIO, Redis and four applications.");
  await dc("up", "-d", "--wait", "--wait-timeout", "240");
  await dc("exec", "-T", "users", "node", "dist/seed.mjs");
  const usersBase = `http://127.0.0.1:${usersPort}`,
    catalogBase = `http://127.0.0.1:${catalogPort}`,
    playbackBase = `http://127.0.0.1:${playbackPort}`;
  const admin = await json(usersBase, "/api/v1/auth/login", "POST", {
    email: "admin@streaming.local",
    password,
  });
  await dc(
    "exec",
    "-T",
    "playback",
    "ffmpeg",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=320x180:rate=24",
    "-t",
    "12",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "/tmp/e2e.mp4",
  );
  const clip = join(directory, "e2e.mp4");
  await docker("cp", `${await dc("ps", "-q", "playback")}:/tmp/e2e.mp4`, clip);
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(await readFile(clip))], { type: "video/mp4" }),
    "e2e.mp4",
  );
  // Exercise deployed security boundaries, independently from the BFF role guard.
  const demo = await json(usersBase, "/api/v1/auth/login", "POST", {
    email: "demo@streaming.local",
    password,
  });
  for (const [path, method] of [
    ["/api/v1/catalog/bulk", "POST"],
    [`/api/v1/catalog/ttl_00000000-0000-4000-8000-000000000000`, "PATCH"],
    [`/api/v1/catalog/ttl_00000000-0000-4000-8000-000000000000/publication-status`, "PATCH"],
  ]) {
    for (const [token, expected] of [
      [undefined, 401],
      [demo.accessToken, 403],
    ] as const) {
      const denied = await fetch(catalogBase + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: "{}",
        signal: AbortSignal.timeout(10000),
      });
      assert.equal(denied.status, expected, `Catalog ${method} authorization`);
    }
  }
  for (const target of [
    origin + "/login",
    usersBase + "/api/health",
    catalogBase + "/api/health",
    playbackBase + "/api/health",
  ]) {
    const response = await fetch(target, { signal: AbortSignal.timeout(10000) });
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.equal(response.headers.get("x-powered-by"), null);
  }
  console.log(
    "Deployed security smoke passed: Catalog denies anonymous/USER writes; HTTP headers on all four applications.",
  );
  const uploaded = await json(
    playbackBase,
    "/api/v1/media/assets",
    "POST",
    form,
    admin.accessToken,
  );
  const response = await json(
    catalogBase,
    "/api/v1/catalog/bulk",
    "POST",
    {
      items: [
        {
          importKey: "e2e-short-film",
          typeId: 1,
          ficha: {
            title: "NÉVARO QA · Viaje sintético",
            synopsis: "Clip propio de doce segundos para pruebas automatizadas.",
            releaseYear: 2026,
            durationMinutes: 1,
            genres: [10],
            languages: [1],
          },
          playbackReference: {
            providerId: 1,
            assetId: uploaded.asset.assetId,
            manifestKey: `asset:${uploaded.asset.assetId}`,
          },
        },
        {
          importKey: "e2e-series",
          typeId: 2,
          ficha: {
            title: "NÉVARO QA · Serie",
            synopsis: "Serie sin episodios para comprobar estados vacíos.",
            releaseYear: 2025,
            genres: [2],
            languages: [1],
          },
        },
      ],
    },
    admin.accessToken,
  );
  const ids = response.results.map((row: { tituloId?: string }) => {
    if (!row.tituloId) throw new Error("Catalog fixture was not created");
    return row.tituloId;
  });
  for (const id of ids)
    await json(
      catalogBase,
      `/api/v1/catalog/${id}/publication-status`,
      "PATCH",
      { publicationStatusId: 2 },
      admin.accessToken,
    );
  await writeFile(
    fixture,
    JSON.stringify({
      project,
      compose,
      origin,
      clip,
      tituloId: ids[0],
      seriesId: ids[1],
      title: "NÉVARO QA · Viaje sintético",
      password,
      privateKey: keys.privateKey,
    }),
    { mode: 0o600 },
  );
  console.log("E2E: demo USER/ADMIN, two titles and a 12-second H.264 MP4 ready.");
  result = await command(
    process.execPath,
    [join(frontend, "node_modules/@playwright/test/cli.js"), "test", ...process.argv.slice(2)],
    { ...process.env, E2E_BASE_URL: origin, E2E_FIXTURE: fixture },
  );
} catch (error) {
  // Do not print child error objects: their command may contain test credentials.
  console.error(error instanceof Error ? error.message.split("\n")[0] : "E2E stack failed");
} finally {
  await Promise.all(
    reservations.map(
      ({ server }) =>
        new Promise<void>((done) => (server.listening ? server.close(() => done()) : done())),
    ),
  );
  console.log("E2E: removing only this run's containers, network and temporary credentials.");
  try {
    await dc("down", "--volumes", "--remove-orphans");
  } catch {
    console.error(`Cleanup failed for owned stack ${project}`);
    result = 1;
  }
  for (const service of ["frontend", "users", "catalog", "playback"]) {
    try {
      await docker("image", "rm", image(service));
    } catch {
      /* Other Docker build references may retain an image. */
    }
  }
  const target = resolve(directory);
  if (
    dirname(target) !== resolve(tmpdir()) ||
    !target.split(/[\\/]/).at(-1)?.startsWith(`${project}-`)
  ) {
    console.error("Unsafe E2E cleanup path");
    result = 1;
  } else await rm(target, { recursive: true, force: true });
}
process.exitCode = result;
