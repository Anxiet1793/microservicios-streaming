import { MongoClient, type Db } from "mongodb";
import { readEnvironment, type Environment } from "../config/environment";
import { PersistenceError } from "./persistence-error";

interface CachedConnection {
  signature: string;
  client: MongoClient;
  promise: Promise<Db>;
}
const processCache = globalThis as typeof globalThis & {
  __catalogMongoConnection?: CachedConnection;
};

export function createMongoClient(config: Environment): MongoClient {
  try {
    return new MongoClient(config.MONGODB_URI, {
      appName: "catalog-service",
      maxPoolSize: config.MONGODB_MAX_POOL_SIZE,
      minPoolSize: 0,
      maxIdleTimeMS: 60_000,
      serverSelectionTimeoutMS: config.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
      connectTimeoutMS: config.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
      waitQueueTimeoutMS: config.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
      readPreference: "primary",
      writeConcern: { w: "majority", wtimeoutMS: config.MONGODB_QUERY_TIMEOUT_MS },
    });
  } catch {
    throw new PersistenceError("DATABASE_UNAVAILABLE");
  }
}

/** Una promesa compartida evita conexiones duplicadas durante solicitudes concurrentes/HMR. */
export function getMongoDatabase(config: Environment = readEnvironment()): Promise<Db> {
  const signature = JSON.stringify([
    config.MONGODB_URI,
    config.MONGODB_DATABASE,
    config.MONGODB_MAX_POOL_SIZE,
    config.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    config.MONGODB_QUERY_TIMEOUT_MS,
  ]);
  const cached = processCache.__catalogMongoConnection;
  if (cached) {
    if (cached.signature !== signature) throw new PersistenceError("DATABASE_UNAVAILABLE");
    return cached.promise;
  }
  const client = createMongoClient(config);
  const promise = client
    .connect()
    .then(() => client.db(config.MONGODB_DATABASE))
    .catch(async () => {
      if (processCache.__catalogMongoConnection?.client === client)
        delete processCache.__catalogMongoConnection;
      await client.close().catch(() => undefined);
      throw new PersistenceError("DATABASE_UNAVAILABLE");
    });
  processCache.__catalogMongoConnection = { signature, client, promise };
  return promise;
}

/** Solo para cierre del proceso o verificaciones; nunca al terminar cada request. */
export async function closeMongoConnection(): Promise<void> {
  const cached = processCache.__catalogMongoConnection;
  delete processCache.__catalogMongoConnection;
  if (!cached) return;
  await cached.promise.catch(() => undefined);
  await cached.client.close();
}

export async function pingMongo(config: Environment = readEnvironment()): Promise<void> {
  try {
    await (
      await getMongoDatabase(config)
    ).command({ ping: 1 }, { timeoutMS: config.MONGODB_QUERY_TIMEOUT_MS });
  } catch {
    throw new PersistenceError("DATABASE_UNAVAILABLE");
  }
}
