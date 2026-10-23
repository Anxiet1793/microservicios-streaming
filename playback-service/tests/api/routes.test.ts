import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { PlaybackError } from "../../src/modules/playback/domain/model";
import { admin, asset, fixture, tituloId, user } from "../helpers";
import { storageConfig } from "../support/containers";
const injected = vi.hoisted(() => ({ value: {} as unknown, failure: false, limit: vi.fn() }));
vi.mock("../../src/bootstrap/container", () => ({
  container: () => {
    if (injected.failure) throw new Error("private configuration detail");
    return injected.value;
  },
}));
vi.mock("../../src/modules/playback/infrastructure/adapters", async (original) => ({
  ...(await original<object>()),
  rateLimit: injected.limit,
}));
import * as upload from "../../src/app/api/v1/media/assets/route";
import * as media from "../../src/app/api/v1/media/assets/[assetId]/route";
import * as start from "../../src/app/api/v1/playback/sessions/route";
import * as update from "../../src/app/api/v1/playback/sessions/[sessionId]/progress/route";
import * as pause from "../../src/app/api/v1/playback/sessions/[sessionId]/pause/route";
import * as resume from "../../src/app/api/v1/playback/sessions/[sessionId]/resume/route";
import * as complete from "../../src/app/api/v1/playback/sessions/[sessionId]/complete/route";
import * as refresh from "../../src/app/api/v1/playback/sessions/[sessionId]/refresh-url/route";
import * as continuing from "../../src/app/api/v1/playback/me/continue-watching/route";
import * as history from "../../src/app/api/v1/playback/me/history/route";
import * as health from "../../src/app/api/health/route";

