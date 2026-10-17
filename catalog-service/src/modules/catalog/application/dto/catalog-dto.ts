import type { CatalogTypeId, PublicationStatusId } from "../../domain/models";
import type { CatalogQuery, BulkTitleResult } from "../../domain/repositories/catalog-repository";
import type { ContentSheetData, ContentSheetPatch } from "../../domain/value-objects/content-sheet";
import type { PlaybackReferenceData } from "../../domain/value-objects/playback-reference";
import type { CatalogErrorCode } from "../../domain/errors/catalog-error";

export interface CreateCatalogTitleDto {
  readonly importKey: string;
  readonly typeId: CatalogTypeId;
  readonly ficha: ContentSheetData;
  /** Una serie puede omitirla; se normaliza a null. Obligatoria para películas. */
  readonly playbackReference?: PlaybackReferenceData | null;
}
export interface BulkCreateCatalogInput {
  /** Se valida cada elemento por separado para permitir resultados parciales. */
  readonly items: readonly unknown[];
}
export type GetCatalogTitlesInput = Partial<CatalogQuery>;
export interface GetCatalogTitleInput { readonly tituloId: string }
export interface UpdateCatalogTitleInput extends GetCatalogTitleInput { readonly ficha: ContentSheetPatch }
export interface ChangePublicationStatusInput extends GetCatalogTitleInput { readonly publicationStatusId: PublicationStatusId }

export interface ContentSheetDto extends ContentSheetData {
  readonly genresName: readonly string[];
  readonly languagesName: readonly string[];
  readonly ageRatingName?: string;
}
export interface PlaybackReferenceDto extends PlaybackReferenceData { readonly providerName: string }
export interface CatalogTitleDto {
  readonly tituloId: string;
  readonly typeId: CatalogTypeId;
  readonly typeName: string;
  readonly ficha: ContentSheetDto;
  readonly publicationStatusId: PublicationStatusId;
  readonly publicationStatusName: string;
  readonly playbackReference: PlaybackReferenceDto | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
export type CatalogListItemDto = Pick<CatalogTitleDto, "tituloId" | "typeId" | "typeName" | "publicationStatusId" | "publicationStatusName" | "updatedAt"> & {
  readonly ficha: Pick<ContentSheetDto, "title" | "releaseYear" | "genres" | "genresName" | "posterUrl">;
};
export interface CatalogPageDto {
  readonly data: readonly CatalogListItemDto[];
  readonly pagination: { readonly page: number; readonly limit: number; readonly total: number; readonly totalPages: number };
}

export type BulkItemResult = BulkTitleResult | {
  readonly index: number;
  readonly status: "rejected";
  readonly code: CatalogErrorCode | "VALIDATION_ERROR";
};
export interface BulkCreateCatalogOutput {
  /** Duplicados equivalentes son aceptables; rechazados/indeterminados hacen false. */
  readonly success: boolean;
  readonly summary: {
    readonly received: number;
    readonly inserted: number;
    readonly duplicates: number;
    readonly failed: number;
    readonly indeterminate: number;
  };
  readonly results: readonly BulkItemResult[];
  readonly errors: readonly { readonly index: number; readonly code: string }[];
}
