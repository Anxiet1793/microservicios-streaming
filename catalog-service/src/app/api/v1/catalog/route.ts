import { getCatalog } from "../../../../modules/catalog/interfaces/http/handlers/catalog-handlers";
import { methodNotAllowed, optionsHandler } from "../../../../shared/infrastructure/http/method-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = getCatalog;
export const HEAD = getCatalog;
export const OPTIONS = optionsHandler("/api/v1/catalog", "GET, HEAD, OPTIONS");
const unsupported = methodNotAllowed("/api/v1/catalog", "GET, HEAD, OPTIONS");
export { unsupported as POST, unsupported as PATCH, unsupported as PUT, unsupported as DELETE };
