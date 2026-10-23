import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { request as httpRequest } from "node:http";
import { call, json, serviceUrls } from "./lib/stack-http.mjs";

const urls = serviceUrls();
const completed = [];
function pass(name) {
  completed.push(name);
  console.log(`OK ${name}`);
}
async function mediaRange(signed) {
  const publicUrl = new URL(signed);
  assert.equal(
    publicUrl.origin,
    new URL(process.env.MEDIA_ORIGIN || "http://localhost:9000").origin,
    "El origen MinIO firmado debe coincidir con MEDIA_ORIGIN",
  );
  if (!process.env.MINIO_INTERNAL_URL) {
    const response = await fetch(publicUrl, {
      headers: { Range: "bytes=0-31" },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    assert.equal(response.status, 206);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length, 32);
    assert.equal(bytes.toString("ascii", 4, 8), "ftyp");
    return;
  }
  // Container-only mode: preserve the signed public Host while using Docker DNS.
  const internal = new URL(process.env.MINIO_INTERNAL_URL);
  assert.equal(internal.protocol, "http:");
  await new Promise((done, reject) => {
    const req = httpRequest(
      {
        hostname: internal.hostname,
        port: internal.port || 80,
        path: publicUrl.pathname + publicUrl.search,
        headers: { Host: publicUrl.host, Range: "bytes=0-31" },
      },
      (response) => {
        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > 4096) response.destroy(new Error("Unexpected media range size"));
          else chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () => {
          try {
            assert.equal(response.statusCode, 206);
            const bytes = Buffer.concat(chunks);
            assert.equal(bytes.length, 32);
            assert.equal(bytes.toString("ascii", 4, 8), "ftyp");
            done();
          } catch {
            reject(new Error("La URL firmada no permitió leer un rango MP4"));
          }
        });
      },
    );
    req.setTimeout(15000, () => req.destroy(new Error("Media timeout")));
    req.on("error", reject);
    req.end();
  });
}
async function smoke() {
  for (const [name, base] of [
    ["users-service", urls.users],
    ["catalog-service", urls.catalog],
    ["playback-service", urls.playback],
  ]) {
    const body = await json(base, "/api/health", { expected: 200 });
    assert.equal(body.status, "ok");
    assert.equal(body.service, name);
    pass(`${name} online`);
  }
  const frontend = await call(urls.frontend, "/login", { expected: 200 });
  assert.match(frontend.headers.get("content-type") || "", /text\/html/);
  pass("frontend HTTP 200");
  const email = `smoke-${randomUUID()}@example.test`,
    password = `Smoke-${randomBytes(24).toString("hex")}`;
  const registered = await json(urls.users, "/api/v1/auth/register", {
    method: "POST",
    body: { email, password, displayName: "Smoke Test" },
    expected: 201,
  });
  assert.match(registered.user.userId, /^usr_/);
  assert.equal(JSON.stringify(registered).includes("passwordHash"), false);
  await call(urls.users, "/api/v1/auth/login", {
    method: "POST",
    body: { email, password: randomBytes(24).toString("hex") },
    expected: 401,
  });
  const loginResponse = await call(urls.users, "/api/v1/auth/login", {
    method: "POST",
    body: { email, password },
    expected: 200,
  });
  const login = await loginResponse.json();
  const token = login.accessToken;
  const refresh = loginResponse.headers
    .getSetCookie()
    .find((value) => value.startsWith("users_refresh="))
    ?.split(";")[0];
  assert.ok(refresh);
  assert.equal(login.user.role, "USER");
  pass("Register/Login reales");
  await call(urls.users, "/api/v1/users/me", { expected: 401 });
  const me = await json(urls.users, "/api/v1/users/me", { token, expected: 200 });
  assert.equal(me.userId, registered.user.userId);
  const segments = token.split(".");
  segments[2] = (segments[2][0] === "a" ? "b" : "a") + segments[2].slice(1);
  await call(urls.users, "/api/v1/users/me", { token: segments.join("."), expected: 401 });
  for (const [path, method] of [
    ["/api/v1/catalog/bulk", "POST"],
    ["/api/v1/catalog/ttl_00000000-0000-4000-8000-000000000000", "PATCH"],
    ["/api/v1/catalog/ttl_00000000-0000-4000-8000-000000000000/publication-status", "PATCH"],
  ]) {
    await call(urls.catalog, path, { method, body: {}, expected: 401 });
    await call(urls.catalog, path, { method, body: {}, token, expected: 403 });
  }
  await call(urls.playback, "/api/v1/playback/me/history", { expected: 401 });
  pass("JWT y autorización USER/ADMIN");
  const page = await json(urls.catalog, "/api/v1/catalog?status=2&type=1&limit=100", {
    expected: 200,
  });
  assert.ok(Array.isArray(page.data));
  pass("Catalog list");
  await json(urls.playback, "/api/v1/playback/me/history", { token, expected: 200 });
  pass("Playback autenticado");
  let title;
  for (const entry of page.data) {
    const detail = await json(urls.catalog, `/api/v1/catalog/${entry.tituloId}`);
    if (/^ast_[0-9a-f-]{36}$/.test(detail.playbackReference?.assetId || "")) {
      title = detail;
      break;
    }
  }
  if (!title && process.env.DEMO_SEED_ENABLED !== "false")
    throw new Error(
      "Falta película publicada con asset; revisa stack-seed o habilita el seed demo",
    );
  if (title) {
    const started = await json(urls.playback, "/api/v1/playback/sessions", {
      method: "POST",
      body: { tituloId: title.tituloId },
      token,
      expected: 201,
    });
    assert.match(started.session.sessionId, /^ses_/);
    await mediaRange(started.playback.url);
    const path = `/api/v1/playback/sessions/${started.session.sessionId}`;
    const position = Math.min(2, started.session.progress.durationSeconds / 2);
    await json(urls.playback, path + "/progress", {
      method: "PATCH",
      token,
      body: { positionSeconds: position },
      expected: 200,
    });
    await json(urls.playback, path + "/pause", {
      method: "POST",
      token,
      body: { positionSeconds: position },
      expected: 200,
    });
    pass("Playback: sesión, URL firmada MP4 206, progreso y pausa");
  } else
    console.log(
      "SKIP reproducción: seed deshabilitado y sin película reproducible; Playback autenticado sí fue verificado",
    );
  // Exercise BFF/Redis, not only its public HTML response.
  const bffLogin = await call(urls.frontend, "/api/bff/auth/login", {
    method: "POST",
    body: { email, password },
    headers: { Origin: process.env.APP_ORIGIN || "http://localhost:8080", "X-Nevaro-Request": "1" },
    expected: 200,
  });
  const session = bffLogin.headers
    .getSetCookie()
    .find((value) => value.startsWith("nevaro_session="))
    ?.split(";")[0];
  assert.ok(session);
  const bffMe = await json(urls.frontend, "/api/bff/me", {
    headers: { Cookie: session },
    expected: 200,
  });
  assert.equal(bffMe.userId, me.userId);
  await call(urls.frontend, "/api/bff/auth/logout", {
    method: "POST",
    headers: {
      Cookie: session,
      Origin: process.env.APP_ORIGIN || "http://localhost:8080",
      "X-Nevaro-Request": "1",
    },
  });
  await call(urls.users, "/api/v1/auth/logout", {
    method: "POST",
    headers: { Cookie: refresh, "X-CSRF-Protection": "1" },
    expected: 204,
  });
  await call(urls.users, "/api/v1/auth/refresh", {
    method: "POST",
    headers: { Cookie: refresh, "X-CSRF-Protection": "1" },
    expected: 401,
  });
  pass("Sesión BFF/Redis y revocación refresh");
  console.log(
    JSON.stringify({
      result: "passed",
      checks: completed.length,
      playbackWithMedia: Boolean(title),
    }),
  );
}
try {
  await smoke();
} catch (error) {
  // Never print response bodies, request headers, JWTs, signed URLs or passwords.
  console.error(
    `SMOKE FAILED: ${error.name === "AssertionError" ? "Contrato o estado HTTP inesperado" : error.message}`,
  );
  process.exitCode = 1;
}
