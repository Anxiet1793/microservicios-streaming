import { TituloCatalogo } from "../../domain/entities/catalog-title";
import { CatalogError } from "../../domain/errors/catalog-error";
import { CATALOG_LIMITS as L } from "../../domain/limits";
import { CATALOG_TYPES, type CatalogTypeId } from "../../domain/models";
import type {
  BulkTitleInput,
  BulkTitleResult,
  CatalogRepository,
} from "../../domain/repositories/catalog-repository";
import { FichaContenido, type ContentSheetData } from "../../domain/value-objects/content-sheet";
import {
  ReferenciaReproduccion,
  type PlaybackReferenceData,
} from "../../domain/value-objects/playback-reference";
import { TituloId } from "../../domain/value-objects/titulo-id";
import type {
  BulkCreateCatalogInput,
  BulkCreateCatalogOutput,
  BulkItemResult,
} from "../dto/catalog-dto";
import { ApplicationError } from "../errors/application-error";
import type { Clock } from "../ports/clock";
import type { TitleIdGenerator } from "../ports/title-id-generator";
import { assertFields, readClock } from "../validation/input";
import { toBulkOutput } from "../mappers/bulk-result-mapper";

function parseItem(value: unknown) {
  assertFields(
    value,
    ["importKey", "typeId", "ficha", "playbackReference"],
    ["importKey", "typeId", "ficha"],
  );
  if (
    typeof value.importKey !== "string" ||
    !value.importKey ||
    value.importKey !== value.importKey.trim() ||
    [...value.importKey].length > L.importKeyLength ||
    typeof value.typeId !== "number" ||
    !Object.hasOwn(CATALOG_TYPES, value.typeId)
  ) {
    throw new ApplicationError(
      "VALIDATION_ERROR",
      "Clave de importación o tipo de título inválidos.",
    );
  }
  const typeId = value.typeId as CatalogTypeId;
  const ficha = FichaContenido.create(typeId, value.ficha as ContentSheetData).data;
  const playbackReference =
    value.playbackReference == null
      ? null
      : ReferenciaReproduccion.create(value.playbackReference as PlaybackReferenceData).data;
  if ((typeId === 1 && !playbackReference) || (typeId === 2 && playbackReference)) {
    throw new CatalogError(
      "INVALID_PLAYBACK_REFERENCE",
      "La referencia no corresponde al tipo de contenido.",
    );
  }
  return { importKey: value.importKey, typeId, ficha, playbackReference };
}

export class BulkCreateCatalogTitles {
  constructor(
    private readonly repository: CatalogRepository,
    private readonly idGenerator: TitleIdGenerator,
    private readonly clock: Clock,
    private readonly maxItems = 500,
  ) {
    if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > L.maxBulkItems) {
      throw new ApplicationError("INVALID_APPLICATION_CONFIGURATION", "Límite de carga inválido.");
    }
  }

  async execute(input: BulkCreateCatalogInput): Promise<BulkCreateCatalogOutput> {
    assertFields(input, ["items"], ["items"]);
    if (!Array.isArray(input.items) || !input.items.length || input.items.length > this.maxItems) {
      throw new ApplicationError(
        "VALIDATION_ERROR",
        `El lote debe contener entre 1 y ${this.maxItems} elementos.`,
      );
    }
    const now = readClock(this.clock);
    const valid: BulkTitleInput[] = [];
    const results: BulkItemResult[] = [];
    // Terminar la validación de TODO el lote antes de invocar persistencia.
    for (let index = 0; index < input.items.length; index++) {
      let parsed: ReturnType<typeof parseItem>;
      try {
        parsed = parseItem(input.items[index]);
      } catch (error) {
        if (
          error instanceof CatalogError ||
          (error instanceof ApplicationError && error.code === "VALIDATION_ERROR")
        ) {
          results.push({
            index,
            status: "rejected",
            code: error instanceof CatalogError ? error.code : "VALIDATION_ERROR",
          });
          continue;
        }
        throw error;
      }
      // Fallos del generador/reloj son fallos técnicos; no se atribuyen al registro.
      const id = this.idGenerator.next();
      if (!(id instanceof TituloId))
        throw new ApplicationError(
          "INVALID_DEPENDENCY_RESULT",
          "El generador no devolvió un TituloId válido.",
        );
      const { importKey, ...content } = parsed;
      const title = TituloCatalogo.register({ ...content, tituloId: id.value }, now);
      valid.push({ index, importKey, title });
    }
    if (valid.length) {
      const persisted = await this.repository.insertMany(valid);
      this.assertResults(persisted, valid);
      results.push(...persisted);
    }
    return toBulkOutput(input.items.length, results);
  }

  private assertResults(
    results: readonly BulkTitleResult[],
    submitted: readonly BulkTitleInput[],
  ): void {
    const remaining = new Set(submitted.map((item) => item.index));
    if (
      results.length !== submitted.length ||
      results.some(
        (result) =>
          !remaining.delete(result.index) ||
          !["inserted", "duplicate", "rejected", "indeterminate"].includes(result.status),
      )
    ) {
      throw new ApplicationError(
        "INVALID_REPOSITORY_RESULT",
        "El repositorio no devolvió un resultado por cada elemento enviado.",
      );
    }
  }
}
