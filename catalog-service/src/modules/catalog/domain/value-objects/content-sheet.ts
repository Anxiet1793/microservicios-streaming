import { AGE_RATINGS, GENRES, LANGUAGES, type AgeRatingId, type CatalogTypeId, type GenreId, type LanguageId } from "../models";
import { CATALOG_LIMITS as L } from "../limits";
import { CatalogError } from "../errors/catalog-error";

export interface ContentSheetData {
  readonly title: string;
  readonly synopsis: string;
  readonly releaseYear: number;
  readonly genres: readonly GenreId[];
  readonly languages: readonly LanguageId[];
  readonly originalTitle?: string;
  readonly durationMinutes?: number;
  readonly ageRatingId?: AgeRatingId;
  readonly posterUrl?: string;
  readonly backdropUrl?: string;
  readonly director?: string;
  readonly cast?: readonly string[];
}
export type ContentSheetPatch = {
  [K in keyof ContentSheetData]?: ContentSheetData[K] | null;
};

export const CONTENT_SHEET_FIELDS = ["title", "synopsis", "releaseYear", "genres", "languages", "originalTitle", "durationMinutes", "ageRatingId", "posterUrl", "backdropUrl", "director", "cast"] as const;

function invalid(): never {
  throw new CatalogError("INVALID_CONTENT_SHEET", "La ficha contiene campos o valores inválidos.");
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || [...value.trim()].length > max) invalid();
  return value.trim();
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) invalid();
  return value;
}
function categories<T extends number>(value: readonly T[], dictionary: object): readonly T[] {
  if (!Array.isArray(value) || !value.length || value.length > L.maxCategories
    || value.some(id => typeof id !== "number" || !Object.hasOwn(dictionary, id))
    || new Set(value).size !== value.length) invalid();
  return Object.freeze([...value].sort((a, b) => a - b));
}
function url(value: unknown): string {
  const result = text(value, L.urlLength);
  try {
    const parsed = new URL(result);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) invalid();
  } catch { invalid(); }
  return result;
}

export class FichaContenido {
  private constructor(readonly data: ContentSheetData) { Object.freeze(this); }

  static create(typeId: CatalogTypeId, value: ContentSheetData): FichaContenido {
    if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).some(key => !CONTENT_SHEET_FIELDS.includes(key as typeof CONTENT_SHEET_FIELDS[number]))) invalid();
    const result: Record<string, unknown> = {
      title: text(value.title, L.titleLength),
      synopsis: text(value.synopsis, L.synopsisLength),
      releaseYear: integer(value.releaseYear, L.minYear, L.maxYear),
      genres: categories(value.genres, GENRES),
      languages: categories(value.languages, LANGUAGES),
    };
    if (typeId === 1) result.durationMinutes = integer(value.durationMinutes, 1, L.maxDuration);
    else if (typeId !== 2 || value.durationMinutes !== undefined) invalid();
    for (const key of ["originalTitle", "director"] as const) {
      if (value[key] !== undefined) result[key] = text(value[key], L.titleLength);
    }
    for (const key of ["posterUrl", "backdropUrl"] as const) {
      if (value[key] !== undefined) result[key] = url(value[key]);
    }
    if (value.ageRatingId !== undefined) {
      if (typeof value.ageRatingId !== "number" || !Object.hasOwn(AGE_RATINGS, value.ageRatingId)) invalid();
      result.ageRatingId = value.ageRatingId;
    }
    // Una lista ausente y una lista vacía tienen la misma representación canónica.
    const cast = value.cast ?? [];
    if (!Array.isArray(cast) || cast.length > L.maxCast) invalid();
    result.cast = Object.freeze(cast.map(name => text(name, L.castNameLength)));
    return new FichaContenido(Object.freeze(result) as unknown as ContentSheetData);
  }

  patch(typeId: CatalogTypeId, changes: ContentSheetPatch): FichaContenido {
    if (!changes || typeof changes !== "object" || Array.isArray(changes)) invalid();
    const result: Record<string, unknown> = { ...this.data };
    for (const [key, value] of Object.entries(changes)) {
      if (!CONTENT_SHEET_FIELDS.includes(key as typeof CONTENT_SHEET_FIELDS[number])) invalid();
      if (value === null) delete result[key];
      else if (value !== undefined) result[key] = value;
    }
    return FichaContenido.create(typeId, result as unknown as ContentSheetData);
  }
}
