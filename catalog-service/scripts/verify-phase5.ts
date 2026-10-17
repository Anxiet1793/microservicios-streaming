/** Verifica la orquestación de aplicación con un repositorio controlado.
 * No carga .env, abre conexiones ni usa datos externos.
 */
import assert from "node:assert/strict";
import { composeCatalogUseCases } from "../src/bootstrap/catalog-container";
import { ApplicationError } from "../src/modules/catalog/application/errors/application-error";
import type { CreateCatalogTitleDto, UpdateCatalogTitleInput } from "../src/modules/catalog/application/dto/catalog-dto";
import { BulkCreateCatalogTitles } from "../src/modules/catalog/application/use-cases/bulk-create-catalog-titles";
import type { TituloCatalogo } from "../src/modules/catalog/domain/entities/catalog-title";
import { CatalogError } from "../src/modules/catalog/domain/errors/catalog-error";
import type { BulkTitleInput, BulkTitleResult, CatalogPage, CatalogQuery, CatalogRepository } from "../src/modules/catalog/domain/repositories/catalog-repository";
import { TituloId } from "../src/modules/catalog/domain/value-objects/titulo-id";
import { UuidTitleIdGenerator } from "../src/modules/catalog/infrastructure/runtime/uuid-title-id-generator";
import { SystemClock } from "../src/modules/catalog/infrastructure/runtime/system-clock";

