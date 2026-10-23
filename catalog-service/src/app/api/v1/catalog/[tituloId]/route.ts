import {
  getCatalogTitle,
  updateCatalogTitle,
} from "../../../../../modules/catalog/interfaces/http/handlers/catalog-handlers";
import {
  methodNotAllowed,
  optionsHandler,
} from "../../../../../shared/infrastructure/http/method-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = getCatalogTitle;
export const HEAD = getCatalogTitle;
export const PATCH = updateCatalogTitle;
export const OPTIONS = optionsHandler("/api/v1/catalog/{tituloId}", "GET, HEAD, PATCH, OPTIONS");
const unsupported = methodNotAllowed("/api/v1/catalog/{tituloId}", "GET, HEAD, PATCH, OPTIONS");
export { unsupported as POST, unsupported as PUT, unsupported as DELETE };
