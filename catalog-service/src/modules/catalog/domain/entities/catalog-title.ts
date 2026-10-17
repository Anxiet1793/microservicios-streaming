import { CATALOG_TYPES, type CatalogTypeId, type PublicationStatusId } from "../models";
import { CatalogError } from "../errors/catalog-error";
import { CATALOG_LIMITS } from "../limits";
import { TituloId } from "../value-objects/titulo-id";
import { FichaContenido, type ContentSheetData, type ContentSheetPatch } from "../value-objects/content-sheet";
import { EstadoPublicacion } from "../value-objects/publication-status";
import { ReferenciaReproduccion, type PlaybackReferenceData } from "../value-objects/playback-reference";

export interface CatalogTitleState {
  readonly tituloId: string;
  readonly typeId: CatalogTypeId;
  readonly ficha: ContentSheetData;
  readonly publicationStatusId: PublicationStatusId;
  readonly playbackReference: PlaybackReferenceData | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}
export type RegisterCatalogTitle = Pick<CatalogTitleState, "tituloId" | "typeId" | "ficha" | "playbackReference">;

/** Agregado inmutable: cada cambio válido devuelve una nueva instancia. */
export class TituloCatalogo {
  private readonly state: CatalogTitleState;

  private constructor(value: CatalogTitleState) {
    if (typeof value.typeId !== "number" || !Object.hasOwn(CATALOG_TYPES, value.typeId)
      || !(value.createdAt instanceof Date) || !Number.isFinite(value.createdAt.getTime())
      || !(value.updatedAt instanceof Date) || !Number.isFinite(value.updatedAt.getTime())
      || value.updatedAt < value.createdAt || !Number.isInteger(value.version)
      || value.version < 1 || value.version > CATALOG_LIMITS.maxVersion) {
      throw new CatalogError("INVALID_CATALOG_STATE", "Estado de título inválido.");
    }
    const reference = value.playbackReference === null ? null : ReferenciaReproduccion.create(value.playbackReference).data;
    if ((value.typeId === 1 && !reference) || (value.typeId === 2 && reference)) {
      throw new CatalogError("INVALID_PLAYBACK_REFERENCE", "Una película requiere referencia; una serie no admite referencia propia.");
    }
    this.state = Object.freeze({
      tituloId: TituloId.from(value.tituloId).value,
      typeId: value.typeId,
      ficha: FichaContenido.create(value.typeId, value.ficha).data,
      publicationStatusId: EstadoPublicacion.from(value.publicationStatusId).id,
      playbackReference: reference,
      createdAt: new Date(value.createdAt),
      updatedAt: new Date(value.updatedAt),
      version: value.version,
    });
    Object.freeze(this);
  }

  static register(input: RegisterCatalogTitle, now: Date): TituloCatalogo {
    return new TituloCatalogo({ ...input, publicationStatusId: 1, createdAt: now, updatedAt: now, version: 1 });
  }

  static rehydrate(state: CatalogTitleState): TituloCatalogo { return new TituloCatalogo(state); }

  get tituloId(): string { return this.state.tituloId; }
  get version(): number { return this.state.version; }

  snapshot(): CatalogTitleState {
    return { ...this.state, createdAt: new Date(this.state.createdAt), updatedAt: new Date(this.state.updatedAt) };
  }

  updateFicha(patch: ContentSheetPatch, now: Date): TituloCatalogo {
    const ficha = FichaContenido.create(this.state.typeId, this.state.ficha).patch(this.state.typeId, patch).data;
    if (JSON.stringify(ficha) === JSON.stringify(this.state.ficha)) return this;
    return this.change({ ficha }, now);
  }

  changePublicationStatus(statusId: PublicationStatusId, now: Date): TituloCatalogo {
    const status = EstadoPublicacion.from(this.state.publicationStatusId).transitionTo(statusId);
    if (status.id === this.state.publicationStatusId) return this;
    return this.change({ publicationStatusId: status.id }, now);
  }

  private change(changes: Partial<Pick<CatalogTitleState, "ficha" | "publicationStatusId">>, now: Date): TituloCatalogo {
    if (!(now instanceof Date) || now < this.state.updatedAt) {
      throw new CatalogError("INVALID_CATALOG_STATE", "La fecha de modificación no puede retroceder.");
    }
    return new TituloCatalogo({ ...this.state, ...changes, updatedAt: now, version: this.state.version + 1 });
  }
}
