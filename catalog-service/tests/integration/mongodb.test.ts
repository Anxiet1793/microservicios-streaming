import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { MongoClient } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { initializeCatalog } from "../../src/modules/catalog/infrastructure/persistence/mongodb/initialize-catalog";
import { MongoCatalogRepository } from "../../src/modules/catalog/infrastructure/persistence/mongodb/repositories/mongo-catalog-repository";
import { TituloId } from "../../src/modules/catalog/domain/value-objects/titulo-id";
import { later, movie, movieInput } from "../helpers/fixtures";

const exec = promisify(execFile);
const container = `catalog-vitest-${randomUUID()}`;
let client: MongoClient | undefined;
let repository: MongoCatalogRepository;
let started = false;

// Nunca lee MONGODB_URI/.env ni borra una base ajena: el contenedor es propio.
beforeAll(async () => {
  await exec(
    "docker",
    [
      "run",
      "--detach",
      "--rm",
      "--name",
      container,
      "--publish",
      "127.0.0.1::27017",
      "mongo:8.0",
      "--bind_ip_all",
    ],
    { timeout: 240_000, windowsHide: true },
  );
  started = true;
  const { stdout } = await exec("docker", ["port", container, "27017/tcp"], { windowsHide: true });
  const port = /^127\.0\.0\.1:(\d+)\s*$/.exec(stdout)?.[1];
  if (!port) throw new Error("No se obtuvo el puerto local de MongoDB de pruebas.");
  client = new MongoClient(`mongodb://127.0.0.1:${port}`, { serverSelectionTimeoutMS: 30_000 });
  await client.connect();
  await initializeCatalog(client.db("catalog_test"));
  repository = new MongoCatalogRepository(client.db("catalog_test"));
});
afterAll(async () => {
  try {
    await client?.close();
  } finally {
    if (started) await exec("docker", ["rm", "--force", container], { windowsHide: true });
  }
});
beforeEach(async () => {
  await client!.db("catalog_test").collection("catalog_titles").deleteMany({});
});

describe("MongoCatalogRepository con MongoDB real aislado", () => {
  it("inicializa validadores e índices de forma idempotente", async () => {
    const db = client!.db("catalog_test");
    const before = await db.collection("catalog_titles").listIndexes().toArray();
    await initializeCatalog(db);
    expect(await db.collection("catalog_titles").listIndexes().toArray()).toEqual(before);
    expect(before).toHaveLength(8);
    expect(await db.collection("catalog_episodes").listIndexes().toArray()).toHaveLength(3);
    await expect(
      db.collection("catalog_titles").insertOne({ tituloId: "bad" }),
    ).rejects.toMatchObject({ code: 121 });
  });

  it("inserta y recupera un agregado sin cambiar su identidad", async () => {
    const title = movie();
    expect(await repository.insertMany([{ index: 0, importKey: "test:one", title }])).toEqual([
      { index: 0, status: "inserted", tituloId: title.tituloId },
    ]);
    expect((await repository.findById(TituloId.from(title.tituloId)))?.snapshot()).toEqual(
      title.snapshot(),
    );
    expect(await repository.findById(TituloId.from(movie().tituloId))).toBeNull();
  });

  it("reconoce reintentos y no sobrescribe contenido por conflicto de importKey", async () => {
    const title = movie();
    await repository.insertMany([{ index: 0, importKey: "test:one", title }]);
    const same = movie({ ficha: { ...movieInput().ficha, genres: [2, 1], languages: [2, 1] } });
    expect(await repository.insertMany([{ index: 3, importKey: "test:one", title: same }])).toEqual(
      [{ index: 3, status: "duplicate", tituloId: title.tituloId }],
    );
    const changed = movie({ ficha: { ...movieInput().ficha, title: "Distinto" } });
    expect(
      await repository.insertMany([{ index: 4, importKey: "test:one", title: changed }]),
    ).toEqual([{ index: 4, status: "rejected", code: "IMPORT_KEY_CONFLICT" }]);
    expect((await repository.findById(TituloId.from(title.tituloId)))?.snapshot().ficha.title).toBe(
      title.snapshot().ficha.title,
    );
  });

  it("reconcilia dos importaciones concurrentes con una sola inserción", async () => {
    const results = (
      await Promise.all(
        [0, 1].map((index) =>
          repository.insertMany([{ index, importKey: "test:race", title: movie() }]),
        ),
      )
    ).flat();
    expect(results.map((item) => item.status).sort()).toEqual(["duplicate", "inserted"]);
    expect(await client!.db("catalog_test").collection("catalog_titles").countDocuments()).toBe(1);
  });

  it("resuelve repetidos del lote y rechaza grupos con contenido contradictorio", async () => {
    const results = await repository.insertMany([
      { index: 0, importKey: "same", title: movie() },
      { index: 1, importKey: "same", title: movie() },
      { index: 2, importKey: "conflict", title: movie() },
      {
        index: 3,
        importKey: "conflict",
        title: movie({ ficha: { ...movieInput().ficha, title: "Otro" } }),
      },
    ]);
    expect(results.map((item) => item.status)).toEqual([
      "inserted",
      "duplicate",
      "rejected",
      "rejected",
    ]);
  });

  it("aplica PATCH real y rechaza una escritura con versión obsoleta", async () => {
    const title = movie();
    await repository.insertMany([{ index: 0, importKey: "test:patch", title }]);
    const updated = title.updateFicha({ title: "Revisado", posterUrl: null }, later);
    await repository.saveChanges(title, updated);
    expect((await repository.findById(TituloId.from(title.tituloId)))?.snapshot()).toEqual(
      updated.snapshot(),
    );
    await expect(
      repository.saveChanges(title, title.changePublicationStatus(2, later)),
    ).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
    expect(
      (await repository.insertMany([{ index: 0, importKey: "test:patch", title }]))[0]?.status,
    ).toBe("duplicate");
  });

  it("filtra por texto/categorías y limita la proyección paginada", async () => {
    await repository.insertMany([
      { index: 0, importKey: "first", title: movie() },
      { index: 1, importKey: "second", title: movie() },
    ]);
    const page = await repository.findPage({
      page: 1,
      limit: 1,
      q: "Órbita",
      typeId: 1,
      publicationStatusId: 1,
      genreId: 1,
      year: 2025,
    });
    expect(page.pagination).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect(page.data).toHaveLength(1);
    expect(page.data[0]?.ficha).not.toHaveProperty("synopsis");
    expect(page.data[0]).not.toHaveProperty("playbackReference");
  });
});
