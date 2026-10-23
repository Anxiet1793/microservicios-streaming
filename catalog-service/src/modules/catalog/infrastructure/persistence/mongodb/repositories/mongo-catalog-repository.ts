import { BSON, Int32, MongoBulkWriteError, type Collection, type Db, type Document } from "mongodb";
import { isDeepStrictEqual } from "node:util";
import { TituloCatalogo } from "../../../../domain/entities/catalog-title";
import { CatalogError } from "../../../../domain/errors/catalog-error";
import { CATALOG_LIMITS as L } from "../../../../domain/limits";
import type {
  BulkTitleInput,
  BulkTitleResult,
  CatalogListItem,
  CatalogPage,
  CatalogQuery,
  CatalogRepository,
} from "../../../../domain/repositories/catalog-repository";
import { CONTENT_SHEET_FIELDS } from "../../../../domain/value-objects/content-sheet";
import { EstadoPublicacion } from "../../../../domain/value-objects/publication-status";
import type { TituloId } from "../../../../domain/value-objects/titulo-id";
import { PersistenceError } from "../../../../../../shared/infrastructure/mongodb/persistence-error";
import { CATALOG_COLLECTIONS, type CatalogTitleDocument } from "../documents/catalog-document";
import {
  fromBsonNumbers,
  fromCatalogDocument,
  toBsonNumbers,
  toCatalogDocument,
} from "../mappers/catalog-mapper";
import { catalogFilter } from "./catalog-query";

interface Candidate {
  document: CatalogTitleDocument;
  items: BulkTitleInput[];
}
type CandidateResult = BulkTitleResult extends infer T
  ? T extends BulkTitleResult
    ? Omit<T, "index">
    : never
  : never;
interface ImportRecord {
  importKey: string;
  importFingerprint: string;
  tituloId: string;
}

export class MongoCatalogRepository implements CatalogRepository {
  private readonly collection: Collection<CatalogTitleDocument>;

  constructor(
    db: Db,
    private readonly queryTimeoutMs = 5000,
    private readonly bulkMaxItems = 500,
  ) {
    if (
      !Number.isInteger(queryTimeoutMs) ||
      queryTimeoutMs < 100 ||
      queryTimeoutMs > 120_000 ||
      !Number.isInteger(bulkMaxItems) ||
      bulkMaxItems < 1 ||
      bulkMaxItems > L.maxBulkItems
    ) {
      throw new CatalogError("INVALID_CATALOG_STATE", "Límites del repositorio inválidos.");
    }
    // Conservar Int32 solo al leer documentos. En comandos de escritura, esa opción
    // también envolvería códigos de error y contadores internos del driver.
    this.collection = db.collection<CatalogTitleDocument>(CATALOG_COLLECTIONS.titles);
  }

  async findById(id: TituloId): Promise<TituloCatalogo | null> {
    try {
      const document = await this.collection.findOne(
        { tituloId: id.value },
        { maxTimeMS: this.queryTimeoutMs, promoteValues: false },
      );
      return document ? fromCatalogDocument(document) : null;
    } catch (error) {
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError("PERSISTENCE_READ_FAILED");
    }
  }

  async findPage(query: CatalogQuery): Promise<CatalogPage> {
    const filter = catalogFilter(query);
    try {
      const [documents, total] = await Promise.all([
        this.collection
          .find(filter, {
            projection: {
              _id: 0,
              tituloId: 1,
              typeId: 1,
              publicationStatusId: 1,
              "ficha.title": 1,
              "ficha.releaseYear": 1,
              "ficha.genres": 1,
              "ficha.posterUrl": 1,
              updatedAt: 1,
            },
            maxTimeMS: this.queryTimeoutMs,
            promoteValues: false,
          })
          .sort({ updatedAt: -1, tituloId: 1 })
          .skip((query.page - 1) * query.limit)
          .limit(query.limit)
          .toArray(),
        this.collection.countDocuments(filter, { maxTimeMS: this.queryTimeoutMs }),
      ]);
      return {
        data: documents.map((document) => fromBsonNumbers(document) as CatalogListItem),
        pagination: {
          page: query.page,
          limit: query.limit,
          total: Number(total),
          totalPages: Math.ceil(Number(total) / query.limit),
        },
      };
    } catch {
      throw new PersistenceError("PERSISTENCE_READ_FAILED");
    }
  }

