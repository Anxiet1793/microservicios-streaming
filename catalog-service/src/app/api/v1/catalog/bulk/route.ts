import { bulkCreate } from "../../../../../modules/catalog/interfaces/http/handlers/catalog-handlers";
import { methodNotAllowed, optionsHandler } from "../../../../../shared/infrastructure/http/method-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = bulkCreate;
export const OPTIONS = optionsHandler("/api/v1/catalog/bulk", "POST, OPTIONS");
const unsupported = methodNotAllowed("/api/v1/catalog/bulk", "POST, OPTIONS");
export { unsupported as GET, unsupported as HEAD, unsupported as PATCH, unsupported as PUT, unsupported as DELETE };
