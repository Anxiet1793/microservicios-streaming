import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MinioMediaStorage } from "../../src/modules/playback/infrastructure/adapters";
import { ownedMinio } from "../support/containers";

let owned: Awaited<ReturnType<typeof ownedMinio>>, storage: MinioMediaStorage;
beforeAll(async () => {
  owned = await ownedMinio();
  storage = new MinioMediaStorage(owned.config);
  await storage.initialize();
});
beforeEach(async () => {
  const path = join(owned.directory, "fixture.mp4");
  await writeFile(path, Buffer.alloc(128, 42));
  await storage.upload("videos/test.mp4", path, 128);
});
afterAll(async () => {
  await owned?.close();
});
it("initializes a private bucket repeatedly, stores exact bytes and supports signed Range", async () => {
  await storage.initialize();
  expect(await storage.health()).toBe(true);
  const path = join(owned.directory, "media.mp4"),
    bytes = Buffer.alloc(128, 42);
  await writeFile(path, bytes);
  await storage.upload("videos/test.mp4", path, bytes.length);
  expect(await storage.exists("videos/test.mp4")).toBe(true);
  const signed = await storage.createPlaybackUrl("videos/test.mp4");
  const response = await fetch(signed.url, { headers: { Range: "bytes=0-31" } });
  expect(response.status).toBe(206);
  expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes.subarray(0, 32));
  const unsigned = new URL(signed.url);
  unsigned.search = "";
  expect((await fetch(unsigned)).status).toBe(403);
});
it("rejects expired signed URLs and recognizes an object that has been removed", async () => {
  const expired = await storage.client.presignedGetObject(
    owned.config.MINIO_BUCKET,
    "videos/test.mp4",
    60,
    {},
    new Date(Date.now() - 120000),
  );
  expect((await fetch(expired)).status).toBe(403);
  await storage.delete("videos/test.mp4");
  expect(await storage.exists("videos/test.mp4")).toBe(false);
});
it("does not treat denied storage credentials as a missing object", async () => {
  const denied = new MinioMediaStorage({
    ...owned.config,
    MINIO_SECRET_KEY: "invalid-secret-for-owned-test",
  });
  await expect(denied.exists("videos/test.mp4")).rejects.toThrow("STORAGE_UNAVAILABLE");
  await expect(denied.delete("videos/test.mp4")).rejects.toThrow("STORAGE_UNAVAILABLE");
});
