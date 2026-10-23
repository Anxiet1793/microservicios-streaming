import type { CatalogRepository } from "../../domain/repositories/catalog-repository";
import { EstadoPublicacion } from "../../domain/value-objects/publication-status";
import type { CatalogTitleDto, ChangePublicationStatusInput } from "../dto/catalog-dto";
import { toCatalogTitleDto } from "../mappers/catalog-dto-mapper";
import type { Clock } from "../ports/clock";
import { assertFields, readClock } from "../validation/input";
import { loadCatalogTitle } from "./load-catalog-title";

export class ChangePublicationStatus {
  constructor(
    private readonly repository: CatalogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ChangePublicationStatusInput): Promise<CatalogTitleDto> {
    assertFields(input, ["tituloId", "publicationStatusId"], ["tituloId", "publicationStatusId"]);
    EstadoPublicacion.from(input.publicationStatusId);
    const previous = await loadCatalogTitle(this.repository, input.tituloId);
    const next = previous.changePublicationStatus(input.publicationStatusId, readClock(this.clock));
    if (next !== previous) await this.repository.saveChanges(previous, next);
    return toCatalogTitleDto(next);
  }
}
