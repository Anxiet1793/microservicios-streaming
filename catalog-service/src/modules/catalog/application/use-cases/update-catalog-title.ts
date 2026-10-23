import type { CatalogRepository } from "../../domain/repositories/catalog-repository";
import { CONTENT_SHEET_FIELDS } from "../../domain/value-objects/content-sheet";
import type { CatalogTitleDto, UpdateCatalogTitleInput } from "../dto/catalog-dto";
import { ApplicationError } from "../errors/application-error";
import { toCatalogTitleDto } from "../mappers/catalog-dto-mapper";
import type { Clock } from "../ports/clock";
import { assertFields, readClock } from "../validation/input";
import { loadCatalogTitle } from "./load-catalog-title";

export class UpdateCatalogTitle {
  constructor(
    private readonly repository: CatalogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateCatalogTitleInput): Promise<CatalogTitleDto> {
    assertFields(input, ["tituloId", "ficha"], ["tituloId", "ficha"]);
    assertFields(input.ficha, CONTENT_SHEET_FIELDS, []);
    if (!Object.values(input.ficha).some((value) => value !== undefined)) {
      throw new ApplicationError(
        "VALIDATION_ERROR",
        "La actualización debe incluir al menos un campo de la ficha.",
      );
    }
    const previous = await loadCatalogTitle(this.repository, input.tituloId);
    const next = previous.updateFicha(input.ficha, readClock(this.clock));
    if (next !== previous) await this.repository.saveChanges(previous, next);
    return toCatalogTitleDto(next);
  }
}
