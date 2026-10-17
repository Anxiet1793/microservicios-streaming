import type { Int32, ObjectId } from "mongodb";
import type { ContentSheetData } from "../../../../domain/value-objects/content-sheet";
import type { PlaybackReferenceData } from "../../../../domain/value-objects/playback-reference";

export type BsonNumbers<T> = T extends Date ? Date
  : T extends number ? Int32
  : T extends readonly (infer E)[] ? BsonNumbers<E>[]
  : T extends object ? { -readonly [K in keyof T]: BsonNumbers<T[K]> }
  : T;

export interface CatalogTitleDocument {
  _id: ObjectId;
  schemaVersion: Int32;
  tituloId: string;
  importKey: string;
  importFingerprint: string;
  typeId: Int32;
  ficha: BsonNumbers<ContentSheetData>;
  publicationStatusId: Int32;
  playbackReference: BsonNumbers<PlaybackReferenceData> | null;
  createdAt: Date;
  updatedAt: Date;
  version: Int32;
}

export const CATALOG_COLLECTIONS = Object.freeze({ titles: "catalog_titles", episodes: "catalog_episodes" });
