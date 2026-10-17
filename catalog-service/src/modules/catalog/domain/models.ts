/**
 * Diccionarios del contexto Catálogo: equivalencias entre IDs y nombres.
 *
 * Cada ID es estable y pertenece a su propio diccionario. Nunca renumerar,
 * reutilizar IDs retirados ni generarlos según la posición en una lista.
 * Agregar valores exige actualizar validadores y documentar el contrato.
 * Los IDs son categorías, no cantidades ni una escala de similitud.
 *
 * Persistencia prevista: IDs como BSON Int32; nombres derivados al responder.
 * Este archivo no depende de MongoDB, Next.js ni Zod.
 */

/** typeId -> typeName. */
export const CATALOG_TYPES = Object.freeze({
  1: "MOVIE", // 1 = Película: tiene duración y recurso reproducible propios.
  2: "SERIES", // 2 = Serie: agrupa episodios, sin recurso reproducible propio.
} as const);
export type CatalogTypeId = keyof typeof CATALOG_TYPES;

/** publicationStatusId -> publicationStatusName. */
export const PUBLICATION_STATUSES = Object.freeze({
  1: "REGISTRADO", // 1 = Registrado en el catálogo, pendiente de publicación.
  2: "PUBLICADO", // 2 = Publicado editorialmente.
  3: "RETIRADO", // 3 = Retirado; estado terminal según las reglas actuales.
} as const);
export type PublicationStatusId = keyof typeof PUBLICATION_STATUSES;
// Transiciones: 1 -> 2 -> 3. Repetir el mismo ID no produce cambios.
// La futura entidad validará transiciones explícitas; nunca usar statusId + 1.

/** ficha.genres[] -> ficha.genresName[], conservando la correspondencia por posición. */
export const GENRES = Object.freeze({
  1: "SCIENCE_FICTION", // 1 = Ciencia ficción.
  2: "DRAMA", // 2 = Drama.
  3: "COMEDY", // 3 = Comedia.
  4: "ACTION", // 4 = Acción.
  5: "ADVENTURE", // 5 = Aventura.
  6: "THRILLER", // 6 = Suspenso.
  7: "HORROR", // 7 = Terror.
  8: "ROMANCE", // 8 = Romance.
  9: "ANIMATION", // 9 = Animación.
  10: "DOCUMENTARY", // 10 = Documental.
  11: "FANTASY", // 11 = Fantasía.
  12: "MYSTERY", // 12 = Misterio.
  13: "FAMILY", // 13 = Familiar.
  14: "HISTORY", // 14 = Histórico.
  15: "MUSIC", // 15 = Musical o temática musical.
} as const);
export type GenreId = keyof typeof GENRES;

/** ficha.languages[] -> ficha.languagesName[] (códigos de idioma).
 * Lista inicial admitida; no pretende enumerar todos los idiomas.
 * Una variante regional requiere su propio ID si se incorpora al contrato.
 */
export const LANGUAGES = Object.freeze({
  1: "es", // 1 = Español.
  2: "en", // 2 = Inglés.
  3: "pt", // 3 = Portugués.
  4: "fr", // 4 = Francés.
  5: "de", // 5 = Alemán.
  6: "it", // 6 = Italiano.
  7: "ja", // 7 = Japonés.
  8: "ko", // 8 = Coreano.
  9: "zh", // 9 = Chino, código general sin variante regional.
  10: "qu", // 10 = Quechua, código general sin variante regional.
} as const);
export type LanguageId = keyof typeof LANGUAGES;

/** ficha.ageRatingId -> ficha.ageRatingName.
 * Vocabulario editorial inicial del proyecto, basado en etiquetas de películas
 * estadounidenses. No representa una equivalencia legal entre países ni una
 * política de autorización. Sistemas de clasificación adicionales necesitarán
 * IDs nuevos y su contexto; no reutilizar estos IDs para otras etiquetas.
 */
export const AGE_RATINGS = Object.freeze({
  1: "NOT_RATED", // 1 = Sin clasificación editorial asignada.
  2: "G", // 2 = Etiqueta G.
  3: "PG", // 3 = Etiqueta PG.
  4: "PG-13", // 4 = Etiqueta PG-13.
  5: "R", // 5 = Etiqueta R.
  6: "NC-17", // 6 = Etiqueta NC-17.
} as const);
export type AgeRatingId = keyof typeof AGE_RATINGS;

/** playbackReference.providerId -> playbackReference.providerName.
 * Se conserva CDN como categoría técnica del prompt; no identifica una empresa.
 */
export const PLAYBACK_PROVIDERS = Object.freeze({
  1: "CDN", // 1 = Recurso referenciado mediante CDN.
} as const);
export type PlaybackProviderId = keyof typeof PLAYBACK_PROVIDERS;

// Ejemplo de equivalencias para la futura respuesta HTTP:
// typeId: 1, typeName: CATALOG_TYPES[1]                         -> "MOVIE"
// publicationStatusId: 2, publicationStatusName: PUBLICATION_STATUSES[2]
//                                                            -> "PUBLICADO"
// genres: [1, 2], genresName: [GENRES[1], GENRES[2]]
//                                      -> ["SCIENCE_FICTION", "DRAMA"]
// languages: [1, 2], languagesName: [LANGUAGES[1], LANGUAGES[2]] -> ["es", "en"]
// ageRatingId: 4, ageRatingName: AGE_RATINGS[4]                 -> "PG-13"
// providerId: 1, providerName: PLAYBACK_PROVIDERS[1]            -> "CDN"
//
// Los nombres son de salida: no se aceptan como campos editables ni se guardan
// en paralelo con los IDs. Los validadores futuros deben rechazar IDs ausentes
// del diccionario, fracciones, cadenas numéricas en JSON y arrays duplicados.
// Los tipos TypeScript no sustituyen esa validación en tiempo de ejecución.
