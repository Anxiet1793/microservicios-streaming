import type { IndexDescription } from "mongodb";

export const TITLE_INDEXES: IndexDescription[] = [
  { name: "uq_catalog_titles_titulo_id", key: { tituloId: 1 }, unique: true },
  { name: "uq_catalog_titles_import_key", key: { importKey: 1 }, unique: true },
  { name: "ix_catalog_titles_updated", key: { updatedAt: -1, tituloId: 1 } },
  {
    name: "ix_catalog_titles_status_type_updated",
    key: { publicationStatusId: 1, typeId: 1, updatedAt: -1, tituloId: 1 },
  },
  { name: "ix_catalog_titles_year", key: { "ficha.releaseYear": 1 } },
  { name: "ix_catalog_titles_genre", key: { "ficha.genres": 1 } },
  {
    name: "tx_catalog_titles_title",
    key: { "ficha.title": "text", "ficha.originalTitle": "text" },
    default_language: "none",
  },
];
export const EPISODE_INDEXES: IndexDescription[] = [
  { name: "uq_catalog_episodes_episode_id", key: { episodeId: 1 }, unique: true },
  {
    name: "uq_catalog_episodes_position",
    key: { seriesId: 1, seasonNumber: 1, episodeNumber: 1 },
    unique: true,
  },
];
