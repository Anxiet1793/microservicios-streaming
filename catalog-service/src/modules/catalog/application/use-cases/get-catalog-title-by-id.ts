import type { CatalogRepository } from "../../domain/repositories/catalog-repository";
import type { CatalogTitleDto, GetCatalogTitleInput } from "../dto/catalog-dto";
import { toCatalogTitleDto } from "../mappers/catalog-dto-mapper";
import { assertFields } from "../validation/input";
import { loadCatalogTitle } from "./load-catalog-title";

export class GetCatalogTitleById {
  constructor(private readonly repository: CatalogRepository) {}

  async execute(input: GetCatalogTitleInput): Promise<CatalogTitleDto> {
    assertFields(input, ["tituloId"], ["tituloId"]);
    return toCatalogTitleDto(await loadCatalogTitle(this.repository, input.tituloId));
  }
}
