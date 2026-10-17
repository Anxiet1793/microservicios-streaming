export type CatalogErrorCode =
  | "INVALID_TITLE_ID"
  | "INVALID_CONTENT_SHEET"
  | "INVALID_PLAYBACK_REFERENCE"
  | "INVALID_PUBLICATION_TRANSITION"
  | "INVALID_CATALOG_STATE"
  | "INVALID_CATALOG_QUERY"
  | "INVALID_BULK_INPUT"
  | "CATALOG_TITLE_NOT_FOUND"
  | "CONCURRENT_MODIFICATION";

export class CatalogError extends Error {
  constructor(readonly code: CatalogErrorCode, message: string) {
    super(message);
    this.name = "CatalogError";
  }
}
