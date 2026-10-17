import { readEnvironment, ConfigurationError } from "../src/shared/infrastructure/config/environment";
import { createMongoClient } from "../src/shared/infrastructure/mongodb/connection";
import { PersistenceError } from "../src/shared/infrastructure/mongodb/persistence-error";
import { CatalogInitializationError, initializeCatalog } from "../src/modules/catalog/infrastructure/persistence/mongodb/initialize-catalog";

try {
  const config = readEnvironment();
  const client = createMongoClient(config);
  try {
    await client.connect();
    await initializeCatalog(client.db(config.MONGODB_DATABASE));
    console.log(JSON.stringify({ level: "info", event: "catalog_database_initialized", collections: 2, customIndexes: 9 }));
  } finally { await client.close(); }
} catch (error) {
  console.error(JSON.stringify({
    level: "error", event: "catalog_database_initialization_failed",
    code: error instanceof PersistenceError ? error.code : error instanceof ConfigurationError ? "INVALID_CONFIGURATION" : "DATABASE_UNAVAILABLE",
    ...(error instanceof ConfigurationError ? { fields: error.fields } : {}),
    ...(error instanceof CatalogInitializationError ? { collection: error.collection, reason: error.reason } : {}),
  }));
  process.exitCode = 1;
}
