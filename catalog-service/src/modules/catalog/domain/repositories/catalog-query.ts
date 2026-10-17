import { CATALOG_TYPES, GENRES, PUBLICATION_STATUSES } from "../models";
import { CatalogError } from "../errors/catalog-error";
import { CATALOG_LIMITS as L } from "../limits";
import type { CatalogQuery } from "./catalog-repository";

/** Límites del puerto compartidos por aplicación e infraestructura. Sin tipos MongoDB. */
export function normalizeCatalogQuery(input: Partial<CatalogQuery>): CatalogQuery {
  const invalid = (): never => { throw new CatalogError("INVALID_CATALOG_QUERY", "Filtros o paginación inválidos."); };
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).some(key => !["page", "limit", "typeId", "publicationStatusId", "genreId", "year", "q"].includes(key))) invalid();
  const page = input.page === undefined ? 1 : input.page;
  const limit = input.limit === undefined ? L.defaultPageSize : input.limit;
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1
    || limit > L.maxPageSize || (page - 1) * limit > L.maxOffset) invalid();
  for (const [key, dictionary] of [["typeId", CATALOG_TYPES], ["publicationStatusId", PUBLICATION_STATUSES], ["genreId", GENRES]] as const) {
    const value = input[key];
    if (value !== undefined && (typeof value !== "number" || !Object.hasOwn(dictionary, value))) invalid();
  }
  if (input.year !== undefined && (!Number.isInteger(input.year) || input.year < L.minYear || input.year > L.maxYear)) invalid();
  if (input.q !== undefined && (typeof input.q !== "string" || [...input.q].length > L.queryLength || !/[\p{L}\p{N}]/u.test(input.q))) invalid();
  return {
    page, limit,
    ...(input.typeId !== undefined ? { typeId: input.typeId } : {}),
    ...(input.publicationStatusId !== undefined ? { publicationStatusId: input.publicationStatusId } : {}),
    ...(input.genreId !== undefined ? { genreId: input.genreId } : {}),
    ...(input.year !== undefined ? { year: input.year } : {}),
    ...(input.q !== undefined ? { q: input.q.trim() } : {}),
  };
}
