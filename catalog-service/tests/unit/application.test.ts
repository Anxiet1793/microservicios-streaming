import { beforeEach, describe, expect, it, vi } from "vitest";
import { composeCatalogUseCases } from "../../src/bootstrap/catalog-container";
import { CatalogError } from "../../src/modules/catalog/domain/errors/catalog-error";
import type { CatalogRepository } from "../../src/modules/catalog/domain/repositories/catalog-repository";
import { TituloId } from "../../src/modules/catalog/domain/value-objects/titulo-id";
import { importMovie, later, movie } from "../helpers/fixtures";

function setup() {
  const title = movie();
  const repository = {
    findById: vi.fn<CatalogRepository["findById"]>().mockResolvedValue(title),
    findPage: vi.fn<CatalogRepository["findPage"]>().mockResolvedValue({
      data: [title.snapshot()],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }),
    insertMany: vi.fn<CatalogRepository["insertMany"]>().mockImplementation(async (items) =>
      items.map((item) => ({
        index: item.index,
        status: "inserted",
        tituloId: item.title.tituloId,
      })),
    ),
    saveChanges: vi.fn<CatalogRepository["saveChanges"]>().mockResolvedValue(undefined),
  };
  const cases = composeCatalogUseCases({
    repository,
    clock: { now: () => later },
    idGenerator: { next: () => TituloId.from(movie().tituloId) },
    maxBulkItems: 5,
  });
  return { title, repository, cases };
}

describe("Casos de uso sin conexiones externas", () => {
  let context: ReturnType<typeof setup>;
  beforeEach(() => {
    context = setup();
  });

  it("busca por TituloId y entrega equivalencias sin metadatos internos", async () => {
    const { cases, title, repository } = context;
    const result = await cases.getCatalogTitleById.execute({ tituloId: title.tituloId });
    expect(repository.findById.mock.calls[0]?.[0].value).toBe(title.tituloId);
    expect(result).toMatchObject({
      typeName: "MOVIE",
      publicationStatusName: "REGISTRADO",
      playbackReference: { providerName: "CDN" },
    });
    for (const field of ["_id", "version", "importKey", "schemaVersion", "importFingerprint"])
      expect(result).not.toHaveProperty(field);
  });

  it("distingue inexistencia de identidad inválida", async () => {
    const { cases, title, repository } = context;
    repository.findById.mockResolvedValue(null);
    await expect(
      cases.getCatalogTitleById.execute({ tituloId: title.tituloId }),
    ).rejects.toMatchObject({ code: "CATALOG_TITLE_NOT_FOUND" });
    await expect(cases.getCatalogTitleById.execute({ tituloId: "bad" })).rejects.toMatchObject({
      code: "INVALID_TITLE_ID",
    });
    expect(repository.findById).toHaveBeenCalledTimes(1);
  });

  it("filtra y pagina sin exponer ficha completa ni referencia técnica", async () => {
    const { cases, repository } = context;
    const result = await cases.getCatalogTitles.execute({ q: " Órbita " });
    expect(repository.findPage).toHaveBeenCalledWith({ page: 1, limit: 20, q: "Órbita" });
    expect(result.data[0]).not.toHaveProperty("playbackReference");
    expect(result.data[0]?.ficha).not.toHaveProperty("synopsis");
    await expect(cases.getCatalogTitles.execute({ limit: 101 })).rejects.toThrow();
    await expect(cases.getCatalogTitles.execute({ page: 10002, limit: 1 })).rejects.toThrow();
  });

  it("importa válidos en una única llamada preservando índices originales", async () => {
    const { cases, repository } = context;
    const result = await cases.bulkCreateCatalogTitles.execute({
      items: [importMovie(), null, importMovie("second")],
    });
    expect(repository.insertMany).toHaveBeenCalledTimes(1);
    expect(repository.insertMany.mock.calls[0]?.[0].map((item) => item.index)).toEqual([0, 2]);
    expect(result.summary).toEqual({
      received: 3,
      inserted: 2,
      duplicates: 0,
      failed: 1,
      indeterminate: 0,
    });
    expect(result.results.map((item) => item.index)).toEqual([0, 1, 2]);
  });

  it("no escribe lotes vacíos, excesivos ni enteramente inválidos", async () => {
    const { cases, repository } = context;
    await expect(cases.bulkCreateCatalogTitles.execute({ items: [] })).rejects.toThrow();
    await expect(
      cases.bulkCreateCatalogTitles.execute({
        items: Array.from({ length: 6 }, () => importMovie()),
      }),
    ).rejects.toThrow();
    expect(
      (await cases.bulkCreateCatalogTitles.execute({ items: [null, { typeId: 999 }] })).summary
        .failed,
    ).toBe(2);
    expect(repository.insertMany).not.toHaveBeenCalled();
  });

  it("distingue duplicados, conflictos y resultados indeterminados", async () => {
    const { cases, repository, title } = context;
    repository.insertMany.mockResolvedValue([
      { index: 0, status: "duplicate", tituloId: title.tituloId },
      { index: 1, status: "rejected", code: "IMPORT_KEY_CONFLICT" },
      { index: 2, status: "indeterminate", code: "PERSISTENCE_OUTCOME_UNKNOWN" },
    ]);
    const result = await cases.bulkCreateCatalogTitles.execute({
      items: [importMovie("a"), importMovie("b"), importMovie("c")],
    });
    expect(result.summary).toEqual({
      received: 3,
      inserted: 0,
      duplicates: 1,
      failed: 1,
      indeterminate: 1,
    });
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it("no inventa éxito si el repositorio omite resultados", async () => {
    context.repository.insertMany.mockResolvedValue([]);
    await expect(
      context.cases.bulkCreateCatalogTitles.execute({ items: [importMovie()] }),
    ).rejects.toMatchObject({ code: "INVALID_REPOSITORY_RESULT" });
  });

  it("actualiza la ficha, omite no-op y propaga conflictos concurrentes", async () => {
    const { cases, title, repository } = context;
    const result = await cases.updateCatalogTitle.execute({
      tituloId: title.tituloId,
      ficha: { title: "Revisado", posterUrl: null },
    });
    expect(result.ficha.title).toBe("Revisado");
    expect(repository.saveChanges.mock.calls[0]?.[1].version).toBe(2);
    await cases.updateCatalogTitle.execute({
      tituloId: title.tituloId,
      ficha: { title: title.snapshot().ficha.title },
    });
    expect(repository.saveChanges).toHaveBeenCalledTimes(1);
    repository.saveChanges.mockRejectedValue(
      new CatalogError("CONCURRENT_MODIFICATION", "Conflicto"),
    );
    await expect(
      cases.updateCatalogTitle.execute({ tituloId: title.tituloId, ficha: { title: "Otro" } }),
    ).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
  });

  it("delega transiciones en dominio antes de escribir", async () => {
    const { cases, title, repository } = context;
    await expect(
      cases.changePublicationStatus.execute({ tituloId: title.tituloId, publicationStatusId: 3 }),
    ).rejects.toMatchObject({ code: "INVALID_PUBLICATION_TRANSITION" });
    expect(repository.saveChanges).not.toHaveBeenCalled();
    expect(
      (
        await cases.changePublicationStatus.execute({
          tituloId: title.tituloId,
          publicationStatusId: 2,
        })
      ).publicationStatusName,
    ).toBe("PUBLICADO");
  });
});