  async insertMany(items: readonly BulkTitleInput[]): Promise<readonly BulkTitleResult[]> {
    if (
      !Array.isArray(items) ||
      items.length > this.bulkMaxItems ||
      items.some(
        (item) =>
          !item ||
          !Number.isSafeInteger(item.index) ||
          item.index < 0 ||
          !(item.title instanceof TituloCatalogo) ||
          typeof item.importKey !== "string" ||
          !item.importKey ||
          item.importKey !== item.importKey.trim() ||
          [...item.importKey].length > L.importKeyLength ||
          item.title.version !== 1 ||
          item.title.snapshot().publicationStatusId !== 1,
      ) ||
      new Set(items.map((item) => item.index)).size !== items.length
    ) {
      throw new CatalogError(
        "INVALID_BULK_INPUT",
        "Lote, claves de importación o índices de entrada inválidos.",
      );
    }
    if (!items.length) return [];

    const groups = new Map<string, Candidate>();
    const conflicts = new Set<string>();
    for (const item of items) {
      const document = toCatalogDocument(item.title, item.importKey);
      const group = groups.get(item.importKey);
      if (group) {
        group.items.push(item);
        if (group.document.importFingerprint !== document.importFingerprint)
          conflicts.add(item.importKey);
      } else groups.set(item.importKey, { document, items: [item] });
    }
    const results: BulkTitleResult[] = [];
    const candidates: Candidate[] = [];
    for (const [key, group] of groups) {
      if (conflicts.has(key))
        this.distribute(group, { status: "rejected", code: "IMPORT_KEY_CONFLICT" }, results);
      else if (BSON.calculateObjectSize(group.document) > L.maxDocumentBytes)
        this.distribute(group, { status: "rejected", code: "DOCUMENT_TOO_LARGE" }, results);
      else candidates.push(group);
    }
    if (!candidates.length) return results.sort((a, b) => a.index - b.index);

    try {
      const result = await this.collection.bulkWrite(
        candidates.map(({ document }) => ({ insertOne: { document } })),
        { ordered: false, timeoutMS: this.queryTimeoutMs },
      );
      const confirmed =
        result.insertedCount === candidates.length && !result.getWriteConcernError();
      for (const candidate of candidates)
        this.distribute(
          candidate,
          confirmed
            ? { status: "inserted", tituloId: candidate.document.tituloId }
            : { status: "indeterminate", code: "PERSISTENCE_OUTCOME_UNKNOWN" },
          results,
        );
    } catch (error) {
      if (error instanceof MongoBulkWriteError)
        await this.resolveBulkError(error, candidates, results);
      else
        for (const candidate of candidates)
          this.distribute(
            candidate,
            { status: "indeterminate", code: "PERSISTENCE_OUTCOME_UNKNOWN" },
            results,
          );
    }
    return results.sort((a, b) => a.index - b.index);
  }

  private distribute(
    candidate: Candidate,
    result: CandidateResult,
    target: BulkTitleResult[],
  ): void {
    candidate.items.forEach((item, position) =>
      target.push({
        ...result,
        index: item.index,
        ...(result.status === "inserted" && position > 0 ? { status: "duplicate" as const } : {}),
      } as BulkTitleResult),
    );
  }

