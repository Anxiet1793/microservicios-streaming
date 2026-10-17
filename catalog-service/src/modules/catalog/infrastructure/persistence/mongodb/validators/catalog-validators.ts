import type { Document } from "mongodb";
import { AGE_RATINGS, CATALOG_TYPES, GENRES, LANGUAGES, PLAYBACK_PROVIDERS, PUBLICATION_STATUSES } from "../../../../domain/models";
import { CATALOG_LIMITS as L } from "../../../../domain/limits";
import { EPISODE_ID_PATTERN, TITLE_ID_PATTERN } from "../../../../domain/value-objects/titulo-id";

const object = (properties: Document, required: string[]): Document => ({ bsonType: "object", additionalProperties: false, required, properties });
const text = (maxLength: number): Document => ({ bsonType: "string", minLength: 1, maxLength, pattern: "\\S" });
const integer = (minimum: number, maximum: number): Document => ({ bsonType: "int", minimum, maximum });
const category = (dictionary: object): Document => ({ bsonType: "int", enum: Object.keys(dictionary).map(Number) });
const categories = (dictionary: object): Document => ({ bsonType: "array", minItems: 1, maxItems: L.maxCategories, uniqueItems: true, items: category(dictionary) });
const url = { ...text(L.urlLength), pattern: "^https?://" };
const common = {
  _id: { bsonType: "objectId" },
  schemaVersion: { bsonType: "int", enum: [1] },
  publicationStatusId: category(PUBLICATION_STATUSES),
  createdAt: { bsonType: "date" },
  updatedAt: { bsonType: "date" },
  version: integer(1, L.maxVersion),
};
const reference = object({ providerId: category(PLAYBACK_PROVIDERS), assetId: text(L.assetIdLength), manifestKey: text(L.urlLength) }, ["providerId", "assetId", "manifestKey"]);
const ficha = object({
  title: text(L.titleLength), synopsis: text(L.synopsisLength),
  releaseYear: integer(L.minYear, L.maxYear), durationMinutes: integer(1, L.maxDuration),
  genres: categories(GENRES), languages: categories(LANGUAGES),
  originalTitle: text(L.titleLength), ageRatingId: category(AGE_RATINGS),
  posterUrl: url, backdropUrl: url, director: text(L.titleLength),
  cast: { bsonType: "array", maxItems: L.maxCast, items: text(L.castNameLength) },
}, ["title", "synopsis", "releaseYear", "genres", "languages", "cast"]);

export const TITLE_VALIDATOR: Document = {
  $jsonSchema: {
    ...object({
      ...common,
      tituloId: { bsonType: "string", pattern: TITLE_ID_PATTERN.source },
      importKey: { ...text(L.importKeyLength), pattern: "^\\S(?:[\\s\\S]*\\S)?$" },
      importFingerprint: { bsonType: "string", pattern: "^[a-f0-9]{64}$" },
      typeId: category(CATALOG_TYPES), ficha,
      playbackReference: { oneOf: [reference, { bsonType: "null" }] },
    }, [...Object.keys(common), "tituloId", "importKey", "importFingerprint", "typeId", "ficha", "playbackReference"]),
    oneOf: [
      { properties: { typeId: { enum: [1] }, ficha: { required: ["durationMinutes"] }, playbackReference: { bsonType: "object" } } },
      { properties: { typeId: { enum: [2] }, ficha: { not: { required: ["durationMinutes"] } }, playbackReference: { bsonType: "null" } } },
    ],
  },
};
export const EPISODE_VALIDATOR: Document = {
  $jsonSchema: object({
    ...common,
    episodeId: { bsonType: "string", pattern: EPISODE_ID_PATTERN.source },
    seriesId: { bsonType: "string", pattern: TITLE_ID_PATTERN.source },
    seasonNumber: integer(1, L.maxVersion), episodeNumber: integer(1, L.maxVersion),
    ficha: object({ title: text(L.titleLength), synopsis: text(L.synopsisLength), durationMinutes: integer(1, L.maxDuration) }, ["title", "synopsis", "durationMinutes"]),
    playbackReference: reference,
  }, [...Object.keys(common), "episodeId", "seriesId", "seasonNumber", "episodeNumber", "ficha", "playbackReference"]),
};
