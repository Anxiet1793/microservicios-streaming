import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  initializeMongo,
  MongoUnitOfWork,
  repositories,
} from "../../src/modules/playback/infrastructure/mongo";
import { asset, fixture, tituloId, user } from "../helpers";
import * as U from "../../src/modules/playback/application/use-cases";
import { ownedMongo } from "../support/containers";
import { rateLimit } from "../../src/modules/playback/infrastructure/adapters";
let owned: Awaited<ReturnType<typeof ownedMongo>>;
let db: Awaited<ReturnType<typeof ownedMongo>>["db"];
let r: ReturnType<typeof repositories>, unit: MongoUnitOfWork;
beforeAll(async () => {
  owned = await ownedMongo();
  db = owned.db;
  r = repositories(db);
  unit = new MongoUnitOfWork(owned.client, db);
  await initializeMongo(db);
});
beforeEach(async () => {
  for (const name of ["media_assets", "playback_sessions", "playback_progress", "outbox_events"])
    await db.collection(name).deleteMany({});
  await r.assets.insert(structuredClone(asset));
});
afterAll(async () => {
  await owned?.close();
});
describe("Real MongoDB replica set", () => {
  it("creates unique and query indexes reproducibly", async () => {
    await initializeMongo(db);
    expect(
      (await db.collection("playback_progress").indexes()).filter((i) => i.unique),
    ).toHaveLength(1);
  });
  it("enforces unique assets", async () => {
    await expect(r.assets.insert(asset)).rejects.toMatchObject({ code: 11000 });
  });
  it("rolls back all writes when outbox publication fails", async () => {
    const f = fixture();
    f.d.repositories = r;
    f.d.unit = unit;
    f.d.events.publish = async () => {
      throw new Error("outbox unavailable");
    };
    await expect(new U.StartPlaybackSession(f.d).execute(user, tituloId)).rejects.toThrow(
      "outbox unavailable",
    );
    expect(await db.collection("playback_sessions").countDocuments()).toBe(0);
    expect(await db.collection("playback_progress").countDocuments()).toBe(0);
  });
  it("serializes progress and persists completion only once under concurrency", async () => {
    const f = fixture();
    f.d.repositories = r;
    f.d.unit = unit;
    const { session } = await new U.StartPlaybackSession(f.d).execute(user, tituloId);
    await new U.UpdatePlaybackProgress(f.d).execute(user, session.sessionId, 30);
    await Promise.all([
      new U.CompletePlayback(f.d).execute(user, session.sessionId),
      new U.CompletePlayback(f.d).execute(user, session.sessionId),
    ]);
    expect(
      await db.collection("outbox_events").countDocuments({ eventType: "PLAYBACK_COMPLETED" }),
    ).toBe(1);
    expect((await r.progress.find(user.userId, tituloId))?.progress.percentage).toBe(100);
  });
  it("uses the continue-watching index without collection scan", async () => {
    const plan = await db
      .collection("playback_progress")
      .find({ userId: user.userId, continueWatching: true })
      .sort({ lastActivityAt: -1, tituloId: 1 })
      .explain("executionStats");
    expect(JSON.stringify(plan.queryPlanner.winningPlan)).not.toContain("COLLSCAN");
  });
  it("starts concurrently with only one current session and rejects the losing player's writes", async () => {
    const f = fixture();
    f.d.repositories = r;
    f.d.unit = unit;
    const started = await Promise.all([
      new U.StartPlaybackSession(f.d).execute(user, tituloId),
      new U.StartPlaybackSession(f.d).execute(user, tituloId),
    ]);
    const current = (await r.progress.find(user.userId, tituloId))!;
    expect(await db.collection("playback_sessions").countDocuments({ supersededAt: null })).toBe(1);
    const old = started.find((s) => s.session.sessionId !== current.lastSessionId)!;
    await expect(
      new U.UpdatePlaybackProgress(f.d).execute(user, old.session.sessionId, 20),
    ).rejects.toThrow("SESSION_SUPERSEDED");
    expect(
      await db.collection("outbox_events").countDocuments({ eventType: "PLAYBACK_STARTED" }),
    ).toBe(2);
  });
  it("orders, paginates and consolidates history by title without mixing user data", async () => {
    const f = fixture();
    f.d.repositories = r;
    f.d.unit = unit;
    let now = Date.now();
    f.d.runtime.now = () => new Date((now += 1000));
    const ids = [tituloId, `ttl_${randomUUID()}`, `ttl_${randomUUID()}`];
    for (const id of ids) {
      const s = await new U.StartPlaybackSession(f.d).execute(user, id);
      await new U.UpdatePlaybackProgress(f.d).execute(user, s.session.sessionId, 30);
    }
    await new U.StartPlaybackSession(f.d).execute(user, ids[0]!);
    const first = await new U.GetPlaybackHistory(f.d).execute(user, 1, 2),
      second = await new U.GetPlaybackHistory(f.d).execute(user, 2, 2);
    expect(first.data.map((p) => p.tituloId)).toEqual([ids[0], ids[2]]);
    expect(second.data.map((p) => p.tituloId)).toEqual([ids[1]]);
    expect(first.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(
      (await new U.GetContinueWatching(f.d).execute(user, 1, 2)).data.map((p) => p.tituloId),
    ).toEqual([ids[0], ids[2]]);
    expect(
      (
        await new U.GetContinueWatching(f.d).execute(
          { ...user, userId: `usr_${randomUUID()}` },
          1,
          20,
        )
      ).data,
    ).toEqual([]);
  });
  it("writes Started, Paused and Completed transactionally with owned identifiers", async () => {
    const f = fixture();
    f.d.repositories = r;
    f.d.unit = unit;
    const s = await new U.StartPlaybackSession(f.d).execute(user, tituloId);
    await new U.PausePlayback(f.d).execute(user, s.session.sessionId, 30);
    await new U.CompletePlayback(f.d).execute(user, s.session.sessionId);
    const events = await db
      .collection("outbox_events")
      .find({}, { projection: { _id: 0 } })
      .toArray();
    expect(events.map((e) => e.eventType)).toEqual([
      "PLAYBACK_STARTED",
      "PLAYBACK_PAUSED",
      "PLAYBACK_COMPLETED",
    ]);
    expect(
      events.every(
        (e) =>
          e.userId === user.userId && e.tituloId === tituloId && e.deliveryStatus === "PENDING",
      ),
    ).toBe(true);
  });
  it("rolls back progress and pause when outbox fails after a session already exists", async () => {
    const f = fixture();
    f.d.repositories = r;
    f.d.unit = unit;
    const s = await new U.StartPlaybackSession(f.d).execute(user, tituloId);
    f.d.events.publish = async () => {
      throw new Error("outbox unavailable");
    };
    await expect(new U.PausePlayback(f.d).execute(user, s.session.sessionId, 50)).rejects.toThrow(
      "outbox unavailable",
    );
    expect((await r.sessions.find(s.session.sessionId))?.status).toBe("ACTIVE");
    expect((await r.progress.find(user.userId, tituloId))?.progress.positionSeconds).toBe(0);
    expect(await db.collection("outbox_events").countDocuments()).toBe(1);
  });
  it("shares atomic API quotas across concurrent callers and isolates identities", async () => {
    const identity = `quota-${randomUUID()}`;
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => rateLimit(db, identity, 3, 60)),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
    for (const result of results)
      if (result.status === "rejected") expect(result.reason.code).toBe("RATE_LIMITED");
    await expect(rateLimit(db, identity + "-other", 3, 60)).resolves.toBeUndefined();
  });
});
