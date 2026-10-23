import { describe, it, expect } from "vitest";
import { PlaybackQueue } from "../../src/features/playback/queue";
import { safeReturn, time } from "../../src/lib/models";
describe("ordered playback writes", () => {
  it("coalesces pending positions without removing intentional backward seeks", async () => {
    const q = new PlaybackQueue(),
      sent: number[] = [];
    let release = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const first = q.run(() => gate);
    const p = q.progress(20, async (n) => {
      sent.push(n);
    });
    void q.progress(30, async (n) => {
      sent.push(n);
    });
    void q.progress(12, async (n) => {
      sent.push(n);
    });
    release();
    await first;
    await p;
    expect(sent).toEqual([12]);
  });
  it("finishes progress before pause and completion", async () => {
    const q = new PlaybackQueue(),
      events: string[] = [];
    await Promise.all([
      q.progress(25, async () => {
        events.push("progress");
      }),
      q.run(async () => {
        events.push("pause");
      }),
      q.run(async () => {
        events.push("complete");
      }),
    ]);
    expect(events).toEqual(["progress", "pause", "complete"]);
  });
  it("does not permanently block the queue after a network error", async () => {
    const q = new PlaybackQueue();
    await expect(
      q.run(async () => {
        throw new Error("network");
      }),
    ).rejects.toThrow();
    await expect(q.run(async () => "recovered")).resolves.toBe("recovered");
  });
  it("stops future writes when superseded", async () => {
    const q = new PlaybackQueue();
    q.stop();
    await expect(q.run(async () => "must not run")).rejects.toThrow("PLAYER_STOPPED");
  });
});
describe("navigation and display boundaries", () => {
  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil",
    "/api/bff/admin",
    "/login?next=https://evil.example",
  ])("rejects unsafe return %s", (v) => expect(safeReturn(v)).toBe("/home"));
  it("preserves local title return", () =>
    expect(safeReturn("/title/ttl_demo")).toBe("/title/ttl_demo"));
  it.each([
    [NaN, "0:00"],
    [-3, "0:00"],
    [65.8, "1:05"],
  ])("formats %s safely", (value, label) => expect(time(value as number)).toBe(label));
});
