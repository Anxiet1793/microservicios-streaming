import { expect, it } from "vitest";
import { TituloCatalogo } from "../../src/modules/catalog/domain/entities/catalog-title";
import {
  FichaContenido,
  type ContentSheetData,
} from "../../src/modules/catalog/domain/value-objects/content-sheet";
import { ReferenciaReproduccion } from "../../src/modules/catalog/domain/value-objects/playback-reference";
import { CATALOG_LIMITS as L } from "../../src/modules/catalog/domain/limits";
import { movie, movieInput, later } from "../helpers/fixtures";

it("requires movie duration and media reference independently", () => {
  const input = movieInput();
  const { durationMinutes: _duration, ...ficha } = input.ficha;
  expect(_duration).toBeGreaterThan(0);
  expect(() => movie({ ficha })).toThrow();
  expect(() => movie({ playbackReference: null })).toThrow();
  expect(() => movie({ typeId: 2, playbackReference: null })).toThrow();
  expect(movie({ typeId: 2, ficha, playbackReference: null }).snapshot().typeId).toBe(2);
});
it.each([
  { version: 0 },
  { version: 1.5 },
  { version: L.maxVersion + 1 },
  { updatedAt: new Date(0) },
  { createdAt: new Date(NaN) },
])("rejects corrupt persisted catalog state %j", (patch) => {
  expect(() => TituloCatalogo.rehydrate({ ...movie().snapshot(), ...patch })).toThrow();
});
it("prevents version overflow and invalid/regressive modification dates", () => {
  const max = TituloCatalogo.rehydrate({ ...movie().snapshot(), version: L.maxVersion });
  expect(() => max.updateFicha({ title: "New" }, later)).toThrow();
  expect(() => movie().changePublicationStatus(2, new Date(NaN))).toThrow();
});
it.each([
  { providerId: 999 },
  { assetId: " " },
  { manifestKey: "" },
  { assetId: "x".repeat(L.assetIdLength + 1) },
  { url: "https://attacker.test" },
])("rejects incompatible playback references %j", (patch) => {
  expect(() =>
    ReferenciaReproduccion.create({ ...movieInput().playbackReference!, ...patch } as Parameters<
      typeof ReferenciaReproduccion.create
    >[0]),
  ).toThrow();
});
it("protects category, text, cast and year boundaries without silently dropping bad data", () => {
  const input = movieInput().ficha;
  expect(
    FichaContenido.create(1, {
      ...input,
      title: "🌎".repeat(L.titleLength),
      releaseYear: L.minYear,
    }).data.title.length,
  ).toBe(600);
  for (const patch of [
    { title: "🌎".repeat(L.titleLength + 1) },
    { cast: Array.from({ length: L.maxCast + 1 }, () => "Name") },
    { cast: ["x".repeat(L.castNameLength + 1)] },
    { languages: [] },
    { ageRatingId: 999 },
    { releaseYear: L.maxYear + 1 },
  ])
    expect(() => FichaContenido.create(1, { ...input, ...patch } as ContentSheetData)).toThrow();
});
