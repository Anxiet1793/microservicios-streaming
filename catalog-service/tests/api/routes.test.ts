import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogRepository } from "../../src/modules/catalog/domain/repositories/catalog-repository";
import { TituloId } from "../../src/modules/catalog/domain/value-objects/titulo-id";
import { PersistenceError } from "../../src/shared/infrastructure/mongodb/persistence-error";
import { importMovie, later, movie } from "../helpers/fixtures";
const injected = vi.hoisted(() => ({ cases: {} as unknown, ping: vi.fn() }));
vi.mock("../../src/shared/infrastructure/security/catalog-auth", () => ({
  requireCatalogAdmin: vi.fn().mockResolvedValue(undefined),
}));
afterEach(() => vi.unstubAllEnvs());
vi.mock("../../src/bootstrap/catalog-container", async (original) => ({
  ...(await original<object>()),
  createCatalogUseCases: async () => injected.cases,
}));
vi.mock("../../src/shared/infrastructure/mongodb/connection", async (original) => ({
  ...(await original<object>()),
  pingMongo: injected.ping,
}));
import { composeCatalogUseCases } from "../../src/bootstrap/catalog-container";
import * as list from "../../src/app/api/v1/catalog/route";
import * as detail from "../../src/app/api/v1/catalog/[tituloId]/route";
import * as bulk from "../../src/app/api/v1/catalog/bulk/route";
import * as publication from "../../src/app/api/v1/catalog/[tituloId]/publication-status/route";
import * as health from "../../src/app/api/health/route";

