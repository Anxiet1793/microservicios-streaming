import { testAuth } from "./helpers/test-auth";
/** Verifica Compose con proyecto, imagen y volumen exclusivos; nunca carga .env. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import type {
  BulkCreateCatalogOutput,
  CatalogPageDto,
} from "../src/modules/catalog/application/dto/catalog-dto";

const exec = promisify(execFile);
const auth = await testAuth();
const adminToken = await auth.sign("ADMIN");
const project = `catalog-check-${randomUUID()}`;
const temporary = await mkdtemp(join(tmpdir(), "catalog-compose-"));
const envFile = join(temporary, "verification.env");
await writeFile(envFile, "", "utf8");
const env = {
  ...process.env,
  USERS_JWKS_URL: `http://host.docker.internal:${auth.port}/jwks`,
  JWT_ISSUER: "users-service",
  JWT_AUDIENCE: "streaming-services",
  CATALOG_IMAGE_TAG: project,
  CATALOG_PORT: "0",
  MONGODB_DATABASE: "catalog_compose_test",
};
const args = [
  "compose",
  "--env-file",
  envFile,
  "--project-name",
  project,
  "--file",
  "docker-compose.yml",
];
const compose = (command: string[], timeout = 60_000) =>
  exec("docker", [...args, ...command], {
    env,
    timeout,
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
let resourcesMayExist = false;
try {
  // Atlas se comprueba con una URI ficticia local; no se conecta a ningún clúster.
  await exec(
    "docker",
    ["compose", "--env-file", envFile, "--file", "compose.atlas.yml", "config", "--quiet"],
    {
      env: { ...env, MONGODB_URI: "mongodb://example.invalid:27017" },
      windowsHide: true,
    },
  );
  await compose(["config", "--quiet"]);
  console.log("OK configuraciones Compose local y Atlas");
  resourcesMayExist = true;
  console.log("Construyendo y arrancando proyecto Docker temporal...");
  await compose(["up", "--build", "--detach", "--wait", "--wait-timeout", "180"], 900_000);
  const { stdout: mapping } = await compose(["port", "catalog-service", "3000"]);
  const port = /^127\.0\.0\.1:(\d+)\s*$/.exec(mapping)?.[1];
  assert.ok(port, "El servicio debe publicarse únicamente en loopback");
  const origin = `http://127.0.0.1:${port}`;
  const health = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(10_000) });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok", service: "catalog-service" });
  const sample = await readFile("examples/catalog.bulk.json", "utf8");
  for (const [status, inserted, duplicates] of [
    [201, 5, 0],
    [200, 0, 5],
  ]) {
    const response = await fetch(`${origin}/api/v1/catalog/bulk`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: sample,
      signal: AbortSignal.timeout(15_000),
    });
    assert.equal(response.status, status);
    const body = (await response.json()) as BulkCreateCatalogOutput;
    assert.equal(body.summary.inserted, inserted);
    assert.equal(body.summary.duplicates, duplicates);
  }
  const page = (await (
    await fetch(`${origin}/api/v1/catalog`, { signal: AbortSignal.timeout(10_000) })
  ).json()) as CatalogPageDto;
  assert.equal(page.pagination.total, 5);
  assert.equal(page.data.filter((item) => item.typeId === 2).length, 2);
  const { stdout: uid } = await compose(["exec", "--no-TTY", "catalog-service", "id", "-u"]);
  assert.notEqual(uid.trim(), "0");
  await compose(["run", "--rm", "--no-deps", "catalog-init"]);
  const { stdout: mongoId } = await compose(["ps", "--quiet", "mongo"]);
  const { stdout: mongoPorts } = await exec(
    "docker",
    ["inspect", "--format", "{{json .HostConfig.PortBindings}}", mongoId.trim()],
    { windowsHide: true },
  );
  assert.deepEqual(Object.keys(JSON.parse(mongoPorts) ?? {}), []);
  console.log(
    JSON.stringify({
      result: "passed",
      checks: [
        "compose-local",
        "compose-atlas-config",
        "image-build",
        "health",
        "bulk",
        "idempotency",
        "pagination",
        "non-root",
        "repeatable-init",
        "private-mongo",
      ],
    }),
  );
} catch (error) {
  const failure = error as { stderr?: string; message?: string };
  console.error(failure.stderr?.slice(-4000) ?? failure.message ?? "Falló la verificación Docker.");
  if (resourcesMayExist) {
    const logs = await compose([
      "logs",
      "--no-color",
      "--tail",
      "40",
      "catalog-init",
      "catalog-service",
    ]).catch(() => null);
    if (logs) console.error(logs.stdout);
  }
  process.exitCode = 1;
} finally {
  await auth.close();
  try {
    if (resourcesMayExist)
      await compose(["down", "--volumes", "--remove-orphans", "--rmi", "local"], 120_000);
  } finally {
    // Únicamente el directorio creado por mkdtemp en este proceso.
    const target = resolve(temporary);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith("catalog-compose-"));
    await rm(target, { recursive: true, force: true });
  }
}