  private async resolveBulkError(
    error: MongoBulkWriteError,
    candidates: Candidate[],
    results: BulkTitleResult[],
  ): Promise<void> {
    const errors = new Map(error.result.getWriteErrors().map((item) => [item.index, item]));
    const complete =
      !error.result.getWriteConcernError() &&
      error.result.insertedCount + errors.size === candidates.length;
    const duplicateKeys = candidates
      .filter((_, index) => errors.get(index)?.code === 11000)
      .map((item) => item.document.importKey);
    let existing: Map<string, ImportRecord> | undefined;
    if (duplicateKeys.length) {
      try {
        const documents = await this.collection
          .find<ImportRecord>(
            { importKey: { $in: duplicateKeys } },
            {
              projection: { _id: 0, importKey: 1, importFingerprint: 1, tituloId: 1 },
              maxTimeMS: this.queryTimeoutMs,
            },
          )
          .toArray();
        existing = new Map(documents.map((item) => [item.importKey, item]));
      } catch {
        /* Un fallo de reconciliación deja esos registros indeterminados. */
      }
    }
    candidates.forEach((candidate, index) => {
      const writeError = errors.get(index);
      let result: CandidateResult;
      if (!writeError)
        result = complete
          ? { status: "inserted", tituloId: candidate.document.tituloId }
          : { status: "indeterminate", code: "PERSISTENCE_OUTCOME_UNKNOWN" };
      else if (writeError.code === 11000) {
        const match = existing?.get(candidate.document.importKey);
        if (!existing) result = { status: "indeterminate", code: "PERSISTENCE_OUTCOME_UNKNOWN" };
        else if (!match) result = { status: "rejected", code: "TITLE_ID_CONFLICT" };
        else if (match.importFingerprint !== candidate.document.importFingerprint)
          result = { status: "rejected", code: "IMPORT_KEY_CONFLICT" };
        else result = { status: "duplicate", tituloId: match.tituloId };
      } else
        result = {
          status: "rejected",
          code: writeError.code === 121 ? "DOCUMENT_VALIDATION_FAILED" : "PERSISTENCE_WRITE_FAILED",
        };
      this.distribute(candidate, result, results);
    });
  }

  async saveChanges(previous: TituloCatalogo, next: TituloCatalogo): Promise<void> {
    const before = previous.snapshot();
    const after = next.snapshot();
    if (isDeepStrictEqual(before, after)) return;
    if (
      before.tituloId !== after.tituloId ||
      before.typeId !== after.typeId ||
      before.createdAt.getTime() !== after.createdAt.getTime() ||
      !isDeepStrictEqual(before.playbackReference, after.playbackReference) ||
      after.version !== before.version + 1 ||
      after.updatedAt < before.updatedAt
    ) {
      throw new CatalogError(
        "INVALID_CATALOG_STATE",
        "La actualización altera campos inmutables o una versión inválida.",
      );
    }
    EstadoPublicacion.from(before.publicationStatusId).transitionTo(after.publicationStatusId);
    const set: Document = { updatedAt: after.updatedAt };
    const unset: Document = {};
    for (const field of CONTENT_SHEET_FIELDS) {
      if (isDeepStrictEqual(before.ficha[field], after.ficha[field])) continue;
      if (after.ficha[field] === undefined) unset[`ficha.${field}`] = "";
      else set[`ficha.${field}`] = toBsonNumbers(after.ficha[field]);
    }
    if (before.publicationStatusId !== after.publicationStatusId)
      set.publicationStatusId = new Int32(after.publicationStatusId);

    // Presupuesto conservador: reserva hasta 4 bytes UTF-8 por carácter de importKey.
    const budgetDocument = toCatalogDocument(next, "x".repeat(L.importKeyLength * 4));
    if (BSON.calculateObjectSize(budgetDocument) > L.maxDocumentBytes) {
      throw new CatalogError(
        "INVALID_CONTENT_SHEET",
        "La ficha supera el presupuesto de tamaño del documento.",
      );
    }
    try {
      const result = await this.collection.updateOne(
        {
          tituloId: before.tituloId,
          version: new Int32(before.version),
          publicationStatusId: new Int32(before.publicationStatusId),
        },
        {
          $set: set,
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
          $inc: { version: new Int32(1) },
        },
        { upsert: false, timeoutMS: this.queryTimeoutMs },
      );
      if (result.matchedCount === 0) {
        const exists = await this.collection.findOne(
          { tituloId: before.tituloId },
          { projection: { _id: 1 }, maxTimeMS: this.queryTimeoutMs },
        );
        throw new CatalogError(
          exists ? "CONCURRENT_MODIFICATION" : "CATALOG_TITLE_NOT_FOUND",
          exists ? "El título cambió durante la operación." : "El título no existe.",
        );
      }
    } catch (error) {
      if (error instanceof CatalogError) throw error;
      // Una excepción tras enviar una escritura no garantiza que no se haya aplicado.
      throw new PersistenceError("PERSISTENCE_OUTCOME_UNKNOWN");
    }
  }
}
