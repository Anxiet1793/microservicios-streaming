import { describe, expect, it } from "vitest";
import { TituloCatalogo } from "../../src/modules/catalog/domain/entities/catalog-title";
import {
  FichaContenido,
  type ContentSheetData,
} from "../../src/modules/catalog/domain/value-objects/content-sheet";
import { TituloId } from "../../src/modules/catalog/domain/value-objects/titulo-id";
import { createdAt, later, movie, movieInput } from "../helpers/fixtures";

describe("TítuloCatalogo y sus invariantes", () => {
  it("registra una película y protege los datos frente a mutaciones externas", () => {
    const input = movieInput();
    const date = new Date(createdAt);
    const title = TituloCatalogo.register(input, date);
    date.setFullYear(2000);
    title.snapshot().createdAt.setFullYear(2001);
    expect(title.snapshot()).toMatchObject({
      tituloId: input.tituloId,
      publicationStatusId: 1,
      version: 1,
      createdAt,
    });
    expect(Object.isFrozen(title.snapshot().ficha.genres)).toBe(true);
  });

  it("acepta series sin duración ni recurso propio", () => {
    const { durationMinutes: _duration, ...ficha } = movieInput().ficha;
    expect(_duration).toBe(108);
    expect(
      movie({ typeId: 2, ficha, playbackReference: null }).snapshot().playbackReference,
    ).toBeNull();
    expect(() => movie({ typeId: 2 })).toThrow();
    expect(() => movie({ playbackReference: null })).toThrow();
  });

  it("permite 1→2→3, conserva el agregado previo y hace idempotente repetir estado", () => {
    const registered = movie();
    const published = registered.changePublicationStatus(2, later);
    const withdrawn = published.changePublicationStatus(3, later);
    expect(registered.snapshot().publicationStatusId).toBe(1);
    expect(withdrawn.snapshot()).toMatchObject({ publicationStatusId: 3, version: 3 });
    expect(published.changePublicationStatus(2, later)).toBe(published);
  });

  it.each([
    [1, 3],
    [2, 1],
    [3, 1],
    [3, 2],
  ] as const)("rechaza la transición %i→%i", (from, to) => {
    const title = TituloCatalogo.rehydrate({ ...movie().snapshot(), publicationStatusId: from });
    expect(() => title.changePublicationStatus(to, later)).toThrow(
      expect.objectContaining({ code: "INVALID_PUBLICATION_TRANSITION" }),
    );
  });

  it("aplica PATCH parcial, limpia opcionales y conserva fechas/identidad", () => {
    const title = movie();
    const updated = title.updateFicha({ title: "  Órbita revisada  ", posterUrl: null }, later);
    expect(updated.snapshot()).toMatchObject({
      tituloId: title.tituloId,
      createdAt,
      updatedAt: later,
      version: 2,
      ficha: { title: "Órbita revisada", synopsis: title.snapshot().ficha.synopsis },
    });
    expect(updated.snapshot().ficha).not.toHaveProperty("posterUrl");
    expect(title.updateFicha({ title: title.snapshot().ficha.title }, later)).toBe(title);
    expect(() => title.updateFicha({ title: null }, later)).toThrow();
    expect(() => title.updateFicha({ title: "Nuevo" }, new Date(0))).toThrow();
  });

  it.each([
    { title: " " },
    { releaseYear: 1887 },
    { releaseYear: 2025.5 },
    { genres: [1, 1] },
    { genres: [999] },
    { languages: ["1"] },
    { durationMinutes: 0 },
    { posterUrl: "javascript:alert(1)" },
    { posterUrl: "https://user:password@example.com/image" },
    { title: "x".repeat(301) },
    { publicationStatusId: 2 },
  ])("rechaza una ficha inválida: %j", (patch) => {
    expect(() =>
      FichaContenido.create(1, { ...movieInput().ficha, ...patch } as ContentSheetData),
    ).toThrow();
  });

  it("cuenta caracteres Unicode y normaliza conjuntos sin alterar el reparto", () => {
    const ficha = FichaContenido.create(1, {
      ...movieInput().ficha,
      title: "🌎".repeat(300),
      genres: [2, 1],
      cast: ["B", "A"],
    }).data;
    expect(ficha.genres).toEqual([1, 2]);
    expect(ficha.cast).toEqual(["B", "A"]);
  });

  it("rechaza ObjectId como identificador público", () => {
    expect(() => TituloId.from("507f1f77bcf86cd799439011")).toThrow();
    expect(TituloId.from(movie().tituloId).value).toMatch(/^ttl_/);
  });
});
