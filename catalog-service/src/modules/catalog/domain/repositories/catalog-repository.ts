import type { TituloCatalogo } from "../entities/catalog-title";
import type { CatalogTypeId, GenreId, PublicationStatusId } from "../models";
import type { TituloId } from "../value-objects/titulo-id";

export interface CatalogQuery {
  readonly page: number;
  readonly limit: number;
  readonly typeId?: CatalogTypeId;
  readonly publicationStatusId?: PublicationStatusId;
  readonly genreId?: GenreId;
  readonly year?: number;
  readonly q?: string;
}
export interface CatalogListItem {
  readonly tituloId: string;
  readonly typeId: CatalogTypeId;
  readonly publicationStatusId: PublicationStatusId;
  readonly ficha: {
    readonly title: string;
    readonly releaseYear: number;
    readonly genres: readonly GenreId[];
    readonly posterUrl?: string;
  };
  readonly updatedAt: Date;
}
export interface CatalogPage {
  readonly data: readonly CatalogListItem[];
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
  };
}
export interface BulkTitleInput {
  readonly index: number;
  readonly importKey: string;
  readonly title: TituloCatalogo;
}
export type BulkTitleResult =
  | { readonly index: number; readonly status: "inserted" | "duplicate"; readonly tituloId: string }
  | {
      readonly index: number;
      readonly status: "rejected";
      readonly code:
        | "IMPORT_KEY_CONFLICT"
        | "TITLE_ID_CONFLICT"
        | "DOCUMENT_TOO_LARGE"
        | "DOCUMENT_VALIDATION_FAILED"
        | "PERSISTENCE_WRITE_FAILED";
    }
  | {
      readonly index: number;
      readonly status: "indeterminate";
      readonly code: "PERSISTENCE_OUTCOME_UNKNOWN";
    };

export interface CatalogRepository {
  findById(id: TituloId): Promise<TituloCatalogo | null>;
  findPage(query: CatalogQuery): Promise<CatalogPage>;
  insertMany(items: readonly BulkTitleInput[]): Promise<readonly BulkTitleResult[]>;
  /** Guarda solo diferencias permitidas con comparación de versión. Sin reemplazos ni upsert. */
  saveChanges(previous: TituloCatalogo, next: TituloCatalogo): Promise<void>;
}
