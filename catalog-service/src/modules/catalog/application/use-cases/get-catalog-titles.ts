import type { CatalogRepository } from "../../domain/repositories/catalog-repository";
import { normalizeCatalogQuery } from "../../domain/repositories/catalog-query";
import type { CatalogPageDto, GetCatalogTitlesInput } from "../dto/catalog-dto";
import { toCatalogPageDto } from "../mappers/catalog-dto-mapper";

export class GetCatalogTitles {
  constructor(private readonly repository: CatalogRepository) {}

  async execute(input: GetCatalogTitlesInput = {}): Promise<CatalogPageDto> {
    const query = normalizeCatalogQuery(input);
    return toCatalogPageDto(await this.repository.findPage(query));
  }
}
