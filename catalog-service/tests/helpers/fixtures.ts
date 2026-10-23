import { randomUUID } from "node:crypto";
import {
  TituloCatalogo,
  type RegisterCatalogTitle,
} from "../../src/modules/catalog/domain/entities/catalog-title";
import type { CreateCatalogTitleDto } from "../../src/modules/catalog/application/dto/catalog-dto";

export const createdAt = new Date("2026-09-19T12:00:00.000Z");
export const later = new Date("2026-09-19T12:01:00.000Z");
export const movieInput = (): RegisterCatalogTitle => ({
  tituloId: `ttl_${randomUUID()}`,
  typeId: 1,
  ficha: {
    title: "Órbita de papel",
    synopsis: "Una expedición recibe una señal.",
    releaseYear: 2025,
    durationMinutes: 108,
    genres: [1, 2],
    languages: [1, 2],
    posterUrl: "https://example.com/poster.jpg",
  },
  playbackReference: { providerId: 1, assetId: "orbita", manifestKey: "movies/orbita/master.m3u8" },
});
export const movie = (overrides: Partial<RegisterCatalogTitle> = {}) =>
  TituloCatalogo.register({ ...movieInput(), ...overrides }, createdAt);
export const importMovie = (importKey = "test:movie"): CreateCatalogTitleDto => {
  const { typeId, ficha, playbackReference } = movieInput();
  return { importKey, typeId, ficha, playbackReference };
};