let title = movie();
const repository = {
  findById: vi.fn<CatalogRepository["findById"]>(),
  findPage: vi.fn<CatalogRepository["findPage"]>(),
  insertMany: vi.fn<CatalogRepository["insertMany"]>(),
  saveChanges: vi.fn<CatalogRepository["saveChanges"]>(),
};
type Handler = (r: Request, ctx: { params: Promise<{ tituloId: string }> }) => Promise<Response>;
function call(handler: Handler, method = "GET", body?: unknown, query = "", id = title.tituloId) {
  return handler(
    new Request(`http://catalog.test/api/test${query}`, {
      method,
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: typeof body === "string" ? body : JSON.stringify(body),
          }),
    }),
    { params: Promise.resolve({ tituloId: id }) },
  );
}
beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.stubEnv("MONGODB_URI", "mongodb://127.0.0.1:1");
  vi.stubEnv("BULK_MAX_ITEMS", "3");
  title = movie();
  injected.ping.mockReset().mockResolvedValue(undefined);
  repository.findById.mockReset().mockResolvedValue(title);
  repository.findPage.mockReset().mockResolvedValue({
    data: [title.snapshot()],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  });
  repository.insertMany
    .mockReset()
    .mockImplementation(async (items) =>
      items.map((i) => ({ index: i.index, status: "inserted", tituloId: i.title.tituloId })),
    );
  repository.saveChanges.mockReset().mockResolvedValue(undefined);
  injected.cases = composeCatalogUseCases({
    repository,
    clock: { now: () => later },
    idGenerator: { next: () => TituloId.from(movie().tituloId) },
    maxBulkItems: 3,
  });
});
describe("Actual Catalog HTTP routes with controlled repository boundary", () => {
  it("imports a mixed batch with stable original indices and partial HTTP 207", async () => {
    const response = await call(bulk.POST, "POST", {
      items: [importMovie(), { typeId: "1" }, importMovie("second")],
    });
    expect(response.status).toBe(207);
    const body = await response.json();
    expect(body.summary).toEqual({
      received: 3,
      inserted: 2,
      duplicates: 0,
      failed: 1,
      indeterminate: 0,
    });
    expect(body.results.map((r: { index: number }) => r.index)).toEqual([0, 1, 2]);
  });
  it("accepts the configured maximum exactly and rejects maximum+1 without writes", async () => {
    expect(
      (
        await call(bulk.POST, "POST", {
          items: Array.from({ length: 3 }, (_, n) => importMovie(`key:${n}`)),
        })
      ).status,
    ).toBe(201);
    repository.insertMany.mockClear();
    expect(
      (await call(bulk.POST, "POST", { items: Array.from({ length: 4 }, () => importMovie()) }))
        .status,
    ).toBe(400);
    expect(repository.insertMany).not.toHaveBeenCalled();
  });
  it("does not persist an entirely invalid batch", async () => {
    const response = await call(bulk.POST, "POST", { items: [null, { unknown: true }] });
    expect(response.status).toBe(400);
    expect(repository.insertMany).not.toHaveBeenCalled();
  });
  it("maps duplicate retries, conflicting import keys and uncertain outcomes truthfully", async () => {
    repository.insertMany.mockResolvedValue([
      { index: 0, status: "duplicate", tituloId: title.tituloId },
    ]);
    expect((await call(bulk.POST, "POST", { items: [importMovie()] })).status).toBe(200);
    repository.insertMany.mockResolvedValue([
      { index: 0, status: "rejected", code: "IMPORT_KEY_CONFLICT" },
    ]);
    expect((await call(bulk.POST, "POST", { items: [importMovie()] })).status).toBe(409);
    repository.insertMany.mockResolvedValue([
      { index: 0, status: "indeterminate", code: "PERSISTENCE_OUTCOME_UNKNOWN" },
    ]);
    expect((await call(bulk.POST, "POST", { items: [importMovie()] })).status).toBe(503);
  });
  it("passes filters/search/page through normalization and keeps list metadata minimal", async () => {
    const response = await call(
      list.GET,
      "GET",
      undefined,
      "?page=2&limit=100&type=1&status=2&genre=2&year=2025&q=%C3%93rbita",
    );
    expect(response.status).toBe(200);
    expect(repository.findPage).toHaveBeenCalledWith({
      page: 2,
      limit: 100,
      typeId: 1,
      publicationStatusId: 2,
      genreId: 2,
      year: 2025,
      q: "Órbita",
    });
    const body = await response.json();
    expect(body.data[0]).not.toHaveProperty("playbackReference");
    expect(body.data[0].ficha).not.toHaveProperty("synopsis");
  });
  it("represents an empty catalog without fictional pages or data", async () => {
    repository.findPage.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    expect(await (await call(list.GET)).json()).toEqual({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });
  it.each(["?limit=101", "?page=1&page=2", "?status=99", "?genre[$ne]=1", "?q=" + "x".repeat(101)])(
    "rejects invalid list input %s before persistence",
    async (query) => {
      expect((await call(list.GET, "GET", undefined, query)).status).toBe(400);
      expect(repository.findPage).not.toHaveBeenCalled();
    },
  );
  it("returns a withdrawn title directly, while consumers must decide visibility", async () => {
    repository.findById.mockResolvedValue(
      title.changePublicationStatus(2, later).changePublicationStatus(3, later),
    );
    const response = await call(detail.GET);
    expect(response.status).toBe(200);
    expect((await response.json()).publicationStatusId).toBe(3);
  });
  it("distinguishes invalid identity from a valid identity that does not exist", async () => {
    expect((await call(detail.GET, "GET", undefined, "", "not-public-id")).status).toBe(400);
    repository.findById.mockResolvedValue(null);
    expect((await call(detail.GET)).status).toBe(404);
    expect((await call(detail.PATCH, "PATCH", { ficha: { title: "Updated" } })).status).toBe(404);
  });
  it("updates only editorial fields and rejects protected fields without persisting", async () => {
    const response = await call(detail.PATCH, "PATCH", {
      ficha: { title: "Updated", posterUrl: null },
    });
    expect(response.status).toBe(200);
    expect((await response.json()).ficha.title).toBe("Updated");
    repository.saveChanges.mockClear();
    for (const payload of [
      { typeId: 2 },
      { playbackReference: null },
      { ficha: { publicationStatusId: 2 } },
    ])
      expect((await call(detail.PATCH, "PATCH", payload)).status).toBe(400);
    expect(repository.saveChanges).not.toHaveBeenCalled();
  });
  it("publishes, withdraws and repeats status idempotently without forbidden transitions", async () => {
    expect((await call(publication.PATCH, "PATCH", { publicationStatusId: 2 })).status).toBe(200);
    repository.findById.mockResolvedValue(title.changePublicationStatus(2, later));
    expect((await call(publication.PATCH, "PATCH", { publicationStatusId: 3 })).status).toBe(200);
    repository.findById.mockResolvedValue(
      title.changePublicationStatus(2, later).changePublicationStatus(3, later),
    );
    repository.saveChanges.mockClear();
    expect((await call(publication.PATCH, "PATCH", { publicationStatusId: 3 })).status).toBe(200);
    expect(repository.saveChanges).not.toHaveBeenCalled();
    expect((await call(publication.PATCH, "PATCH", { publicationStatusId: 2 })).status).toBe(422);
  });
  it("health and queries fail safely when persistence is unavailable", async () => {
    expect((await call(health.GET)).status).toBe(200);
    injected.ping.mockRejectedValue(new PersistenceError("DATABASE_UNAVAILABLE"));
    expect((await call(health.GET)).status).toBe(503);
    repository.findPage.mockRejectedValue(new PersistenceError("PERSISTENCE_READ_FAILED"));
    const response = await call(list.GET);
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("DATABASE_UNAVAILABLE");
  });
  it("rejects malformed JSON and provides method metadata without leaking internals", async () => {
    expect((await call(bulk.POST, "POST", "{")).status).toBe(400);
    const response = await call(list.POST, "POST");
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toContain("GET");
    expect((await call(list.OPTIONS, "OPTIONS")).status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });
});