type Handler = (r: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
let f = fixture(),
  who: typeof user | typeof admin = user;
const storageHealth = vi.fn(),
  mongoHealth = vi.fn();
function call(
  handler: Handler,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = { Authorization: "Bearer test-identity" },
  params: Record<string, string> = { assetId: asset.assetId },
  query = "",
) {
  return handler(
    new Request(`http://localhost:3002/api/test${query}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      ...(body === undefined
        ? {}
        : {
            body:
              body instanceof FormData
                ? body
                : typeof body === "string"
                  ? body
                  : JSON.stringify(body),
          }),
    }),
    { params: Promise.resolve(params) },
  );
}
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  f = fixture();
  who = user;
  injected.failure = false;
  injected.limit.mockReset().mockResolvedValue(undefined);
  storageHealth.mockReset().mockResolvedValue(true);
  mongoHealth.mockReset().mockResolvedValue({ ok: 1 });
  injected.value = {
    config: storageConfig(),
    dependencies: f.d,
    db: { command: mongoHealth },
    storage: { health: storageHealth },
    auth: {
      verify: async (r: Request) => {
        if (!r.headers.get("authorization")) throw new PlaybackError("UNAUTHORIZED");
        return who;
      },
    },
  };
});
describe("Actual Playback Route Handlers with controlled identity/repository ports", () => {
  it.each([
    start.POST,
    update.PATCH,
    pause.POST,
    resume.POST,
    complete.POST,
    refresh.POST,
    continuing.GET,
    history.GET,
    media.GET,
    media.DELETE,
    upload.POST,
  ])("requires identity before personal or ADMIN operations", async (handler) => {
    expect((await call(handler, "POST", undefined, {})).status).toBe(401);
  });
  it("returns real session DTOs through start/progress/pause/resume/complete and history", async () => {
    const response = await call(start.POST, "POST", { tituloId });
    expect(response.status).toBe(201);
    const initial = await response.json();
    const params = { sessionId: initial.session.sessionId };
    expect(
      (await call(update.PATCH, "PATCH", { positionSeconds: 30 }, undefined, params)).status,
    ).toBe(200);
    expect(
      (await call(pause.POST, "POST", { positionSeconds: 30 }, undefined, params)).status,
    ).toBe(200);
    expect((await call(resume.POST, "POST", undefined, undefined, params)).status).toBe(200);
    expect((await call(refresh.POST, "POST", undefined, undefined, params)).status).toBe(200);
    expect((await (await call(continuing.GET)).json()).data[0].progress.positionSeconds).toBe(30);
    expect((await call(complete.POST, "POST", undefined, undefined, params)).status).toBe(200);
    expect((await (await call(history.GET)).json()).data[0].completed).toBe(true);
  });
  it("rejects caller identity injection, invalid positions and malformed route IDs", async () => {
    expect((await call(start.POST, "POST", { tituloId, userId: admin.userId })).status).toBe(400);
    const response = await call(start.POST, "POST", { tituloId });
    const params = { sessionId: (await response.json()).session.sessionId };
    for (const positionSeconds of [-1, 999])
      expect(
        (await call(update.PATCH, "PATCH", { positionSeconds }, undefined, params)).status,
      ).toBe(400);
    expect(
      (await call(update.PATCH, "PATCH", { positionSeconds: 1 }, undefined, { sessionId: "bad" }))
        .status,
    ).toBe(400);
    expect((await call(continuing.GET, "GET", undefined, undefined, {}, "?limit=101")).status).toBe(
      400,
    );
  });
  it("does not grant ADMIN ownership over another user's session", async () => {
    const response = await call(start.POST, "POST", { tituloId }),
      params = { sessionId: (await response.json()).session.sessionId };
    who = admin;
    expect(
      (await call(update.PATCH, "PATCH", { positionSeconds: 10 }, undefined, params)).status,
    ).toBe(403);
    expect((await call(refresh.POST, "POST", undefined, undefined, params)).status).toBe(403);
  });
  it("rejects USER asset access and permits ADMIN metadata and soft delete", async () => {
    for (const handler of [upload.POST, media.GET, media.DELETE])
      expect((await call(handler, "POST")).status).toBe(403);
    who = admin;
    const response = await call(media.GET);
    expect(response.status).toBe(200);
    expect((await response.json()).asset).not.toHaveProperty("objectKey");
    expect(
      (await call(media.GET, "GET", undefined, undefined, { assetId: `ast_${randomUUID()}` }))
        .status,
    ).toBe(404);
    expect((await call(media.DELETE, "DELETE")).status).toBe(204);
  });
  it("maps missing/unpublished/catalog-down/storage-down start failures safely", async () => {
    f.d.catalog.get = async () => {
      throw new PlaybackError("TITLE_NOT_FOUND");
    };
    expect((await call(start.POST, "POST", { tituloId })).status).toBe(404);
    f.d.catalog.get = async () => ({ published: false, assetId: asset.assetId });
    expect((await call(start.POST, "POST", { tituloId })).status).toBe(409);
    f.d.catalog.get = async () => {
      throw new PlaybackError("CATALOG_SERVICE_UNAVAILABLE");
    };
    expect((await call(start.POST, "POST", { tituloId })).status).toBe(503);
    f.d.catalog.get = async () => ({ published: true, assetId: asset.assetId });
    f.d.storage.exists = async () => false;
    expect((await call(start.POST, "POST", { tituloId })).status).toBe(503);
  });
  it("validates the real multipart parser before attempting storage", async () => {
    who = admin;
    expect(
      (
        await call(upload.POST, "POST", "{}", {
          "Content-Type": "text/plain",
          Authorization: "Bearer test",
        })
      ).status,
    ).toBe(415);
    const body = new FormData();
    body.append("file", new Blob(["not video"], { type: "text/plain" }), "invalid.txt");
    const request = new Request("http://localhost:3002/api/v1/media/assets", {
      method: "POST",
      headers: { Authorization: "Bearer test" },
      body,
    });
    expect((await upload.POST(request, { params: Promise.resolve({}) })).status).toBe(415);
  });
  it("sets CORS only for the allowed origin and returns retry metadata on quota exhaustion", async () => {
    expect(
      (await call(history.GET, "GET", undefined, { Origin: "https://attacker.test" })).status,
    ).toBe(403);
    injected.limit.mockRejectedValue(new PlaybackError("RATE_LIMITED"));
    const response = await call(history.GET, "GET", undefined, {
      Authorization: "Bearer test",
      Origin: "http://localhost:3002",
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3002");
    expect((await call(start.OPTIONS, "OPTIONS")).status).toBe(204);
  });
  it("health reports each actual dependency outcome without credentials", async () => {
    expect((await call(health.GET)).status).toBe(200);
    storageHealth.mockResolvedValue(false);
    expect((await call(health.GET)).status).toBe(503);
    storageHealth.mockResolvedValue(true);
    mongoHealth.mockRejectedValue(new Error("private database"));
    expect((await call(health.GET)).status).toBe(503);
  });
  it("returns a safe JSON failure even when container configuration cannot be constructed", async () => {
    injected.failure = true;
    const response = await call(health.GET);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private configuration detail");
  });
});
