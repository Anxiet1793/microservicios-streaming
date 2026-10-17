import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { config } from "../shared/config";
import { HttpCatalogGateway, JwksAuthenticator, MinioMediaStorage } from "../modules/playback/infrastructure/adapters";
import { MongoUnitOfWork, OutboxEventPublisher, repositories } from "../modules/playback/infrastructure/mongo";
import type { Dependencies } from "../modules/playback/application/ports";
let singleton: ReturnType<typeof create> | undefined;
function create() {
  const c = config(), client = new MongoClient(c.MONGODB_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, socketTimeoutMS: 20000, maxPoolSize: 20 });
  const db = client.db(c.MONGODB_DATABASE), storage = new MinioMediaStorage(c);
  const dependencies: Dependencies = { repositories: repositories(db), unit: new MongoUnitOfWork(client, db), storage, catalog: new HttpCatalogGateway(c.CATALOG_SERVICE_URL), events: new OutboxEventPublisher(), runtime: { now: () => new Date(), id: prefix => `${prefix}_${randomUUID()}` }, bucket: c.MINIO_BUCKET };
  return { config: c, client, db, storage, auth: new JwksAuthenticator(c), dependencies };
}
export function container() { return singleton ??= create(); }
