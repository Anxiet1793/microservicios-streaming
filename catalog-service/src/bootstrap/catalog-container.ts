import { readEnvironment } from "../shared/infrastructure/config/environment";
import { getMongoDatabase } from "../shared/infrastructure/mongodb/connection";
import type { CatalogRepository } from "../modules/catalog/domain/repositories/catalog-repository";
import { MongoCatalogRepository } from "../modules/catalog/infrastructure/persistence/mongodb/repositories/mongo-catalog-repository";
import { BulkCreateCatalogTitles } from "../modules/catalog/application/use-cases/bulk-create-catalog-titles";
import { GetCatalogTitles } from "../modules/catalog/application/use-cases/get-catalog-titles";
import { GetCatalogTitleById } from "../modules/catalog/application/use-cases/get-catalog-title-by-id";
import { UpdateCatalogTitle } from "../modules/catalog/application/use-cases/update-catalog-title";
import { ChangePublicationStatus } from "../modules/catalog/application/use-cases/change-publication-status";
import { SystemClock } from "../modules/catalog/infrastructure/runtime/system-clock";
import { UuidTitleIdGenerator } from "../modules/catalog/infrastructure/runtime/uuid-title-id-generator";
import type { Clock } from "../modules/catalog/application/ports/clock";
import type { TitleIdGenerator } from "../modules/catalog/application/ports/title-id-generator";

/** Composición diferida; importar este módulo no abre conexiones. */
export async function createCatalogRepository(): Promise<CatalogRepository> {
  const config = readEnvironment();
  return new MongoCatalogRepository(
    await getMongoDatabase(config),
    config.MONGODB_QUERY_TIMEOUT_MS,
    config.BULK_MAX_ITEMS,
  );
}

export interface CatalogDependencies {
  readonly repository: CatalogRepository;
  readonly clock: Clock;
  readonly idGenerator: TitleIdGenerator;
  readonly maxBulkItems: number;
}

export function composeCatalogUseCases(dependencies: CatalogDependencies) {
  const { repository, clock, idGenerator, maxBulkItems } = dependencies;
  return Object.freeze({
    bulkCreateCatalogTitles: new BulkCreateCatalogTitles(
      repository,
      idGenerator,
      clock,
      maxBulkItems,
    ),
    getCatalogTitles: new GetCatalogTitles(repository),
    getCatalogTitleById: new GetCatalogTitleById(repository),
    updateCatalogTitle: new UpdateCatalogTitle(repository, clock),
    changePublicationStatus: new ChangePublicationStatus(repository, clock),
  });
}

export async function createCatalogUseCases() {
  const config = readEnvironment();
  return composeCatalogUseCases({
    repository: new MongoCatalogRepository(
      await getMongoDatabase(config),
      config.MONGODB_QUERY_TIMEOUT_MS,
      config.BULK_MAX_ITEMS,
    ),
    clock: new SystemClock(),
    idGenerator: new UuidTitleIdGenerator(),
    maxBulkItems: config.BULK_MAX_ITEMS,
  });
}
