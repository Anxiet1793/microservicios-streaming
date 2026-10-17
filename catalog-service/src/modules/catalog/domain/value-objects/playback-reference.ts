import { PLAYBACK_PROVIDERS, type PlaybackProviderId } from "../models";
import { CATALOG_LIMITS as L } from "../limits";
import { CatalogError } from "../errors/catalog-error";

export interface PlaybackReferenceData {
  readonly providerId: PlaybackProviderId;
  readonly assetId: string;
  readonly manifestKey: string;
}

export class ReferenciaReproduccion {
  private constructor(readonly data: PlaybackReferenceData) { Object.freeze(this); }

  static create(value: PlaybackReferenceData): ReferenciaReproduccion {
    if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).some(key => !["providerId", "assetId", "manifestKey"].includes(key))
      || typeof value.providerId !== "number" || !Object.hasOwn(PLAYBACK_PROVIDERS, value.providerId)
      || typeof value.assetId !== "string" || !value.assetId.trim() || [...value.assetId.trim()].length > L.assetIdLength
      || typeof value.manifestKey !== "string" || !value.manifestKey.trim() || [...value.manifestKey.trim()].length > L.urlLength) {
      throw new CatalogError("INVALID_PLAYBACK_REFERENCE", "La referencia técnica no es válida.");
    }
    return new ReferenciaReproduccion(Object.freeze({
      providerId: value.providerId,
      assetId: value.assetId.trim(),
      manifestKey: value.manifestKey.trim(),
    }));
  }
}
