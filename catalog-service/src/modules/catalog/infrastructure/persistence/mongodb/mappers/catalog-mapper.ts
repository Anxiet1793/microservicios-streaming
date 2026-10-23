import { createHash } from "node:crypto";
import { Int32, ObjectId } from "mongodb";
import { TituloCatalogo, type CatalogTitleState } from "../../../../domain/entities/catalog-title";
import { PersistenceError } from "../../../../../../shared/infrastructure/mongodb/persistence-error";
import type { BsonNumbers, CatalogTitleDocument } from "../documents/catalog-document";

export function toBsonNumbers<T>(value: T): BsonNumbers<T> {
  if (typeof value === "number") return new Int32(value) as BsonNumbers<T>;
  if (value instanceof Date || value === null || typeof value !== "object")
    return value as BsonNumbers<T>;
  if (Array.isArray(value)) return value.map((item) => toBsonNumbers(item)) as BsonNumbers<T>;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, toBsonNumbers(item)]),
  ) as BsonNumbers<T>;
}

export function fromBsonNumbers(value: unknown): unknown {
  if (value instanceof Int32) return value.valueOf();
  if (value instanceof Date || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(fromBsonNumbers);
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, fromBsonNumbers(item)]),
  );
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => [key, canonical(item)]),
  );
}

export function importFingerprint(title: TituloCatalogo): string {
  const { typeId, ficha, playbackReference } = title.snapshot();
  // FichaContenido ya normaliza conjuntos, espacios y reparto ausente.
  return createHash("sha256")
    .update(JSON.stringify(canonical({ typeId, ficha, playbackReference })))
    .digest("hex");
}

export function toCatalogDocument(title: TituloCatalogo, importKey: string): CatalogTitleDocument {
  return {
    _id: new ObjectId(),
    schemaVersion: new Int32(1),
    importKey,
    importFingerprint: importFingerprint(title),
    ...toBsonNumbers(title.snapshot()),
  };
}

export function fromCatalogDocument(document: CatalogTitleDocument): TituloCatalogo {
  try {
    if (Number(document.schemaVersion) !== 1) throw new Error("Unsupported schema");
    const {
      tituloId,
      typeId,
      ficha,
      publicationStatusId,
      playbackReference,
      createdAt,
      updatedAt,
      version,
    } = document;
    return TituloCatalogo.rehydrate(
      fromBsonNumbers({
        tituloId,
        typeId,
        ficha,
        publicationStatusId,
        playbackReference,
        createdAt,
        updatedAt,
        version,
      }) as CatalogTitleState,
    );
  } catch {
    throw new PersistenceError("PERSISTENCE_DATA_INVALID");
  }
}
