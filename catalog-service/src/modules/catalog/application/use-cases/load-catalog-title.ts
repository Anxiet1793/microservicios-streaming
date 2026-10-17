import { CatalogError } from "../../domain/errors/catalog-error";
import type { CatalogRepository } from "../../domain/repositories/catalog-repository";
import { TituloId } from "../../domain/value-objects/titulo-id";

/** Colaboración interna compartida; no es un caso de uso ni un endpoint adicional. */
export async function loadCatalogTitle(repository: CatalogRepository, tituloId: string) {
  const title = await repository.findById(TituloId.from(tituloId));
  if (!title) throw new CatalogError("CATALOG_TITLE_NOT_FOUND", "El título no existe.");
  return title;
}
