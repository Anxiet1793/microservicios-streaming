import type { MongoClient, ClientSession, Db } from "mongodb";
import type { ConsolidatedProgress, MediaAsset, PlaybackEvent, Session } from "../domain/model";
import type { EventPublisher, MediaAssetRepository, OutboxRepository, PlaybackProgressRepository, PlaybackSessionRepository, Repositories, UnitOfWork } from "../application/ports";
export class MongoMediaAssetRepository implements MediaAssetRepository {
  constructor(private db: Db, private session?: ClientSession) {}
  private get collection() { return this.db.collection<MediaAsset>("media_assets"); }
  find(assetId: string) { return this.collection.findOne({ assetId }, { session: this.session, projection: { _id: 0 } }); }
  async insert(asset: MediaAsset) { await this.collection.insertOne({ ...asset }, { session: this.session }); }
  async touchReady(assetId: string) { return (await this.collection.updateOne({ assetId, status: "READY" }, { $inc: { referenceRevision: 1 } }, { session: this.session })).matchedCount === 1; }
  async markDeleted(assetId: string, now: Date) { await this.collection.updateOne({ assetId }, { $set: { status: "DELETED", updatedAt: now }, $inc: { referenceRevision: 1 } }, { session: this.session }); }
}
export class MongoPlaybackSessionRepository implements PlaybackSessionRepository {
  constructor(private db: Db, private session?: ClientSession) {}
  private get collection() { return this.db.collection<Session>("playback_sessions"); }
  find(sessionId: string) { return this.collection.findOne({ sessionId }, { session: this.session, projection: { _id: 0 } }); }
  async save(value: Session) { await this.collection.replaceOne({ sessionId: value.sessionId }, { ...value }, { upsert: true, session: this.session }); }
  async hasOpenAsset(assetId: string) { return !!await this.collection.findOne({ assetId, supersededAt: null, status: { $in: ["ACTIVE", "PAUSED"] } }, { session: this.session, projection: { _id: 1 } }); }
}
export class MongoPlaybackProgressRepository implements PlaybackProgressRepository {
  constructor(private db: Db, private session?: ClientSession) {}
  private get collection() { return this.db.collection<ConsolidatedProgress>("playback_progress"); }
  find(userId: string, tituloId: string) { return this.collection.findOne({ userId, tituloId }, { session: this.session, projection: { _id: 0 } }); }
  async save(value: ConsolidatedProgress) { await this.collection.replaceOne({ userId: value.userId, tituloId: value.tituloId }, { ...value }, { upsert: true, session: this.session }); }
  async list(userId: string, page: number, limit: number, continuing: boolean) {
    const filter = { userId, ...(continuing ? { continueWatching: true } : {}) };
    const data = await this.collection.find(filter, { projection: { _id: 0 }, maxTimeMS: 5000 }).sort({ lastActivityAt: -1, tituloId: 1 }).skip((page - 1) * limit).limit(limit).toArray();
    const total = await this.collection.countDocuments(filter, { maxTimeMS: 5000 });
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
export class MongoOutboxRepository implements OutboxRepository {
  constructor(private db: Db, private session?: ClientSession) {}
  async insert(value: PlaybackEvent) { await this.db.collection<PlaybackEvent>("outbox_events").insertOne({ ...value }, { session: this.session }); }
}
export class OutboxEventPublisher implements EventPublisher { async publish(event: PlaybackEvent, outbox: OutboxRepository) { await outbox.insert(event); } }
export function repositories(db: Db, session?: ClientSession): Repositories { return { assets: new MongoMediaAssetRepository(db, session), sessions: new MongoPlaybackSessionRepository(db, session), progress: new MongoPlaybackProgressRepository(db, session), outbox: new MongoOutboxRepository(db, session) }; }
export class MongoUnitOfWork implements UnitOfWork {
  constructor(private client: MongoClient, private db: Db) {}
  async run<T>(work: (r: Repositories) => Promise<T>): Promise<T> {
    const session = this.client.startSession();
    try { return await session.withTransaction(() => work(repositories(this.db, session)), { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, maxCommitTimeMS: 5000, timeoutMS: 15000 }); }
    finally { await session.endSession(); }
  }
}
export async function initializeMongo(db: Db) {
  const number = { bsonType: ["double", "int", "long"], minimum: 0 };
  const progress = { bsonType: "object", required: ["positionSeconds", "durationSeconds", "percentage", "updatedAt"], properties: { positionSeconds: number, durationSeconds: number, percentage: { ...number, maximum: 100 }, updatedAt: { bsonType: "date" } } };
  const definitions: Record<string, { required: string[]; properties: Record<string, unknown> }> = {
    media_assets: { required: ["assetId", "objectKey", "bucket", "sizeBytes", "durationSeconds", "status", "createdAt", "updatedAt"], properties: { assetId: { bsonType: "string" }, sizeBytes: number, durationSeconds: number, status: { enum: ["READY", "DELETED"] }, createdAt: { bsonType: "date" }, updatedAt: { bsonType: "date" } } },
    playback_sessions: { required: ["sessionId", "userId", "tituloId", "assetId", "status", "progress", "startedAt", "lastActivityAt"], properties: { status: { enum: ["REQUESTED", "ACTIVE", "PAUSED", "COMPLETED", "FAILED"] }, progress, startedAt: { bsonType: "date" }, lastActivityAt: { bsonType: "date" } } },
    playback_progress: { required: ["userId", "tituloId", "assetId", "progress", "status", "continueWatching", "lastSessionId", "lastActivityAt"], properties: { progress, status: { enum: ["IN_PROGRESS", "COMPLETED"] }, continueWatching: { bsonType: "bool" }, lastActivityAt: { bsonType: "date" } } },
    outbox_events: { required: ["eventId", "eventType", "version", "occurredAt", "userId", "tituloId", "data", "deliveryStatus"], properties: { version: { enum: [1] }, occurredAt: { bsonType: "date" }, deliveryStatus: { enum: ["PENDING", "DELIVERED"] } } },
    rate_limit_buckets: { required: ["key", "count", "expiresAt"], properties: { key: { bsonType: "string" }, count: number, expiresAt: { bsonType: "date" } } },
  };
  for (const [name, definition] of Object.entries(definitions)) {
    const validator = { $jsonSchema: { bsonType: "object", ...definition } };
    if (!await db.listCollections({ name }).hasNext()) await db.createCollection(name, { validator });
    else await db.command({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
  }
  await db.collection("media_assets").createIndex({ assetId: 1 }, { unique: true });
  await db.collection("playback_sessions").createIndex({ sessionId: 1 }, { unique: true });
  await db.collection("playback_sessions").createIndex({ assetId: 1, status: 1 });
  await db.collection("playback_progress").createIndex({ userId: 1, tituloId: 1 }, { unique: true });
  await db.collection("playback_progress").createIndex({ userId: 1, lastActivityAt: -1, tituloId: 1 });
  await db.collection("playback_progress").createIndex({ userId: 1, continueWatching: 1, lastActivityAt: -1, tituloId: 1 });
  await db.collection("outbox_events").createIndex({ eventId: 1 }, { unique: true });
  await db.collection("outbox_events").createIndex({ deliveryStatus: 1, occurredAt: 1 });
  await db.collection("rate_limit_buckets").createIndex({ key: 1 }, { unique: true });
  await db.collection("rate_limit_buckets").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
