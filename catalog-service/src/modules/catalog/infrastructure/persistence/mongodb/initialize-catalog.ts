import { MongoServerError, type Db } from "mongodb";
import { CATALOG_COLLECTIONS } from "./documents/catalog-document";
import { TITLE_INDEXES, EPISODE_INDEXES } from "./indexes/catalog-indexes";
import { TITLE_VALIDATOR, EPISODE_VALIDATOR } from "./validators/catalog-validators";
import { PersistenceError } from "../../../../../shared/infrastructure/mongodb/persistence-error";

export class CatalogInitializationError extends PersistenceError {
  constructor(readonly collection: string, readonly reason: "INDEX_CONFLICT" | "DUPLICATE_DATA" | "INSUFFICIENT_PRIVILEGES" | "DATABASE_ERROR") {
    super("DATABASE_INITIALIZATION_FAILED");
  }
}

export async function initializeCatalog(db: Db): Promise<void> {
  let collection = CATALOG_COLLECTIONS.titles as string;
  try {
    for (const definition of [
      { name: CATALOG_COLLECTIONS.titles, validator: TITLE_VALIDATOR, indexes: TITLE_INDEXES },
      { name: CATALOG_COLLECTIONS.episodes, validator: EPISODE_VALIDATOR, indexes: EPISODE_INDEXES },
    ]) {
      collection = definition.name;
      const options = { validator: definition.validator, validationLevel: "strict", validationAction: "error" } as const;
      try { await db.createCollection(definition.name, options); }
      catch (error) {
        if (!(error instanceof MongoServerError) || error.code !== 48) throw error;
        await db.command({ collMod: definition.name, ...options });
      }
      await db.collection(definition.name).createIndexes(definition.indexes);
    }
  } catch (error) {
    const code = error instanceof MongoServerError ? error.code : undefined;
    const reason = code === 85 || code === 86 ? "INDEX_CONFLICT"
      : code === 11000 ? "DUPLICATE_DATA"
      : code === 13 ? "INSUFFICIENT_PRIVILEGES" : "DATABASE_ERROR";
    throw new CatalogInitializationError(collection, reason);
  }
}
