/** Verificación HTTP contra Next en producción y MongoDB efímero propio.
 * Requiere npm run build. No utiliza una base indicada por el entorno del usuario.
 */
import assert from "node:assert/strict";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { promisify } from "node:util";
import { MongoClient } from "mongodb";
import { initializeCatalog } from "../src/modules/catalog/infrastructure/persistence/mongodb/initialize-catalog";
import type { BulkCreateCatalogOutput, CatalogPageDto, CatalogTitleDto } from "../src/modules/catalog/application/dto/catalog-dto";
import { readJsonBody } from "../src/shared/infrastructure/http/read-json-body";
import { HttpError } from "../src/shared/infrastructure/http/http-error";
import { handleRequest } from "../src/shared/infrastructure/http/handle-request";

const exec = promisify(execFile);
const completed: string[] = [];
const pass = (name: string) => { completed.push(name); console.log(`OK ${name}`); };
const container = `catalog-phase6-${randomUUID()}`;
const apiPath = "/api/v1/catalog";
let containerStarted = false;
let app: ChildProcess | undefined;
let client: MongoClient | undefined;
let output = "";
let origin = "";
const responseIds: string[] = [];
const movie = (key: string) => ({
  importKey: key, typeId: 1,
  ficha: { title: "Órbita de papel", synopsis: "Una expedición descubre una señal.", releaseYear: 2025, durationMinutes: 108, genres: [1, 2], languages: [1, 2], ageRatingId: 4, posterUrl: "https://example.com/poster.jpg" },
  playbackReference: { providerId: 1, assetId: "orbita", manifestKey: "movies/orbita/master.m3u8" },
});
const series = { importKey: "http:series", typeId: 2, ficha: { title: "Bitácoras", synopsis: "Una estación espacial.", releaseYear: 2026, genres: [1], languages: [1] } };

