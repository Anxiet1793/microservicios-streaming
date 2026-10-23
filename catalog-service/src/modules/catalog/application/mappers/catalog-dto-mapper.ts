import {
  AGE_RATINGS,
  CATALOG_TYPES,
  GENRES,
  LANGUAGES,
  PLAYBACK_PROVIDERS,
  PUBLICATION_STATUSES,
} from "../../domain/models";
import type { TituloCatalogo } from "../../domain/entities/catalog-title";
import type { CatalogListItem, CatalogPage } from "../../domain/repositories/catalog-repository";
import type { ContentSheetData } from "../../domain/value-objects/content-sheet";
import type {
  CatalogTitleDto,
  CatalogListItemDto,
  CatalogPageDto,
  ContentSheetDto,
} from "../dto/catalog-dto";

function toContentSheetDto(ficha: ContentSheetData): ContentSheetDto {
  // Lista explícita: no propagar metadatos agregados posteriormente a la entidad.
  return {
    title: ficha.title,
    synopsis: ficha.synopsis,
    releaseYear: ficha.releaseYear,
    genres: [...ficha.genres],
    genresName: ficha.genres.map((id) => GENRES[id]),
    languages: [...ficha.languages],
    languagesName: ficha.languages.map((id) => LANGUAGES[id]),
    cast: [...(ficha.cast ?? [])],
    ...(ficha.originalTitle !== undefined ? { originalTitle: ficha.originalTitle } : {}),
    ...(ficha.durationMinutes !== undefined ? { durationMinutes: ficha.durationMinutes } : {}),
    ...(ficha.ageRatingId !== undefined
      ? { ageRatingId: ficha.ageRatingId, ageRatingName: AGE_RATINGS[ficha.ageRatingId] }
      : {}),
    ...(ficha.posterUrl !== undefined ? { posterUrl: ficha.posterUrl } : {}),
    ...(ficha.backdropUrl !== undefined ? { backdropUrl: ficha.backdropUrl } : {}),
    ...(ficha.director !== undefined ? { director: ficha.director } : {}),
  };
}

export function toCatalogTitleDto(title: TituloCatalogo): CatalogTitleDto {
  const state = title.snapshot();
  const reference = state.playbackReference;
  return {
    tituloId: state.tituloId,
    typeId: state.typeId,
    typeName: CATALOG_TYPES[state.typeId],
    ficha: toContentSheetDto(state.ficha),
    publicationStatusId: state.publicationStatusId,
    publicationStatusName: PUBLICATION_STATUSES[state.publicationStatusId],
    playbackReference: reference
      ? {
          providerId: reference.providerId,
          providerName: PLAYBACK_PROVIDERS[reference.providerId],
          assetId: reference.assetId,
          manifestKey: reference.manifestKey,
        }
      : null,
    createdAt: state.createdAt.toISOString(),
    updatedAt: state.updatedAt.toISOString(),
  };
}

function toCatalogListItemDto(item: CatalogListItem): CatalogListItemDto {
  return {
    tituloId: item.tituloId,
    typeId: item.typeId,
    typeName: CATALOG_TYPES[item.typeId],
    publicationStatusId: item.publicationStatusId,
    publicationStatusName: PUBLICATION_STATUSES[item.publicationStatusId],
    updatedAt: item.updatedAt.toISOString(),
    ficha: {
      title: item.ficha.title,
      releaseYear: item.ficha.releaseYear,
      genres: [...item.ficha.genres],
      genresName: item.ficha.genres.map((id) => GENRES[id]),
      ...(item.ficha.posterUrl !== undefined ? { posterUrl: item.ficha.posterUrl } : {}),
    },
  };
}

export function toCatalogPageDto(page: CatalogPage): CatalogPageDto {
  return {
    data: page.data.map(toCatalogListItemDto),
    pagination: {
      page: page.pagination.page,
      limit: page.pagination.limit,
      total: page.pagination.total,
      totalPages: page.pagination.totalPages,
    },
  };
}
