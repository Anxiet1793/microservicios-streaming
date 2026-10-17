import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { MongoClient } from "mongodb";
import { Client } from "minio";

// Every resource is generated for this run; existing service databases are never used.
const exec = promisify(execFile), prefix = `playback-e2e-${randomBytes(4).toString("hex")}`;
const directory = await mkdtemp(join(tmpdir(), prefix)), envfile = join(directory, "test.env");
const names = { mongo: `${prefix}-mongo`, minio: `${prefix}-minio`, app: `${prefix}-app` };
const secret = randomBytes(32).toString("hex"), access = "e2e-playback", title = `ttl_${randomUUID()}`;
let assetId: string | null = null, published = true, catalogStatus = 200, passed = 0;
const keys = await generateKeyPair("RS256", { extractable: true }), jwk = { ...await exportJWK(keys.publicKey), kid: "e2e", alg: "RS256", use: "sig" };
const fixtureServer = createServer((req, res) => { res.setHeader("Content-Type", "application/json"); if (req.url === "/jwks") res.end(JSON.stringify({ keys: [jwk] })); else { res.statusCode = catalogStatus; res.end(JSON.stringify({ tituloId: title, publicationStatusId: published ? 2 : 1, playbackReference: assetId ? { assetId } : null })); } });
await new Promise<void>(resolve => fixtureServer.listen(0, "0.0.0.0", resolve));
const address = fixtureServer.address(); assert(address && typeof address === "object"); const fixturePort = address.port;
const docker = async (...args: string[]) => (await exec("docker", args, { timeout: 180000, maxBuffer: 1024 * 1024, windowsHide: true })).stdout.trim();
const port = async (name: string, containerPort: string) => Number((await docker("port", name, containerPort)).split(":").at(-1));
async function wait(check: () => Promise<boolean>) { for (let n = 0; n < 60; n++) { try { if (await check()) return; } catch { /* Dependency is still starting. */ } await new Promise(r => setTimeout(r, 1000)); } throw new Error("Test dependency timeout"); }
const group = (message: string) => { passed++; console.log(`PASS ${passed}: ${message}`); };
let dbClient: MongoClient | undefined;
try {
  await docker("network", "create", prefix);
  await docker("run", "-d", "--name", names.mongo, "--network", prefix, "--network-alias", "mongodb", "-p", "127.0.0.1::27017", "mongo:8.0", "--replSet", "rs0", "--bind_ip_all");
  await wait(async () => { await docker("exec", names.mongo, "mongosh", "--quiet", "--eval", "db.adminCommand({ping:1})"); return true; });
  await docker("exec", names.mongo, "mongosh", "--quiet", "--eval", 'rs.initiate({_id:"rs0",members:[{_id:0,host:"mongodb:27017"}]})');
  const mongoPort = await port(names.mongo, "27017/tcp");
  dbClient = new MongoClient(`mongodb://127.0.0.1:${mongoPort}/?replicaSet=rs0&directConnection=true`, { serverSelectionTimeoutMS: 3000 });
  await wait(async () => !!(await dbClient!.db().admin().command({ hello: 1 })).isWritablePrimary);
  await writeFile(envfile, `MINIO_ROOT_USER=${access}\nMINIO_ROOT_PASSWORD=${secret}\n`, { mode: 0o600 });
  await docker("run", "-d", "--name", names.minio, "--network", prefix, "--network-alias", "minio", "--env-file", envfile, "-p", "127.0.0.1::9000", "playback-minio:2025-10-15", "server", "/data");
  const minioPort = await port(names.minio, "9000/tcp");
  await wait(async () => (await fetch(`http://127.0.0.1:${minioPort}/minio/health/live`)).ok);
  await writeFile(envfile, `MONGODB_URI=mongodb://mongodb:27017/?replicaSet=rs0\nMONGODB_DATABASE=playback_test_e2e\nMINIO_ENDPOINT=minio\nMINIO_PORT=9000\nMINIO_ACCESS_KEY=${access}\nMINIO_SECRET_KEY=${secret}\nMINIO_BUCKET=playback-test\nMINIO_PUBLIC_URL=http://127.0.0.1:${minioPort}\nCATALOG_SERVICE_URL=http://host.docker.internal:${fixturePort}\nUSERS_JWKS_URL=http://host.docker.internal:${fixturePort}/jwks\nAPP_ORIGIN=http://localhost:3002\nMAX_UPLOAD_BYTES=1048576\nUPLOAD_LIMIT_PER_HOUR=50\n`, { mode: 0o600 });
  const runArgs = ["--network", prefix, "--env-file", envfile, "--add-host", "host.docker.internal:host-gateway"];
  await docker("run", "--rm", ...runArgs, "playback-service:local", "node", "dist/init.mjs");
  await docker("run", "-d", "--name", names.app, ...runArgs, "-p", "127.0.0.1::3002", "playback-service:local");
  const base = `http://127.0.0.1:${await port(names.app, "3002/tcp")}`;
  await wait(async () => (await fetch(`${base}/api/health`)).ok);
  assert.notEqual(await docker("exec", names.app, "id", "-u"), "0"); group("Docker health and non-root runtime");
  const db = dbClient.db("playback_test_e2e");
  const token = async (role: string, userId = `usr_${randomUUID()}`, issuer = "users-service", expiration = "10m") => new SignJWT({ userId, role }).setProtectedHeader({ alg: "RS256", kid: "e2e", typ: "JWT" }).setSubject(userId).setIssuer(issuer).setAudience("streaming-services").setIssuedAt().setJti(randomUUID()).setExpirationTime(expiration).sign(keys.privateKey);
  const adminToken = await token("ADMIN"), userToken = await token("USER"), otherToken = await token("USER");
  async function call(path: string, method = "GET", body?: unknown, jwt = userToken, expected = 200) {
    const multipart = body instanceof FormData;
    const response = await fetch(base + path, { method, headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}), ...(body !== undefined && !multipart ? { "Content-Type": "application/json" } : {}) }, ...(body !== undefined ? { body: multipart ? body : JSON.stringify(body) } : {}) });
    assert.equal(response.status, expected, `${method} ${path}: ${response.status} instead of ${expected}`);
    return response.status === 204 ? null : await response.json();
  }
  const sessions = "/api/v1/playback/sessions", media = "/api/v1/media/assets";
  await call(sessions, "POST", { tituloId: title }, "", 401);
  await call(sessions, "POST", { tituloId: title }, await token("USER", undefined, "wrong"), 401);
  await call(sessions, "POST", { tituloId: title }, await token("USER", undefined, undefined, "-1h"), 401);
  await call(media, "POST", undefined, userToken, 403); group("JWT issuer, expiration, missing identity and ADMIN authorization");
  await docker("exec", names.app, "ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=blue:s=320x240:r=24", "-t", "60", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "/tmp/sample.mp4");
  await docker("cp", `${names.app}:/tmp/sample.mp4`, join(directory, "sample.mp4"));
  const bytes = await readFile(join(directory, "sample.mp4"));
  const form = (data: Uint8Array, name = "exposicion.mp4", type = "video/mp4") => { const body = new FormData(); body.append("file", new Blob([new Uint8Array(data)], { type }), name); return body; };
  await call(media, "POST", form(bytes, "bad.txt", "text/plain"), adminToken, 415);
  await call(media, "POST", form(new Uint8Array(1100000)), adminToken, 413);
  await call(media, "POST", form(new TextEncoder().encode("not an MP4")), adminToken, 415);
  const extra = form(bytes); extra.append("userId", "forged"); await call(media, "POST", extra, adminToken, 400);
  const malformed = await fetch(base + media, { method: "POST", headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "multipart/form-data; boundary=missing" }, body: "invalid" }); assert.equal(malformed.status, 400);
  const asset = (await call(media, "POST", form(bytes), adminToken, 201)).asset; assetId = asset.assetId; assert.equal(asset.durationSeconds, 60); assert(!("objectKey" in asset)); group("Real MP4 streaming upload, ffprobe, MIME, signature and size validation");
  await call(`${media}/${assetId}`, "GET", undefined, adminToken); await call(`${media}/${assetId}`, "GET", undefined, userToken, 403);
  published = false; await call(sessions, "POST", { tituloId: title }, userToken, 409); published = true;
  catalogStatus = 404; await call(sessions, "POST", { tituloId: title }, userToken, 404); catalogStatus = 503; await call(sessions, "POST", { tituloId: title }, userToken, 503); catalogStatus = 200;
  await call(sessions, "POST", { tituloId: title, userId: "forged" }, userToken, 400); group("Catalog HTTP contract and rejected client identity");
  let started = await call(sessions, "POST", { tituloId: title }, userToken, 201), sessionId = started.session.sessionId;
  const signed = started.playback.url;
  const range = await fetch(signed, { headers: { Range: "bytes=0-31" } }); assert.equal(range.status, 206); assert.equal((await range.arrayBuffer()).byteLength, 32);
  const plain = new URL(signed); plain.search = ""; assert.equal((await fetch(plain)).status, 403);
  const s3 = new Client({ endPoint: "127.0.0.1", port: minioPort, useSSL: false, accessKey: access, secretKey: secret, region: "us-east-1" });
  const stored = await db.collection("media_assets").findOne({ assetId }); assert(stored);
  const expired = await s3.presignedGetObject("playback-test", stored.objectKey, 60, {}, new Date(Date.now() - 120000)); assert.equal((await fetch(expired)).status, 403); group("Private object storage, signed URL expiry and HTTP Range 206");
  await call(`${sessions}/${sessionId}/progress`, "PATCH", { positionSeconds: 20 }, otherToken, 403);
  await call(`${sessions}/${sessionId}/refresh-url`, "POST", undefined, otherToken, 403);
  await call(`${media}/${assetId}`, "DELETE", undefined, adminToken, 409);
  await call(`${sessions}/${sessionId}/progress`, "PATCH", { positionSeconds: -1 }, userToken, 400);
  await call(`${sessions}/${sessionId}/progress`, "PATCH", { positionSeconds: 80 }, userToken, 400);
  await call(`${sessions}/${sessionId}/progress`, "PATCH", { positionSeconds: 20, percentage: 100 }, userToken, 400); group("Ownership, progress invariants and deletion protection");
  await call(`${sessions}/${sessionId}/progress`, "PATCH", { positionSeconds: 30 }); await call(`${sessions}/${sessionId}/progress`, "PATCH", { positionSeconds: 30 });
  assert.equal(await db.collection("outbox_events").countDocuments({ eventType: "PLAYBACK_PROGRESS_UPDATED" }), 1);
  await call(`${sessions}/${sessionId}/pause`, "POST", { positionSeconds: 30 }); await call(`${sessions}/${sessionId}/resume`, "POST"); await call(`${sessions}/${sessionId}/refresh-url`, "POST");
  assert.equal((await call("/api/v1/playback/me/continue-watching")).data[0].progress.positionSeconds, 30);
  assert.equal((await call("/api/v1/playback/me/history", "GET", undefined, otherToken)).data.length, 0);
  const oldId = sessionId; started = await call(sessions, "POST", { tituloId: title }, userToken, 201); sessionId = started.session.sessionId; assert.equal(started.session.progress.positionSeconds, 30);
  await call(`${sessions}/${oldId}/progress`, "PATCH", { positionSeconds: 35 }, userToken, 409);
  await call(`${sessions}/${oldId}/refresh-url`, "POST", undefined, userToken, 409); group("Pause, resume, URL refresh, continue-watching and superseded sessions");
  await Promise.all([call(`${sessions}/${sessionId}/complete`, "POST"), call(`${sessions}/${sessionId}/complete`, "POST")]);
  assert.equal(await db.collection("outbox_events").countDocuments({ eventType: "PLAYBACK_COMPLETED" }), 1);
  assert.equal((await call("/api/v1/playback/me/continue-watching")).data.length, 0); assert.equal((await call("/api/v1/playback/me/history")).data[0].completed, true);
  await call(`${sessions}/${sessionId}/resume`, "POST", undefined, userToken, 409);
  await call(`${media}/${assetId}`, "DELETE", undefined, adminToken, 204); await call(sessions, "POST", { tituloId: title }, userToken, 404); group("Atomic outbox completion, history and logical deletion");
  assert.equal((await s3.statObject("playback-test", stored.objectKey)).size, bytes.length);
  let throttled = false;
  for (let i = 0; i < 51; i++) {
    const result = await fetch(base + media, { method: "POST", headers: { Authorization: `Bearer ${adminToken}` }, body: form(bytes, "bad.txt", "text/plain") });
    if (result.status === 429) { throttled = true; assert(result.headers.has("Retry-After")); break; }
    assert.equal(result.status, 415);
  }
  assert(throttled); group("Shared upload rate limit and retained bytes after logical deletion");
  const npmCli = process.env.npm_execpath; assert(npmCli);
  await exec(process.execPath, [npmCli, "run", "test:integration"], { env: { ...process.env, TEST_MONGODB_URI: `mongodb://127.0.0.1:${mongoPort}/?replicaSet=rs0&directConnection=true` }, windowsHide: true, timeout: 60000 }); group("Integration tests on isolated MongoDB replica set");
  await docker("stop", names.minio); assert.equal((await fetch(`${base}/api/health`)).status, 503); group("Health reflects object storage failure");
  console.log(`PASS: ${passed} Docker E2E groups; all test resources isolated.`);
} catch (error) {
  // Avoid printing exec arguments, environment, JWTs or signed URLs on failures.
  console.error(error instanceof Error ? error.message.split("\n")[0] : "E2E failure"); process.exitCode = 1;
} finally {
  await dbClient?.close(); await new Promise<void>(resolve => fixtureServer.close(() => resolve()));
  for (const name of Object.values(names)) await docker("rm", "-f", "-v", name).catch(() => undefined);
  await docker("network", "rm", prefix).catch(() => undefined);
  await rm(directory, { recursive: true, force: true });
}
