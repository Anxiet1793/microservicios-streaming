import {
  fail,
  PlaybackSession,
  progress,
  type MediaAsset,
  type PlaybackEvent,
  type Session,
} from "../domain/model";
import type { Dependencies, Identity, Repositories, Upload } from "./ports";

export const admin = (who: Identity) => {
  if (who.role !== "ADMIN") fail("FORBIDDEN");
};
export function presentAsset(a: MediaAsset) {
  return {
    assetId: a.assetId,
    contentType: a.contentType,
    originalFilename: a.originalFilename,
    sizeBytes: a.sizeBytes,
    durationSeconds: a.durationSeconds,
    codec: a.codec,
    width: a.width,
    height: a.height,
    status: a.status,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}
export function presentSession(s: Session) {
  return {
    sessionId: s.sessionId,
    tituloId: s.tituloId,
    assetId: s.assetId,
    status: s.status,
    progress: s.progress,
    startedAt: s.startedAt,
    lastActivityAt: s.lastActivityAt,
    completedAt: s.completedAt,
  };
}
class UseCase {
  constructor(protected readonly d: Dependencies) {}
}
export class UploadMediaAsset extends UseCase {
  async execute(who: Identity, input: Upload) {
    admin(who);
    const now = this.d.runtime.now(),
      assetId = this.d.runtime.id("ast");
    const objectKey = `videos/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${assetId}.mp4`;
    const asset: MediaAsset = {
      ...input,
      assetId,
      objectKey,
      bucket: this.d.bucket,
      originalFilename: input.filename,
      contentType: "video/mp4",
      status: "READY",
      createdAt: now,
      updatedAt: now,
      referenceRevision: 0,
    };
    // Never persist the temporary path or request-owned fields.
    const clean: MediaAsset = {
      assetId,
      objectKey,
      bucket: asset.bucket,
      originalFilename: asset.originalFilename,
      contentType: asset.contentType,
      sizeBytes: asset.sizeBytes,
      durationSeconds: asset.durationSeconds,
      codec: asset.codec,
      width: asset.width,
      height: asset.height,
      status: asset.status,
      createdAt: now,
      updatedAt: now,
      referenceRevision: 0,
    };
    await this.d.storage.upload(objectKey, input.path, input.sizeBytes);
    try {
      await this.d.repositories.assets.insert(clean);
    } catch (error) {
      await this.d.storage.delete(objectKey).catch(() => undefined);
      throw error;
    }
    return { asset: presentAsset(clean) };
  }
}
export class GetMediaAsset extends UseCase {
  async execute(who: Identity, id: string) {
    admin(who);
    const asset = await this.d.repositories.assets.find(id);
    if (!asset) fail("MEDIA_ASSET_NOT_FOUND");
    return { asset: presentAsset(asset) };
  }
}
export class DeleteMediaAsset extends UseCase {
  async execute(who: Identity, id: string) {
    admin(who);
    await this.d.unit.run(async (r) => {
      const asset = await r.assets.find(id);
      if (!asset) fail("MEDIA_ASSET_NOT_FOUND");
      if (asset.status === "DELETED") return;
      if (await r.sessions.hasOpenAsset(id)) fail("MEDIA_ASSET_IN_USE");
      await r.assets.markDeleted(id, this.d.runtime.now());
    });
  }
}
async function ready(r: Repositories, id: string) {
  const asset = await r.assets.find(id);
  if (!asset || !(await r.assets.touchReady(id))) fail("MEDIA_ASSET_NOT_FOUND");
  return asset;
}
async function owned(r: Repositories, userId: string, id: string) {
  const session = await r.sessions.find(id);
  if (!session) fail("PLAYBACK_SESSION_NOT_FOUND");
  new PlaybackSession(session).assertOwner(userId);
  return session;
}
async function save(
  d: Dependencies,
  r: Repositories,
  session: Session,
  eventType?: PlaybackEvent["eventType"],
) {
  await r.sessions.save(session);
  await r.progress.save({
    userId: session.userId,
    tituloId: session.tituloId,
    assetId: session.assetId,
    progress: session.progress,
    status: session.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
    continueWatching: session.status !== "COMPLETED" && session.progress.percentage < 90,
    lastSessionId: session.sessionId,
    lastActivityAt: session.lastActivityAt,
  });
  if (eventType)
    await d.events.publish(
      {
        eventId: d.runtime.id("evt"),
        eventType,
        version: 1,
        occurredAt: session.lastActivityAt,
        userId: session.userId,
        tituloId: session.tituloId,
        data: {
          sessionId: session.sessionId,
          completionPercentage: session.progress.percentage,
          watchTimeSeconds: null,
        },
        deliveryStatus: "PENDING",
      },
      r.outbox,
    );
}
export class StartPlaybackSession extends UseCase {
  async execute(who: Identity, tituloId: string) {
    const title = await this.d.catalog.get(tituloId);
    if (!title.published) fail("TITLE_NOT_PUBLISHED");
    const assetId = title.assetId;
    if (!assetId) fail("MEDIA_ASSET_NOT_FOUND");
    const asset = await this.d.repositories.assets.find(assetId);
    if (!asset || asset.status !== "READY") fail("MEDIA_ASSET_NOT_FOUND");
    if (!(await this.d.storage.exists(asset.objectKey))) fail("STORAGE_UNAVAILABLE");
    const playback = await this.d.storage.createPlaybackUrl(asset.objectKey);
    const session = await this.d.unit.run(async (r) => {
      await ready(r, assetId);
      const previous = await r.progress.find(who.userId, tituloId);
      // Opening another player supersedes the prior session; late updates cannot overwrite it.
      if (previous) {
        const old = await r.sessions.find(previous.lastSessionId);
        if (old && ["ACTIVE", "PAUSED"].includes(old.status))
          await r.sessions.save(new PlaybackSession(old).supersede(this.d.runtime.now()));
      }
      const now = this.d.runtime.now();
      const position =
        previous && previous.assetId === assetId && previous.status !== "COMPLETED"
          ? Math.min(previous.progress.positionSeconds, asset.durationSeconds)
          : 0;
      const initial: Session = {
        sessionId: this.d.runtime.id("ses"),
        userId: who.userId,
        tituloId,
        assetId,
        status: "REQUESTED",
        progress: progress(position, asset.durationSeconds, now),
        startedAt: now,
        lastActivityAt: now,
        completedAt: null,
        supersededAt: null,
        emittedMilestone: Math.floor((position / asset.durationSeconds) * 4),
      };
      const active = new PlaybackSession(initial).transition("ACTIVE", now);
      await save(this.d, r, active, "PLAYBACK_STARTED");
      return active;
    });
    return { session: presentSession(session), playback };
  }
}
type Action = "progress" | "pause" | "resume" | "complete";
class ChangePlayback extends UseCase {
  protected async change(who: Identity, id: string, action: Action, position?: number) {
    let playback: { url: string; expiresIn: number } | undefined;
    if (action === "resume") {
      const s = await owned(this.d.repositories, who.userId, id),
        a = await this.d.repositories.assets.find(s.assetId);
      if (!a || a.status !== "READY") fail("MEDIA_ASSET_NOT_FOUND");
      playback = await this.d.storage.createPlaybackUrl(a.objectKey);
    }
    const session = await this.d.unit.run(async (r) => {
      const current = await owned(r, who.userId, id);
      const latest = await r.progress.find(who.userId, current.tituloId);
      if (latest?.lastSessionId !== id) fail("SESSION_SUPERSEDED");
      // Exact retries are idempotent, including completion event publication.
      if (
        (action === "complete" && current.status === "COMPLETED") ||
        (action === "pause" &&
          current.status === "PAUSED" &&
          (position === undefined || position === current.progress.positionSeconds)) ||
        (action === "progress" &&
          ["ACTIVE", "PAUSED"].includes(current.status) &&
          position === current.progress.positionSeconds)
      )
        return current;
      const now = this.d.runtime.now();
      let next =
        position === undefined ? current : new PlaybackSession(current).update(position, now);
      let event: PlaybackEvent["eventType"] | undefined;
      if (action === "progress") {
        const milestone = Math.floor(next.progress.percentage / 25);
        if (milestone > next.emittedMilestone) {
          next = { ...next, emittedMilestone: milestone };
          event = "PLAYBACK_PROGRESS_UPDATED";
        }
      } else {
        if (action === "resume") await ready(r, current.assetId);
        if (action === "complete")
          next = new PlaybackSession(next).update(next.progress.durationSeconds, now);
        next = new PlaybackSession(next).transition(
          action === "pause" ? "PAUSED" : action === "resume" ? "ACTIVE" : "COMPLETED",
          now,
        );
        event =
          action === "pause"
            ? "PLAYBACK_PAUSED"
            : action === "complete"
              ? "PLAYBACK_COMPLETED"
              : undefined;
      }
      await save(this.d, r, next, event);
      return next;
    });
    return { session: presentSession(session), ...(playback ? { playback } : {}) };
  }
}
export class UpdatePlaybackProgress extends ChangePlayback {
  execute(who: Identity, id: string, position: number) {
    return this.change(who, id, "progress", position);
  }
}
export class PausePlayback extends ChangePlayback {
  execute(who: Identity, id: string, position?: number) {
    return this.change(who, id, "pause", position);
  }
}
export class ResumePlayback extends ChangePlayback {
  execute(who: Identity, id: string) {
    return this.change(who, id, "resume");
  }
}
export class CompletePlayback extends ChangePlayback {
  execute(who: Identity, id: string) {
    return this.change(who, id, "complete");
  }
}
export class RefreshPlaybackUrl extends UseCase {
  async execute(who: Identity, id: string) {
    const s = await owned(this.d.repositories, who.userId, id);
    new PlaybackSession(s).assertCurrent();
    if (!["ACTIVE", "PAUSED"].includes(s.status)) fail("INVALID_PLAYBACK_TRANSITION");
    const a = await this.d.repositories.assets.find(s.assetId);
    if (!a || a.status !== "READY") fail("MEDIA_ASSET_NOT_FOUND");
    return { playback: await this.d.storage.createPlaybackUrl(a.objectKey) };
  }
}
export class GetContinueWatching extends UseCase {
  async execute(who: Identity, page: number, limit: number) {
    const result = await this.d.repositories.progress.list(who.userId, page, limit, true);
    return {
      ...result,
      data: result.data.map((p) => ({
        tituloId: p.tituloId,
        progress: p.progress,
        lastPlayedAt: p.lastActivityAt,
      })),
    };
  }
}
export class GetPlaybackHistory extends UseCase {
  async execute(who: Identity, page: number, limit: number) {
    const result = await this.d.repositories.progress.list(who.userId, page, limit, false);
    return {
      ...result,
      data: result.data.map((p) => ({
        tituloId: p.tituloId,
        lastPlayedAt: p.lastActivityAt,
        completed: p.status === "COMPLETED",
      })),
    };
  }
}
