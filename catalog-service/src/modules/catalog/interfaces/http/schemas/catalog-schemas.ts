import { z } from "zod";
import {
  AGE_RATINGS,
  GENRES,
  LANGUAGES,
  PLAYBACK_PROVIDERS,
  PUBLICATION_STATUSES,
} from "../../../domain/models";
import { CATALOG_LIMITS as L } from "../../../domain/limits";
import { TITLE_ID_PATTERN } from "../../../domain/value-objects/titulo-id";

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .refine((value) => [...value].length <= max, "Texto demasiado largo.");
const id = <T extends Record<number, string>>(dictionary: T) =>
  z
    .number()
    .int()
    .refine((value) => Object.hasOwn(dictionary, value), "Identificador desconocido.")
    .transform((value) => value as keyof T & number);
const ids = <T extends Record<number, string>>(dictionary: T) =>
  z
    .array(id(dictionary))
    .min(1)
    .max(L.maxCategories)
    .refine((values) => new Set(values).size === values.length, "Identificadores repetidos.");
const imageUrl = text(L.urlLength).refine((value) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}, "URL inválida.");

export const tituloIdSchema = z.string().regex(TITLE_ID_PATTERN);
export const publicationStatusSchema = z.strictObject({
  publicationStatusId: id(PUBLICATION_STATUSES),
});
const referenceSchema = z.strictObject({
  providerId: id(PLAYBACK_PROVIDERS),
  assetId: text(L.assetIdLength),
  manifestKey: text(L.urlLength),
});
const fichaFields = {
  title: text(L.titleLength),
  synopsis: text(L.synopsisLength),
  releaseYear: z.number().int().min(L.minYear).max(L.maxYear),
  genres: ids(GENRES),
  languages: ids(LANGUAGES),
  originalTitle: text(L.titleLength).optional(),
  ageRatingId: id(AGE_RATINGS).optional(),
  posterUrl: imageUrl.optional(),
  backdropUrl: imageUrl.optional(),
  director: text(L.titleLength).optional(),
  cast: z.array(text(L.castNameLength)).max(L.maxCast).optional(),
};
const duration = z.number().int().min(1).max(L.maxDuration);
const importKey = z
  .string()
  .min(1)
  .refine(
    (value) => value === value.trim() && [...value].length <= L.importKeyLength,
    "Clave de importación inválida.",
  );

export const bulkItemSchema = z.discriminatedUnion("typeId", [
  z.strictObject({
    importKey,
    typeId: z.literal(1),
    ficha: z.strictObject({ ...fichaFields, durationMinutes: duration }),
    playbackReference: referenceSchema,
  }),
  z.strictObject({
    importKey,
    typeId: z.literal(2),
    ficha: z.strictObject(fichaFields),
    playbackReference: z.null().optional(),
  }),
]);
export const bulkEnvelopeSchema = (maxItems: number) =>
  z.strictObject({ items: z.array(z.unknown()).min(1).max(maxItems) });

export const updateFichaSchema = z.strictObject({
  ficha: z
    .strictObject({
      title: fichaFields.title.optional(),
      synopsis: fichaFields.synopsis.optional(),
      releaseYear: fichaFields.releaseYear.optional(),
      genres: fichaFields.genres.optional(),
      languages: fichaFields.languages.optional(),
      durationMinutes: duration.optional(),
      originalTitle: fichaFields.originalTitle.nullable(),
      ageRatingId: fichaFields.ageRatingId.nullable(),
      posterUrl: fichaFields.posterUrl.nullable(),
      backdropUrl: fichaFields.backdropUrl.nullable(),
      director: fichaFields.director.nullable(),
      cast: fichaFields.cast.nullable(),
    })
    .refine((value) => Object.keys(value).length > 0, "Se requiere al menos un campo."),
});

const queryNumber = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.number().int().safe());
export const catalogQuerySchema = z.strictObject({
  page: queryNumber.pipe(z.number().min(1)).optional(),
  limit: queryNumber.pipe(z.number().min(1).max(L.maxPageSize)).optional(),
  type: queryNumber.pipe(z.union([z.literal(1), z.literal(2)])).optional(),
  status: queryNumber.pipe(id(PUBLICATION_STATUSES)).optional(),
  genre: queryNumber.pipe(id(GENRES)).optional(),
  year: queryNumber.pipe(z.number().min(L.minYear).max(L.maxYear)).optional(),
  q: text(L.queryLength)
    .refine((value) => /[\p{L}\p{N}]/u.test(value), "La búsqueda debe contener palabras.")
    .optional(),
});
