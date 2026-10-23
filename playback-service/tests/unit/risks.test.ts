import { expect, it, vi } from "vitest";
import { PlaybackSession, progress, type Status } from "../../src/modules/playback/domain/model";
import * as U from "../../src/modules/playback/application/use-cases";
import { admin, asset, fixture, tituloId, user } from "../helpers";

it.each([0, -1, NaN, Infinity])("rejects invalid persisted duration %s", (duration) => {
  expect(() => progress(0, duration, new Date())).toThrow("VALIDATION_ERROR");
});
it.each([25, 50, 75, 89.99, 90, 100])(
  "computes exact percentage %s and continue-watching threshold",
  async (percentage) => {
    const f = fixture(),
      started = await new U.StartPlaybackSession(f.d).execute(user, tituloId);
    const result = await new U.UpdatePlaybackProgress(f.d).execute(
      user,
      started.session.sessionId,
      (120 * percentage) / 100,
    );
    expect(result.session.progress.percentage).toBe(percentage);
    expect((await new U.GetContinueWatching(f.d).execute(user, 1, 20)).data.length).toBe(
      percentage < 90 ? 1 : 0,
    );
  },
);
it("does not re-emit earlier milestones after a deliberate backward seek", async () => {
  const f = fixture(),
    started = await new U.StartPlaybackSession(f.d).execute(user, tituloId);
  for (const position of [90, 10, 30, 60, 90])
    await new U.UpdatePlaybackProgress(f.d).execute(user, started.session.sessionId, position);
  expect(f.events.filter((e) => e.eventType === "PLAYBACK_PROGRESS_UPDATED")).toHaveLength(1);
  expect(
    (await f.d.repositories.progress.find(user.userId, tituloId))?.progress.positionSeconds,
  ).toBe(90);
});
it("refuses start when media bytes or the storage signing operation is unavailable", async () => {
  const f = fixture();
  f.d.storage.exists = async () => false;
  await expect(new U.StartPlaybackSession(f.d).execute(user, tituloId)).rejects.toThrow(
    "STORAGE_UNAVAILABLE",
  );
  expect(f.sessions.size).toBe(0);
  expect(f.events).toEqual([]);
  f.d.storage.exists = async () => true;
  f.d.storage.createPlaybackUrl = async () => {
    throw new Error("STORAGE_UNAVAILABLE");
  };
  await expect(new U.StartPlaybackSession(f.d).execute(user, tituloId)).rejects.toThrow(
    "STORAGE_UNAVAILABLE",
  );
  expect(f.sessions.size).toBe(0);
});
it("compensates successful storage upload when metadata insertion fails", async () => {
  const f = fixture(),
    upload = vi.spyOn(f.d.storage, "upload"),
    cleanup = vi.spyOn(f.d.storage, "delete");
  f.d.repositories.assets.insert = async () => {
    throw new Error("metadata unavailable");
  };
  await expect(
    new U.UploadMediaAsset(f.d).execute(admin, {
      path: "test-only",
      filename: "owned.mp4",
      sizeBytes: 128,
      durationSeconds: 60,
      codec: "h264",
      width: 320,
      height: 240,
    }),
  ).rejects.toThrow("metadata unavailable");
  expect(upload).toHaveBeenCalledTimes(1);
  expect(cleanup).toHaveBeenCalledWith(upload.mock.calls[0]![0]);
});
it("does not report successful upload when compensation also fails", async () => {
  const f = fixture();
  f.d.repositories.assets.insert = async () => {
    throw new Error("metadata unavailable");
  };
  f.d.storage.delete = async () => {
    throw new Error("cleanup unavailable");
  };
  await expect(
    new U.UploadMediaAsset(f.d).execute(admin, {
      path: "test-only",
      filename: "owned.mp4",
      sizeBytes: 128,
      durationSeconds: 60,
      codec: "h264",
      width: 320,
      height: 240,
    }),
  ).rejects.toThrow("metadata unavailable");
});
it("requires ADMIN before upload/storage writes and hides temporary paths in asset DTO", async () => {
  const f = fixture(),
    write = vi.spyOn(f.d.storage, "upload"),
    file = {
      path: "private-temp-path",
      filename: "owned.mp4",
      sizeBytes: 128,
      durationSeconds: 60,
      codec: "h264",
      width: 320,
      height: 240,
    };
  await expect(new U.UploadMediaAsset(f.d).execute(user, file)).rejects.toThrow("FORBIDDEN");
  expect(write).not.toHaveBeenCalled();
  const result = await new U.UploadMediaAsset(f.d).execute(admin, file);
  expect(result.asset.status).toBe("READY");
  expect(JSON.stringify(result)).not.toContain(file.path);
  expect(result.asset).not.toHaveProperty("objectKey");
});
it("does not leak assets or sessions that do not exist", async () => {
  const f = fixture();
  await expect(new U.GetMediaAsset(f.d).execute(admin, "missing")).rejects.toThrow(
    "MEDIA_ASSET_NOT_FOUND",
  );
  await expect(new U.DeleteMediaAsset(f.d).execute(admin, "missing")).rejects.toThrow(
    "MEDIA_ASSET_NOT_FOUND",
  );
  await expect(new U.UpdatePlaybackProgress(f.d).execute(user, "missing", 10)).rejects.toThrow(
    "PLAYBACK_SESSION_NOT_FOUND",
  );
});
it("keeps logical deletion idempotent and blocks signing an unavailable asset", async () => {
  const f = fixture(),
    started = await new U.StartPlaybackSession(f.d).execute(user, tituloId);
  f.assets.get(asset.assetId)!.status = "DELETED";
  await expect(new U.ResumePlayback(f.d).execute(user, started.session.sessionId)).rejects.toThrow(
    "MEDIA_ASSET_NOT_FOUND",
  );
  await expect(
    new U.RefreshPlaybackUrl(f.d).execute(user, started.session.sessionId),
  ).rejects.toThrow("MEDIA_ASSET_NOT_FOUND");
  await expect(new U.DeleteMediaAsset(f.d).execute(admin, asset.assetId)).resolves.toBeUndefined();
});
it("evaluates every state pair against the documented transition table", async () => {
  const f = fixture(),
    result = await new U.StartPlaybackSession(f.d).execute(user, tituloId),
    original = f.sessions.get(result.session.sessionId)!;
  const allowed: Record<Status, Status[]> = {
    REQUESTED: ["ACTIVE"],
    ACTIVE: ["PAUSED", "COMPLETED", "FAILED"],
    PAUSED: ["ACTIVE", "COMPLETED"],
    COMPLETED: [],
    FAILED: [],
  };
  for (const from of Object.keys(allowed) as Status[])
    for (const to of Object.keys(allowed) as Status[]) {
      const transition = () =>
        new PlaybackSession({ ...original, status: from }).transition(to, new Date());
      if (allowed[from].includes(to)) expect(transition().status).toBe(to);
      else expect(transition).toThrow("INVALID_PLAYBACK_TRANSITION");
    }
});