async function unusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function api<T>(path: string, expectedStatus: number, method = "GET", body?: unknown, headers: Record<string, string> = {}): Promise<{ data: T; response: Response }> {
  const response = await fetch(`${origin}${path}`, {
    method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    ...(body !== undefined ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  const raw = await response.text();
  assert.equal(response.status, expectedStatus, `${method} ${path}: ${raw}`);
  const requestId = response.headers.get("x-request-id");
  assert.match(requestId ?? "", /^[0-9a-f-]{36}$/);
  responseIds.push(requestId!);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const data = (raw ? JSON.parse(raw) : null) as T;
  if (data && typeof data === "object" && "error" in data) {
    const error = data.error as { requestId: string };
    assert.equal(error.requestId, requestId);
    assert.ok(!raw.includes("stack"));
  }
  return { data, response };
}

try {
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode("{\"x\":\"" + "a".repeat(100) + "\"}")); controller.close(); } });
  const streamedRequest = new Request("http://localhost/body", { method: "POST", headers: { "content-type": "application/json", "content-length": "2" }, body: stream, duplex: "half" } as RequestInit);
  await assert.rejects(readJsonBody(streamedRequest, 32), (error: unknown) => error instanceof HttpError && error.status === 413);
  const bytes = new TextEncoder().encode('{"text":"🌎"}');
  const splitStream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes.slice(0, 10)); controller.enqueue(bytes.slice(10)); controller.close(); } });
  const unicodeRequest = new Request("http://localhost/body", { method: "POST", headers: { "content-type": "application/json" }, body: splitStream, duplex: "half" } as RequestInit);
  assert.deepEqual(await readJsonBody(unicodeRequest, 100), { text: "🌎" });
  pass("Límite de bytes con longitud declarada falsa y UTF-8 dividido entre chunks");

  const originalLogger = console.info;
  let sanitizedLog = "";
  let hiddenError: Response;
  try {
    console.info = (entry: unknown) => { sanitizedLog = String(entry); };
    hiddenError = await handleRequest(new Request("http://localhost/test"), "/test", async () => { throw new Error("secret-internal-error"); });
  } finally { console.info = originalLogger; }
  assert.equal(hiddenError.status, 500);
  assert.ok(!(await hiddenError.text()).includes("secret-internal-error"));
  assert.ok(!sanitizedLog.includes("secret-internal-error"));
  pass("Error inesperado sin mensaje interno ni stack en respuesta/log");

  await exec("docker", ["run", "--detach", "--rm", "--name", container, "--label", "purpose=catalog-phase6-verification", "--publish", "127.0.0.1::27017", "mongo:8.0", "--bind_ip_all"], { timeout: 300_000 });
  containerStarted = true;
  const mapping = await exec("docker", ["port", container, "27017/tcp"]);
  const mongoPort = /^127\.0\.0\.1:(\d+)\s*$/.exec(mapping.stdout)?.[1];
  assert.ok(mongoPort);
  const uri = `mongodb://127.0.0.1:${mongoPort}`;
  const database = "catalog_phase6_verification";
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 30_000 });
  await client.connect();
  await initializeCatalog(client.db(database));
  const appPort = await unusedPort();
  origin = `http://127.0.0.1:${appPort}`;
  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(appPort)], {
    windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
      MONGODB_URI: uri, MONGODB_DATABASE: database, MONGODB_MAX_POOL_SIZE: "5",
      MONGODB_SERVER_SELECTION_TIMEOUT_MS: "1000", MONGODB_QUERY_TIMEOUT_MS: "1000",
      BULK_MAX_ITEMS: "5", REQUEST_MAX_BYTES: "4096",
    },
  });
  app.stdout!.on("data", chunk => { output = (output + String(chunk)).slice(-1_000_000); });
  app.stderr!.on("data", chunk => { output = (output + String(chunk)).slice(-1_000_000); });
  let startError: Error | undefined;
  app.on("error", error => { startError = error; });
  const deadline = Date.now() + 30_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (startError) throw startError;
    if (app.exitCode !== null) throw new Error(`Next no arrancó: ${output}`);
    try { ready = (await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Aún arrancando. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, `Next no estuvo listo: ${output}`);
  const health = await api<{ status: string; service: string }>("/api/health", 200);
  assert.deepEqual(health.data, { status: "ok", service: "catalog-service" });
  pass("Next en producción y health con comprobación MongoDB");

  const loaded = await api<BulkCreateCatalogOutput>(`${apiPath}/bulk`, 201, "POST", { items: [movie("http:movie"), series] });
  assert.deepEqual(loaded.data.summary, { received: 2, inserted: 2, duplicates: 0, failed: 0, indeterminate: 0 });
  const inserted = loaded.data.results[0]!;
  const insertedSeries = loaded.data.results[1]!;
  assert.ok("tituloId" in inserted && "tituloId" in insertedSeries);
  const id = inserted.tituloId;
  const repeat = await api<BulkCreateCatalogOutput>(`${apiPath}/bulk`, 200, "POST", { items: [movie("http:movie"), series] });
  assert.equal(repeat.data.summary.duplicates, 2);
  await api(`${apiPath}/bulk`, 409, "POST", { items: [{ ...movie("http:movie"), ficha: { ...movie("x").ficha, title: "Otro título" } }] });
  pass("Carga 201, reintento idempotente 200 y conflicto de importación 409");

  const partial = await api<BulkCreateCatalogOutput>(`${apiPath}/bulk`, 207, "POST", { items: [{ ...movie("http:invalid"), publicationStatusId: 2 }, movie("http:partial"), movie("http:movie")] });
  assert.deepEqual(partial.data.summary, { received: 3, inserted: 1, duplicates: 1, failed: 1, indeterminate: 0 });
  assert.deepEqual(partial.data.results.map(result => [result.index, result.status]), [[0, "rejected"], [1, "inserted"], [2, "duplicate"]]);
  assert.ok("issues" in partial.data.results[0]!);
  pass("Carga parcial 207: validación Zod por registro e índices originales preservados");

  const detail = await api<CatalogTitleDto>(`${apiPath}/${id}`, 200);
  assert.equal(detail.data.typeName, "MOVIE");
  assert.equal(detail.data.publicationStatusName, "REGISTRADO");
  assert.deepEqual(detail.data.ficha.genresName, ["SCIENCE_FICTION", "DRAMA"]);
  assert.deepEqual(detail.data.ficha.languagesName, ["es", "en"]);
  assert.equal(detail.data.playbackReference?.providerName, "CDN");
  for (const key of ["_id", "version", "importKey", "importFingerprint"]) assert.ok(!Object.hasOwn(detail.data, key));
  const seriesDetail = await api<CatalogTitleDto>(`${apiPath}/${insertedSeries.tituloId}`, 200);
  assert.equal(seriesDetail.data.playbackReference, null);
  pass("Detalle y contrato numérico con nombres derivados, sin metadatos internos");

  const page = await api<CatalogPageDto>(`${apiPath}?page=1&limit=1&type=1&status=1&genre=2&year=2025&q=Orbita`, 200);
  assert.equal(page.data.data.length, 1);
  assert.equal(page.data.pagination.total, 2);
  assert.equal(page.data.pagination.totalPages, 2);
  assert.ok(!Object.hasOwn(page.data.data[0]!, "playbackReference"));
  assert.ok(!Object.hasOwn(page.data.data[0]!.ficha, "synopsis"));
  for (const query of ["limit=101", "limit=1&limit=2", "type=MOVIE", "genre%5B%24ne%5D=1", "page=10002&limit=1", "q=%20"]) await api(`${apiPath}?${query}`, 400);
  pass("Filtros numéricos, búsqueda, proyección, paginación e inputs de consulta inválidos");

  await api(`${apiPath}/507f1f77bcf86cd799439011`, 400);
  await api(`${apiPath}/ttl_${randomUUID()}`, 404);
  const updated = await api<CatalogTitleDto>(`${apiPath}/${id}`, 200, "PATCH", { ficha: { title: "Órbita revisada", posterUrl: null } });
  assert.equal(updated.data.ficha.posterUrl, undefined);
  assert.equal(updated.data.ficha.synopsis, detail.data.ficha.synopsis);
  assert.equal(updated.data.createdAt, detail.data.createdAt);
  const noChange = await api<CatalogTitleDto>(`${apiPath}/${id}`, 200, "PATCH", { ficha: { title: "Órbita revisada" } });
  assert.equal(noChange.data.updatedAt, updated.data.updatedAt);
  for (const body of [{ ficha: {} }, { ficha: { title: null } }, { ficha: { title: "X" }, publicationStatusId: 2 }, { ficha: { genresName: ["DRAMA"] } }, { ficha: { title: "X" }, _id: "forbidden" }]) await api(`${apiPath}/${id}`, 400, "PATCH", body);
  await api(`${apiPath}/ttl_${randomUUID()}`, 404, "PATCH", { ficha: { title: "Ausente" } });
  pass("PATCH real, no-op, protección de campos y errores de identidad/inexistencia");

  const published = await api<CatalogTitleDto>(`${apiPath}/${id}/publication-status`, 200, "PATCH", { publicationStatusId: 2 });
  assert.equal(published.data.publicationStatusName, "PUBLICADO");
  const stillPublished = await api<CatalogTitleDto>(`${apiPath}/${id}/publication-status`, 200, "PATCH", { publicationStatusId: 2 });
  assert.equal(stillPublished.data.updatedAt, published.data.updatedAt);
  await api(`${apiPath}/${id}/publication-status`, 200, "PATCH", { publicationStatusId: 3 });
  const transition = await api<{ error: { code: string } }>(`${apiPath}/${id}/publication-status`, 422, "PATCH", { publicationStatusId: 2 });
  assert.equal(transition.data.error.code, "INVALID_PUBLICATION_TRANSITION");
  await api(`${apiPath}/${id}/publication-status`, 400, "PATCH", { publicationStatusId: "PUBLICADO" });
  await api(`${apiPath}/${id}/publication-status`, 400, "PATCH", { publicationStatusId: 99 });
  pass("Publicación 1→2→3, repetición sin cambios y transición inválida 422");

  await api(`${apiPath}/bulk`, 400, "POST", { items: [] });
  await api(`${apiPath}/bulk`, 400, "POST", { items: Array.from({ length: 6 }, (_, i) => movie(`too-many:${i}`)) });
  await api(`${apiPath}/bulk`, 400, "POST", "{");
  await api(`${apiPath}/bulk`, 415, "POST", "{}", { "content-type": "text/plain" });
  await api(`${apiPath}/bulk`, 415, "POST", "{}", { "content-encoding": "gzip" });
  await api(`${apiPath}/bulk`, 413, "POST", { items: [], padding: "x".repeat(5000) });
  const oversizedStream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(" ".repeat(5000))); controller.close(); } });
  const chunked = await fetch(`${origin}${apiPath}/bulk`, { method: "POST", headers: { "content-type": "application/json" }, body: oversizedStream, duplex: "half", signal: AbortSignal.timeout(5000) } as RequestInit);
  assert.equal(chunked.status, 413);
  pass("Límites de registros/bytes, JSON inválido, media type y petición chunked excesiva");

  const beforeInvalid = await client.db(database).collection("catalog_titles").countDocuments();
  const invalid = await api<BulkCreateCatalogOutput>(`${apiPath}/bulk`, 400, "POST", { items: [{ ...movie("bad:ids"), ficha: { ...movie("x").ficha, genres: [999] } }, { ...series, ficha: { ...series.ficha, durationMinutes: 40 } }] });
  assert.equal(invalid.data.summary.failed, 2);
  assert.equal(await client.db(database).collection("catalog_titles").countDocuments(), beforeInvalid);
  const retryAfterEdit = await api<BulkCreateCatalogOutput>(`${apiPath}/bulk`, 200, "POST", { items: [movie("http:movie")] });
  assert.equal(retryAfterEdit.data.summary.duplicates, 1);
  assert.equal((await api<CatalogTitleDto>(`${apiPath}/${id}`, 200)).data.ficha.title, "Órbita revisada");
  pass("Registros inválidos sin escrituras y reimportación que conserva la ficha editada");

  const denied = await api(apiPath, 405, "POST", {});
  assert.equal(denied.response.headers.get("allow"), "GET, HEAD, OPTIONS");
  await api(`${apiPath}/bulk`, 405);
  await api(apiPath, 204, "OPTIONS");
  await api(apiPath, 200, "HEAD");
  pass("Métodos no permitidos con JSON/Allow, OPTIONS y HEAD");

  await exec("docker", ["stop", "--timeout", "1", container]);
  containerStarted = false;
  await api("/api/health", 503);
  await api(apiPath, 503);
  pass("MongoDB no disponible: health y consultas devuelven 503 sin detalles internos");

  await new Promise(resolve => setTimeout(resolve, 100));
  const logs = output.split(/\r?\n/).flatMap(line => {
    try { const entry = JSON.parse(line) as Record<string, unknown>; return entry.event === "http_request" ? [entry] : []; }
    catch { return []; }
  });
  for (const requestId of responseIds) assert.ok(logs.some(log => log.requestId === requestId), `Falta log para ${requestId}`);
  assert.ok(logs.every(log => typeof log.endpoint === "string" && !log.endpoint.includes("?") && typeof log.method === "string" && typeof log.statusCode === "number" && typeof log.durationMs === "number"));
  assert.ok(!output.includes(uri) && !output.includes("http:movie") && !output.includes("Órbita revisada"));
  pass("Logging estructurado correlacionado y sin URI, bodies ni query strings");
  console.log(JSON.stringify({ result: "passed", checks: completed.length }));
} finally {
  if (app && app.exitCode === null) {
    const exited = new Promise<void>(resolve => app!.once("exit", () => resolve()));
    app.kill();
    await exited;
  }
  await client?.close();
  if (containerStarted) await exec("docker", ["stop", "--timeout", "1", container]);
}