class RepositoryProbe implements CatalogRepository {
  readonly lookups: string[] = [];
  readonly queries: CatalogQuery[] = [];
  readonly batches: (readonly BulkTitleInput[])[] = [];
  readonly saves: { previous: TituloCatalogo; next: TituloCatalogo }[] = [];
  found: TituloCatalogo | null = null;
  page: CatalogPage = { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
  insert: (items: readonly BulkTitleInput[]) => Promise<readonly BulkTitleResult[]> = async items => items.map(item => ({ index: item.index, status: "inserted", tituloId: item.title.tituloId }));
  save: () => Promise<void> = async () => undefined;
  async findById(id: TituloId) { this.lookups.push(id.value); return this.found; }
  async findPage(query: CatalogQuery) { this.queries.push(query); return this.page; }
  async insertMany(items: readonly BulkTitleInput[]) { this.batches.push(items); return this.insert(items); }
  async saveChanges(previous: TituloCatalogo, next: TituloCatalogo) { this.saves.push({ previous, next }); await this.save(); }
}

const createdAt = new Date("2026-09-19T12:00:00.000Z");
let now = new Date(createdAt);
let generated = 0;
const idGenerator = { next: () => TituloId.from(`ttl_00000000-0000-4000-8000-${String(++generated).padStart(12, "0")}`) };
const clock = { now: () => new Date(now) };
const repository = new RepositoryProbe();
const cases = composeCatalogUseCases({ repository, clock, idGenerator, maxBulkItems: 5 });
const completed: string[] = [];
const pass = (name: string) => { completed.push(name); console.log(`OK ${name}`); };
const movie = (key: string): CreateCatalogTitleDto => ({
  importKey: key, typeId: 1,
  ficha: { title: "Órbita de papel", synopsis: "Una expedición recibe una señal.", releaseYear: 2025, durationMinutes: 108, genres: [2, 1], languages: [2, 1], ageRatingId: 4, posterUrl: "https://example.com/poster.jpg" },
  playbackReference: { providerId: 1, assetId: "orbita", manifestKey: "movies/orbita/master.m3u8" },
});
const series: CreateCatalogTitleDto = { importKey: "demo:series", typeId: 2, ficha: { title: "Bitácoras", synopsis: "Una estación espacial.", releaseYear: 2026, genres: [1], languages: [1] } };
const hasCode = (code: string) => (error: unknown) => (error instanceof CatalogError || error instanceof ApplicationError) && error.code === code;

const empty = await cases.getCatalogTitles.execute();
assert.deepEqual(repository.queries[0], { page: 1, limit: 20 });
assert.equal(empty.pagination.totalPages, 0);
await assert.rejects(cases.getCatalogTitles.execute({ limit: 101 }), hasCode("INVALID_CATALOG_QUERY"));
await assert.rejects(cases.getCatalogTitles.execute({ page: 10002, limit: 1 }), hasCode("INVALID_CATALOG_QUERY"));
await assert.rejects(cases.getCatalogTitles.execute({ typeId: { $ne: null } } as unknown as CatalogQuery), hasCode("INVALID_CATALOG_QUERY"));
assert.equal(repository.queries.length, 1);
pass("Paginación predeterminada y filtros inválidos rechazados antes de persistencia");

await assert.rejects(cases.bulkCreateCatalogTitles.execute({ items: [] }), hasCode("VALIDATION_ERROR"));
await assert.rejects(cases.bulkCreateCatalogTitles.execute({ items: Array.from({ length: 6 }, () => movie("too-many")) }), hasCode("VALIDATION_ERROR"));
assert.equal(repository.batches.length, 0);
assert.equal(generated, 0);
pass("Lotes vacíos/excesivos se rechazan sin generar IDs ni escribir");

const mixed = await cases.bulkCreateCatalogTitles.execute({ items: [movie("demo:movie"), { ...movie("bad:status"), publicationStatusId: 2 }, series, { ...movie("bad:genre"), ficha: { ...movie("x").ficha, genres: [999] } }] });
assert.equal(repository.batches.length, 1);
assert.deepEqual(repository.batches[0]!.map(item => item.index), [0, 2]);
assert.deepEqual(mixed.summary, { received: 4, inserted: 2, duplicates: 0, failed: 2, indeterminate: 0 });
assert.deepEqual(mixed.results.map(item => item.index), [0, 1, 2, 3]);
assert.equal(mixed.success, false);
assert.equal(generated, 2);
const first = repository.batches[0]![0]!.title;
const second = repository.batches[0]![1]!.title;
assert.equal(first.snapshot().publicationStatusId, 1);
assert.deepEqual(first.snapshot().createdAt, createdAt);
assert.equal(second.snapshot().playbackReference, null);
pass("Carga parcial: una llamada bulk, índices originales, IDs propios y estado inicial");

const allInvalid = await cases.bulkCreateCatalogTitles.execute({ items: [null, { ...movie("bad:names"), typeName: "MOVIE" }] });
assert.equal(allInvalid.summary.failed, 2);
assert.equal(repository.batches.length, 1);
assert.equal(generated, 2);
pass("Lote totalmente inválido sin llamadas al repositorio ni al generador");

repository.insert = async items => items.map((item, index): BulkTitleResult => index === 0
  ? { index: item.index, status: "duplicate", tituloId: first.tituloId }
  : index === 1 ? { index: item.index, status: "indeterminate", code: "PERSISTENCE_OUTCOME_UNKNOWN" }
  : { index: item.index, status: "rejected", code: "IMPORT_KEY_CONFLICT" });
const outcomes = await cases.bulkCreateCatalogTitles.execute({ items: [movie("duplicate"), movie("unknown"), movie("conflict")] });
assert.deepEqual(outcomes.summary, { received: 3, inserted: 0, duplicates: 1, failed: 1, indeterminate: 1 });
assert.equal(outcomes.success, false);
assert.deepEqual(outcomes.errors, [{ index: 1, code: "PERSISTENCE_OUTCOME_UNKNOWN" }, { index: 2, code: "IMPORT_KEY_CONFLICT" }]);
repository.insert = async items => items.map(item => ({ index: item.index, status: "duplicate", tituloId: first.tituloId }));
assert.equal((await cases.bulkCreateCatalogTitles.execute({ items: [movie("duplicate")] })).success, true);
pass("Resumen distingue duplicados, rechazos e indeterminados sin inventar éxitos");

repository.insert = async () => [];
await assert.rejects(cases.bulkCreateCatalogTitles.execute({ items: [movie("missing-result")] }), hasCode("INVALID_REPOSITORY_RESULT"));
const batchesBeforeFailure = repository.batches.length;
const failedGenerator = new BulkCreateCatalogTitles(repository, { next: () => { throw new Error("generator-unavailable"); } }, clock);
await assert.rejects(failedGenerator.execute({ items: [movie("generation-error")] }), /generator-unavailable/);
assert.equal(repository.batches.length, batchesBeforeFailure);
pass("Fallo técnico o respuesta incompleta del repositorio no se presenta como éxito");

repository.found = first;
const detail = await cases.getCatalogTitleById.execute({ tituloId: first.tituloId });
assert.equal(detail.typeName, "MOVIE");
assert.equal(detail.publicationStatusName, "REGISTRADO");
assert.deepEqual(detail.ficha.genres, [1, 2]);
assert.deepEqual(detail.ficha.genresName, ["SCIENCE_FICTION", "DRAMA"]);
assert.deepEqual(detail.ficha.languagesName, ["es", "en"]);
assert.equal(detail.ficha.ageRatingName, "PG-13");
assert.equal(detail.playbackReference?.providerName, "CDN");
assert.equal(detail.createdAt, createdAt.toISOString());
for (const field of ["_id", "version", "schemaVersion", "importKey", "importFingerprint"]) assert.ok(!Object.hasOwn(detail, field));
repository.found = second;
assert.equal((await cases.getCatalogTitleById.execute({ tituloId: second.tituloId })).playbackReference, null);
pass("Detalle con equivalencias numéricas, fechas ISO y contrato limpio para películas/series");

repository.found = null;
await assert.rejects(cases.getCatalogTitleById.execute({ tituloId: first.tituloId }), hasCode("CATALOG_TITLE_NOT_FOUND"));
const lookupsBefore = repository.lookups.length;
await assert.rejects(cases.getCatalogTitleById.execute({ tituloId: "507f1f77bcf86cd799439011" }), hasCode("INVALID_TITLE_ID"));
assert.equal(repository.lookups.length, lookupsBefore);
pass("Título inexistente y rechazo de ObjectId como identidad pública");

repository.page = { data: [{ ...first.snapshot(), ficha: first.snapshot().ficha }], pagination: { page: 2, limit: 1, total: 3, totalPages: 3 } };
const page = await cases.getCatalogTitles.execute({ page: 2, limit: 1, typeId: 1, genreId: 2, q: "  Órbita  " });
assert.equal(repository.queries.at(-1)?.q, "Órbita");
assert.deepEqual(page.pagination, repository.page.pagination);
assert.deepEqual(page.data[0]?.ficha.genresName, ["SCIENCE_FICTION", "DRAMA"]);
assert.ok(!Object.hasOwn(page.data[0]!, "playbackReference"));
assert.ok(!Object.hasOwn(page.data[0]!.ficha, "synopsis"));
assert.ok(!Object.hasOwn(page.data[0]!, "version"));
pass("Listado mantiene filtros/paginación y excluye datos del detalle incluso si el adaptador los entrega");

repository.found = first;
now = new Date("2026-09-19T12:05:00.000Z");
const updated = await cases.updateCatalogTitle.execute({ tituloId: first.tituloId, ficha: { title: "Órbita revisada", posterUrl: null } });
assert.equal(updated.ficha.title, "Órbita revisada");
assert.equal(updated.ficha.posterUrl, undefined);
assert.equal(updated.ficha.synopsis, first.snapshot().ficha.synopsis);
assert.equal(updated.createdAt, detail.createdAt);
assert.equal(updated.updatedAt, now.toISOString());
assert.equal(repository.saves[0]?.previous, first);
assert.equal(repository.saves[0]?.next.version, 2);
pass("Actualización editorial parcial y conservación de identidad, ficha restante y fecha de creación");

const savesBefore = repository.saves.length;
await cases.updateCatalogTitle.execute({ tituloId: first.tituloId, ficha: { title: first.snapshot().ficha.title } });
await assert.rejects(cases.updateCatalogTitle.execute({ tituloId: first.tituloId, ficha: {} }), hasCode("VALIDATION_ERROR"));
await assert.rejects(cases.updateCatalogTitle.execute({ tituloId: first.tituloId, ficha: { title: null } }), hasCode("INVALID_CONTENT_SHEET"));
await assert.rejects(cases.updateCatalogTitle.execute({ tituloId: first.tituloId, ficha: { title: "X" }, publicationStatusId: 2 } as UpdateCatalogTitleInput), hasCode("VALIDATION_ERROR"));
assert.equal(repository.saves.length, savesBefore);
pass("PATCH vacío/prohibido rechazado y actualización idéntica sin escritura");

const published = await cases.changePublicationStatus.execute({ tituloId: first.tituloId, publicationStatusId: 2 });
assert.equal(published.publicationStatusName, "PUBLICADO");
repository.found = repository.saves.at(-1)!.next;
const writesBeforeNoop = repository.saves.length;
await cases.changePublicationStatus.execute({ tituloId: first.tituloId, publicationStatusId: 2 });
assert.equal(repository.saves.length, writesBeforeNoop);
await assert.rejects(cases.changePublicationStatus.execute({ tituloId: first.tituloId, publicationStatusId: 1 }), hasCode("INVALID_PUBLICATION_TRANSITION"));
const withdrawn = await cases.changePublicationStatus.execute({ tituloId: first.tituloId, publicationStatusId: 3 });
assert.equal(withdrawn.publicationStatusName, "RETIRADO");
repository.found = repository.saves.at(-1)!.next;
await assert.rejects(cases.changePublicationStatus.execute({ tituloId: first.tituloId, publicationStatusId: 2 }), hasCode("INVALID_PUBLICATION_TRANSITION"));
pass("Ciclo editorial 1→2→3, repetición idempotente y transiciones inválidas en dominio");

repository.found = first;
const concurrentError = new CatalogError("CONCURRENT_MODIFICATION", "Conflicto simulado.");
repository.save = async () => { throw concurrentError; };
await assert.rejects(cases.updateCatalogTitle.execute({ tituloId: first.tituloId, ficha: { title: "Cambio concurrente" } }), error => error === concurrentError);
await assert.rejects(cases.changePublicationStatus.execute({ tituloId: first.tituloId, publicationStatusId: 2 }), error => error === concurrentError);
repository.found = null;
await assert.rejects(cases.updateCatalogTitle.execute({ tituloId: first.tituloId, ficha: { title: "Ausente" } }), hasCode("CATALOG_TITLE_NOT_FOUND"));
await assert.rejects(cases.changePublicationStatus.execute({ tituloId: first.tituloId, publicationStatusId: 2 }), hasCode("CATALOG_TITLE_NOT_FOUND"));
pass("Errores de concurrencia e inexistencia se propagan sin reintentos ni respuestas de éxito");

assert.ok(new SystemClock().now() instanceof Date);
assert.match(new UuidTitleIdGenerator().next().value, /^ttl_[0-9a-f-]+$/);
assert.throws(() => new BulkCreateCatalogTitles(repository, idGenerator, clock, 1001), hasCode("INVALID_APPLICATION_CONFIGURATION"));
pass("Adaptadores de reloj/UUID y límite de configuración");

console.log(JSON.stringify({ result: "passed", checks: completed.length }));
