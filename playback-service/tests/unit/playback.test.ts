import { describe, expect, it, vi } from "vitest";
import { PlaybackSession, progress, type Status } from "../../src/modules/playback/domain/model";
import * as U from "../../src/modules/playback/application/use-cases";
import { admin, asset, fixture, tituloId, user } from "../helpers";

describe("Progress", () => {
  it.each([-1, NaN, Infinity, 123])("rejects invalid position %s", (value) =>
    expect(() => progress(value, 120, new Date())).toThrow("VALIDATION_ERROR"),
  );
  it("computes percentage and bounds tolerated overrun", () => {
    expect(progress(30, 120, new Date()).percentage).toBe(25);
    expect(progress(121, 120, new Date()).positionSeconds).toBe(120);
  });
});
describe("Playback aggregate and use cases", () => {
  it("starts ACTIVE and creates one event", async () => {
    const f = fixture();
    const s = await new U.StartPlaybackSession(f.d).execute(user, tituloId);
    expect(s.session.status).toBe("ACTIVE");
    expect(f.events[0]?.eventType).toBe("PLAYBACK_STARTED");
    expect(s.playback.expiresIn).toBe(900);
  });
  it.each<[Status, Status]>([
    ["REQUESTED", "ACTIVE"],
    ["ACTIVE", "PAUSED"],
    ["ACTIVE", "COMPLETED"],
    ["ACTIVE", "FAILED"],
    ["PAUSED", "ACTIVE"],
    ["PAUSED", "COMPLETED"],
  ])("allows %s -> %s", async (from, to) => {
    const f = fixture();
    const { session } = await new U.StartPlaybackSession(f.d).execute(user, tituloId);
    const state = f.sessions.get(session.sessionId)!;
    expect(new PlaybackSession({ ...state, status: from }).transition(to, new Date()).status).toBe(
      to,
    );
  });
  it.each<[Status, Status]>([
    ["COMPLETED", "ACTIVE"],
    ["FAILED", "ACTIVE"],
    ["REQUESTED", "COMPLETED"],
    ["PAUSED", "FAILED"],
  ])("rejects %s -> %s", async (from, to) => {
    const f = fixture();
    const { session } = await new U.StartPlaybackSession(f.d).execute(user, tituloId);
    expect(() =>
      new PlaybackSession({ ...f.sessions.get(session.sessionId)!, status: from }).transition(
        to,
        new Date(),
      ),
    ).toThrow("INVALID_PLAYBACK_TRANSITION");
  });
  it("rejects unpublished title", async () => {
    const f = fixture();
    f.d.catalog.get = async () => ({ published: false, assetId: asset.assetId });
    await expect(new U.StartPlaybackSession(f.d).execute(user, tituloId)).rejects.toThrow(
      "TITLE_NOT_PUBLISHED",
    );
    expect(f.sessions.size).toBe(0);
  });
  it("rejects missing asset", async () => {
    const f = fixture();
    f.assets.clear();
    await expect(new U.StartPlaybackSession(f.d).execute(user, tituloId)).rejects.toThrow(
      "MEDIA_ASSET_NOT_FOUND",
    );
  });
  it("enforces ownership for progress and URL refresh", async () => {
    const f = fixture();
    const { session } = await new U.StartPlaybackSession(f.d).execute(user, tituloId);
    await expect(
      new U.UpdatePlaybackProgress(f.d).execute(admin, session.sessionId, 10),
    ).rejects.toThrow("FORBIDDEN");
    await expect(new U.RefreshPlaybackUrl(f.d).execute(admin, session.sessionId)).rejects.toThrow(
      "FORBIDDEN",
    );
  });
  it("updates idempotently and emits only milestones", async () => {
    const f = fixture();
    const { session } = await new U.StartPlaybackSession(f.d).execute(user, tituloId);
    for (const n of [5, 10, 30, 30, 35])
      await new U.UpdatePlaybackProgress(f.d).execute(user, session.sessionId, n);
    expect(f.events.map((e) => e.eventType)).toEqual([
      "PLAYBACK_STARTED",
      "PLAYBACK_PROGRESS_UPDATED",
    ]);
    expect(f.events[1]?.data.watchTimeSeconds).toBeNull();
  });
  it("pauses, resumes and completes once; restart starts at zero", async () => {
    const f = fixture();
    const { session } = await new U.StartPlaybackSession(f.d).execute(user, tituloId);
    await new U.PausePlayback(f.d).execute(user, session.sessionId, 30);
    expect((await new U.ResumePlayback(f.d).execute(user, session.sessionId)).session.status).toBe(
      "ACTIVE",
    );
    await new U.CompletePlayback(f.d).execute(user, session.sessionId);
    await new U.CompletePlayback(f.d).execute(user, session.sessionId);
    expect(f.events.filter((e) => e.eventType === "PLAYBACK_COMPLETED")).toHaveLength(1);
    expect((await new U.GetContinueWatching(f.d).execute(user, 1, 20)).data).toHaveLength(0);
    expect(
      (await new U.StartPlaybackSession(f.d).execute(user, tituloId)).session.progress
        .positionSeconds,
    ).toBe(0);
  });
  it("continues at persisted position and supersedes old session", async () => {
    const f = fixture();
    const first = await new U.StartPlaybackSession(f.d).execute(user, tituloId);
    await new U.UpdatePlaybackProgress(f.d).execute(user, first.session.sessionId, 30);
    const next = await new U.StartPlaybackSession(f.d).execute(user, tituloId);
    expect(next.session.progress.positionSeconds).toBe(30);
    await expect(
      new U.UpdatePlaybackProgress(f.d).execute(user, first.session.sessionId, 45),
    ).rejects.toThrow("SESSION_SUPERSEDED");
  });
  it("excludes >=90 percent and isolates history", async () => {
    const f = fixture();
    const { session } = await new U.StartPlaybackSession(f.d).execute(user, tituloId);
    await new U.UpdatePlaybackProgress(f.d).execute(user, session.sessionId, 110);
    expect((await new U.GetContinueWatching(f.d).execute(user, 1, 20)).data).toHaveLength(0);
    expect((await new U.GetPlaybackHistory(f.d).execute(admin, 1, 20)).data).toHaveLength(0);
  });
  it("protects assets in use and requires admin", async () => {
    const f = fixture();
    await expect(new U.DeleteMediaAsset(f.d).execute(user, asset.assetId)).rejects.toThrow(
      "FORBIDDEN",
    );
    await new U.StartPlaybackSession(f.d).execute(user, tituloId);
    await expect(new U.DeleteMediaAsset(f.d).execute(admin, asset.assetId)).rejects.toThrow(
      "MEDIA_ASSET_IN_USE",
    );
  });
  it("logical deletion retains bytes and prevents new sessions", async () => {
    const f = fixture();
    const remove = vi.spyOn(f.d.storage, "delete");
    await new U.DeleteMediaAsset(f.d).execute(admin, asset.assetId);
    expect(remove).not.toHaveBeenCalled();
    await expect(new U.StartPlaybackSession(f.d).execute(user, tituloId)).rejects.toThrow(
      "MEDIA_ASSET_NOT_FOUND",
    );
  });
  it("supersedes a paused session without introducing a forbidden state transition", async () => {
    const f = fixture();
    const first = await new U.StartPlaybackSession(f.d).execute(user, tituloId);
    await new U.PausePlayback(f.d).execute(user, first.session.sessionId, 30);
    await new U.StartPlaybackSession(f.d).execute(user, tituloId);
    const previous = f.sessions.get(first.session.sessionId)!;
    expect(previous.status).toBe("PAUSED");
    expect(previous.supersededAt).toBeInstanceOf(Date);
    expect(() => new PlaybackSession(previous).transition("ACTIVE", new Date())).toThrow(
      "SESSION_SUPERSEDED",
    );
    await expect(
      new U.RefreshPlaybackUrl(f.d).execute(user, first.session.sessionId),
    ).rejects.toThrow("SESSION_SUPERSEDED");
  });
});
