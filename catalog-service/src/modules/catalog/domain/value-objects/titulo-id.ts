import { CatalogError } from "../errors/catalog-error";

export const TITLE_ID_PATTERN = /^ttl_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const EPISODE_ID_PATTERN = /^ep_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class TituloId {
  private constructor(readonly value: string) { Object.freeze(this); }

  static from(value: string): TituloId {
    if (typeof value !== "string" || !TITLE_ID_PATTERN.test(value)) {
      throw new CatalogError("INVALID_TITLE_ID", "TituloId debe contener el prefijo ttl_ y un UUID v4 válido.");
    }
    return new TituloId(value);
  }
}
