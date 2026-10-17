/** Verificación acotada de fase 4. Siempre crea su propio MongoDB efímero en Docker.
 * No lee .env, MONGODB_URI ni una base existente; tampoco monta volúmenes.
 * La suite formal de Vitest/Jest corresponde a la fase 8.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { BSON, Int32, MongoClient, MongoServerError, ObjectId } from "mongodb";
import { TituloCatalogo, type RegisterCatalogTitle } from "../src/modules/catalog/domain/entities/catalog-title";
import { CatalogError } from "../src/modules/catalog/domain/errors/catalog-error";
import { TituloId } from "../src/modules/catalog/domain/value-objects/titulo-id";
import type { CatalogQuery } from "../src/modules/catalog/domain/repositories/catalog-repository";
import { CATALOG_COLLECTIONS } from "../src/modules/catalog/infrastructure/persistence/mongodb/documents/catalog-document";
import { CatalogInitializationError, initializeCatalog } from "../src/modules/catalog/infrastructure/persistence/mongodb/initialize-catalog";
import { fromCatalogDocument, importFingerprint, toCatalogDocument } from "../src/modules/catalog/infrastructure/persistence/mongodb/mappers/catalog-mapper";
import { MongoCatalogRepository } from "../src/modules/catalog/infrastructure/persistence/mongodb/repositories/mongo-catalog-repository";
import { readEnvironment, ConfigurationError } from "../src/shared/infrastructure/config/environment";
import { closeMongoConnection, getMongoDatabase } from "../src/shared/infrastructure/mongodb/connection";

const exec = promisify(execFile);
const containerName = `catalog-phase4-${randomUUID()}`;
const completed: string[] = [];
const now = new Date("2026-09-19T12:00:00.000Z");
const later = new Date("2026-09-19T12:01:00.000Z");
const input = (): RegisterCatalogTitle => ({
  tituloId: `ttl_${randomUUID()}`, typeId: 1,
  ficha: { title: "Órbita de papel", synopsis: "Una expedición encuentra una señal.", releaseYear: 2025, durationMinutes: 108, genres: [1, 2], languages: [1, 2], ageRatingId: 4, posterUrl: "https://example.com/poster.jpg" },
  playbackReference: { providerId: 1, assetId: "orbita", manifestKey: "movies/orbita/master.m3u8" },
});
const movie = (overrides: Partial<RegisterCatalogTitle> = {}) => TituloCatalogo.register({ ...input(), ...overrides }, now);
const pass = (name: string) => { completed.push(name); console.log(`OK ${name}`); };
let started = false;
let client: MongoClient | undefined;

try {
  await exec("docker", ["run", "--detach", "--rm", "--name", containerName, "--label", "purpose=catalog-phase4-verification", "--publish", "127.0.0.1::27017", "mongo:8.0", "--bind_ip_all"], { timeout: 300_000 });
  started = true;
  const { stdout } = await exec("docker", ["port", containerName, "27017/tcp"]);
  const port = /^127\.0\.0\.1:(\d+)\s*$/.exec(stdout)?.[1];
  assert.ok(port, "El contenedor debe exponer un único puerto de loopback");
  const config = readEnvironment({ MONGODB_URI: `mongodb://127.0.0.1:${port}`, MONGODB_DATABASE: "catalog_phase4_verification", MONGODB_SERVER_SELECTION_TIMEOUT_MS: "30000" });
  client = new MongoClient(config.MONGODB_URI, { serverSelectionTimeoutMS: 30_000 });
  await client.connect();
  const db = client.db(config.MONGODB_DATABASE);
  const repository = new MongoCatalogRepository(db);
  const raw = db.collection(CATALOG_COLLECTIONS.titles);

  await initializeCatalog(db);
  const firstIndexes = await raw.listIndexes().toArray();
  await initializeCatalog(db);
  assert.deepEqual(await raw.listIndexes().toArray(), firstIndexes);
  assert.equal(firstIndexes.length, 8);
  assert.equal((await db.collection(CATALOG_COLLECTIONS.episodes).listIndexes().toArray()).length, 3);
  const cli = await exec(process.execPath, ["--import", "tsx", "scripts/init-mongo.ts"], {
    env: { ...process.env, ...Object.fromEntries(Object.entries(config).map(([key, value]) => [key, String(value)])) },
  });
  assert.equal((JSON.parse(cli.stdout) as { event: string }).event, "catalog_database_initialized");
  pass("Inicialización repetible: dos colecciones y nueve índices propios");

  const incompatibleDb = client.db("catalog_phase4_incompatible_verification");
  await incompatibleDb.collection(CATALOG_COLLECTIONS.titles).createIndex({ tituloId: 1 }, { name: "uq_catalog_titles_titulo_id", unique: false });
  await assert.rejects(initializeCatalog(incompatibleDb), (error: unknown) => error instanceof CatalogInitializationError && error.reason === "INDEX_CONFLICT" && error.collection === CATALOG_COLLECTIONS.titles);
  assert.notEqual((await incompatibleDb.collection(CATALOG_COLLECTIONS.titles).listIndexes().toArray()).find(index => index.name === "uq_catalog_titles_titulo_id")?.unique, true);
  pass("Índice incompatible: diagnóstico seguro y sin reconstrucción destructiva");

  assert.throws(() => readEnvironment({ MONGODB_URI: "secret-invalid-value" }), (error: unknown) => error instanceof ConfigurationError && !error.message.includes("secret-invalid-value"));
  const [connectionA, connectionB] = await Promise.all([getMongoDatabase(config), getMongoDatabase(config)]);
  assert.equal(connectionA, connectionB);
  await closeMongoConnection();
  pass("Configuración segura y conexión compartida entre llamadas concurrentes");

  const first = movie();
  const second = movie({ typeId: 2, ficha: { title: "Bitácoras del mañana", synopsis: "Historias de una estación.", releaseYear: 2026, genres: [1], languages: [1] }, playbackReference: null });
  const document = toCatalogDocument(first, "verify:movie");
  const restoredDocument = BSON.deserialize(BSON.serialize(document), { promoteValues: false }) as typeof document;
  assert.ok(restoredDocument.typeId instanceof Int32);
  assert.ok(restoredDocument.ficha.genres[0] instanceof Int32);
  assert.deepEqual(fromCatalogDocument(restoredDocument).snapshot(), first.snapshot());
  pass("Mapeo BSON Int32 y reconstrucción del agregado sin metadatos internos");

  assert.deepEqual((await repository.insertMany([{ index: 0, importKey: "verify:movie", title: first }, { index: 1, importKey: "verify:series", title: second }])).map(result => result.status), ["inserted", "inserted"]);
  assert.equal((await repository.findById(TituloId.from(first.tituloId)))?.tituloId, first.tituloId);
  assert.equal(await repository.findById(TituloId.from(`ttl_${randomUUID()}`)), null);
  const stored = await raw.findOne({ tituloId: first.tituloId });
  assert.equal(stored?.typeId, 1);
  assert.ok(!Object.hasOwn(stored!, "typeName"));
  assert.ok(!Object.hasOwn(stored!.ficha, "genresName"));
  pass("Carga de película y serie, consulta por identidad y nombres no persistidos");

  const reordered = movie({ ficha: { ...input().ficha, genres: [2, 1], languages: [2, 1] } });
  assert.equal(importFingerprint(reordered), importFingerprint(first));
  assert.deepEqual(await repository.insertMany([{ index: 3, importKey: "verify:movie", title: reordered }]), [{ index: 3, status: "duplicate", tituloId: first.tituloId }]);
  const changed = movie({ ficha: { ...input().ficha, title: "Otra película" } });
  assert.deepEqual(await repository.insertMany([{ index: 4, importKey: "verify:movie", title: changed }]), [{ index: 4, status: "rejected", code: "IMPORT_KEY_CONFLICT" }]);
  pass("Idempotencia canónica y conflicto de clave con contenido diferente");

  const grouped = movie();
  assert.deepEqual((await repository.insertMany([{ index: 10, importKey: "verify:group", title: grouped }, { index: 11, importKey: "verify:group", title: movie() }])).map(result => result.status), ["inserted", "duplicate"]);
  const conflictGroup = await repository.insertMany([{ index: 12, importKey: "verify:conflict-group", title: movie() }, { index: 13, importKey: "verify:conflict-group", title: changed }]);
  assert.ok(conflictGroup.every(result => result.status === "rejected" && result.code === "IMPORT_KEY_CONFLICT"));
  assert.equal(await raw.countDocuments({ importKey: "verify:conflict-group" }), 0);
  pass("Claves repetidas dentro del lote: equivalentes y contradictorias");

  const racing = await Promise.all([
    repository.insertMany([{ index: 0, importKey: "verify:race", title: movie() }]),
    repository.insertMany([{ index: 0, importKey: "verify:race", title: movie() }]),
  ]);
  assert.deepEqual(racing.flat().map(result => result.status).sort(), ["duplicate", "inserted"]);
  assert.equal(await raw.countDocuments({ importKey: "verify:race" }), 1);
  const mixed = await repository.insertMany([{ index: 20, importKey: "verify:id-collision", title: first }, { index: 21, importKey: "verify:mixed-success", title: movie() }]);
  assert.deepEqual(mixed[0], { index: 20, status: "rejected", code: "TITLE_ID_CONFLICT" });
  assert.equal(mixed[1]?.status, "inserted");
  pass("Carrera de importación y bulk unordered que conserva éxitos parciales");

  const page = await repository.findPage({ page: 1, limit: 2, typeId: 1, publicationStatusId: 1, genreId: 2, year: 2025 });
  assert.equal(page.data.length, 2);
  assert.ok(page.pagination.total >= 2);
  assert.ok(!Object.hasOwn(page.data[0]!, "importKey"));
  assert.ok(!Object.hasOwn(page.data[0]!.ficha, "synopsis"));
  const search = await repository.findPage({ page: 1, limit: 20, q: "Órbita" });
  assert.ok(search.data.length > 0);
  await assert.rejects(repository.findPage({ page: 1, limit: 101 }), CatalogError);
  await assert.rejects(repository.findPage({ page: 10002, limit: 1 }), CatalogError);
  await assert.rejects(repository.findPage({ page: 1, limit: 20, genreId: { $ne: null } } as unknown as CatalogQuery), CatalogError);
  pass("Filtros, búsqueda textual, proyección, paginación y rechazo de operadores externos");

  const edited = first.updateFicha({ title: "Órbita revisada", posterUrl: null }, later);
  await repository.saveChanges(first, edited);
  const persisted = (await repository.findById(TituloId.from(first.tituloId)))!;
  assert.equal(persisted.snapshot().ficha.title, "Órbita revisada");
  assert.equal(persisted.snapshot().ficha.posterUrl, undefined);
  assert.equal(persisted.snapshot().ficha.synopsis, first.snapshot().ficha.synopsis);
  assert.deepEqual(persisted.snapshot().createdAt, now);
  assert.equal(persisted.version, 2);
  assert.equal((await raw.findOne({ tituloId: first.tituloId }))?.importFingerprint, stored?.importFingerprint);
  await assert.rejects(repository.saveChanges(first, first.updateFicha({ synopsis: "Edición concurrente" }, later)), (error: unknown) => error instanceof CatalogError && error.code === "CONCURRENT_MODIFICATION");
  pass("PATCH por campos, limpieza con unset, metadatos conservados y conflicto de versión");

  const published = persisted.changePublicationStatus(2, later);
  await repository.saveChanges(persisted, published);
  assert.equal((await repository.findById(TituloId.from(first.tituloId)))?.snapshot().publicationStatusId, 2);
  assert.equal(published.changePublicationStatus(2, later), published);
  await repository.saveChanges(published, published);
  assert.equal((await raw.findOne({ tituloId: first.tituloId }))?.version, 3);
  assert.throws(() => published.changePublicationStatus(1, later), CatalogError);
  const missing = movie();
  await assert.rejects(repository.saveChanges(missing, missing.updateFicha({ title: "No existe" }, later)), (error: unknown) => error instanceof CatalogError && error.code === "CATALOG_TITLE_NOT_FOUND");
  pass("Publicación válida, transición inválida, no-op y actualización inexistente");

  const invalidDocument = toCatalogDocument(movie(), "verify:invalid");
  await assert.rejects(raw.insertOne({ ...invalidDocument, typeId: "MOVIE" }), (error: unknown) => error instanceof MongoServerError && error.code === 121);
  await assert.rejects(raw.insertOne({ ...invalidDocument, typeId: new Int32(99) }), (error: unknown) => error instanceof MongoServerError && error.code === 121);
  await assert.rejects(raw.insertOne({ ...invalidDocument, typeName: "MOVIE" }), (error: unknown) => error instanceof MongoServerError && error.code === 121);
  await assert.rejects(raw.insertOne({ ...invalidDocument, typeId: new Int32(2), playbackReference: null }), (error: unknown) => error instanceof MongoServerError && error.code === 121);
  await assert.rejects(raw.insertOne({ ...invalidDocument, ficha: { ...invalidDocument.ficha, genres: [new Int32(1), new Int32(1)] } }), (error: unknown) => error instanceof MongoServerError && error.code === 121);
  pass("Validadores BSON rechazan strings, IDs desconocidos, nombres, variantes y arrays duplicados");

  const episodes = db.collection(CATALOG_COLLECTIONS.episodes);
  const episode = { _id: new ObjectId(), schemaVersion: new Int32(1), episodeId: `ep_${randomUUID()}`, seriesId: second.tituloId, seasonNumber: new Int32(1), episodeNumber: new Int32(1), ficha: { title: "La señal", synopsis: "Primer contacto.", durationMinutes: new Int32(42) }, playbackReference: { providerId: new Int32(1), assetId: "s01e01", manifestKey: "series/demo/s01/e01.m3u8" }, publicationStatusId: new Int32(1), createdAt: now, updatedAt: now, version: new Int32(1) };
  await episodes.insertOne(episode);
  await assert.rejects(episodes.insertOne({ ...episode, _id: new ObjectId(), episodeId: `ep_${randomUUID()}` }), (error: unknown) => error instanceof MongoServerError && error.code === 11000);
  pass("Esquema de episodios y unicidad de serie/temporada/episodio");

  const plan = await raw.find({ publicationStatusId: 1, typeId: 1 }).sort({ updatedAt: -1, tituloId: 1 }).explain("executionStats");
  const stats = plan.executionStats as { nReturned: number; totalDocsExamined: number; totalKeysExamined: number };
  console.log(JSON.stringify({ query: "status-and-type", ...stats, executionStages: undefined, allPlansExecution: undefined }));
  // Verificación funcional del plan en datos pequeños; no es un benchmark.
  assert.ok(stats.nReturned > 0);
  pass("Consulta explicada con executionStats en la base temporal");

  // Un fallo de confirmación se comunica como indeterminado, no como rechazo seguro.
  await exec("docker", ["stop", "--timeout", "1", containerName]);
  started = false;
  const unknown = await repository.insertMany([{ index: 99, importKey: "verify:unknown", title: movie() }]);
  assert.deepEqual(unknown, [{ index: 99, status: "indeterminate", code: "PERSISTENCE_OUTCOME_UNKNOWN" }]);
  pass("Desconexión: resultado indeterminado sin afirmar que no hubo escrituras");
  console.log(JSON.stringify({ result: "passed", checks: completed.length }));
} finally {
  await closeMongoConnection();
  await client?.close();
  if (started) await exec("docker", ["stop", "--timeout", "1", containerName]);
}
