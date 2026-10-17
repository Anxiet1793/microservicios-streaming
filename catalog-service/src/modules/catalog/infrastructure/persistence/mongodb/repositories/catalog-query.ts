import { Int32, type Filter } from "mongodb";
import { normalizeCatalogQuery } from "../../../../domain/repositories/catalog-query";
import type { CatalogQuery } from "../../../../domain/repositories/catalog-repository";
import type { CatalogTitleDocument } from "../documents/catalog-document";

export function catalogFilter(input: CatalogQuery): Filter<CatalogTitleDocument> {
  const query = normalizeCatalogQuery(input);
  const filter: Filter<CatalogTitleDocument> = {};
  for (const key of ["typeId", "publicationStatusId", "genreId"] as const) {
    const value = query[key];
    if (value === undefined) continue;
    if (key === "genreId") filter["ficha.genres"] = new Int32(value);
    else filter[key] = new Int32(value);
  }
  if (query.year !== undefined) {
    filter["ficha.releaseYear"] = new Int32(query.year);
  }
  if (query.q !== undefined) {
    // Solo palabras: comillas y guiones del usuario no se convierten en sintaxis $text.
    const words = query.q.match(/[\p{L}\p{N}]+/gu);
    filter.$text = { $search: words!.join(" "), $language: "none" };
  }
  return filter;
}
