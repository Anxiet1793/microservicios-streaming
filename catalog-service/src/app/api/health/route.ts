import { getHealth } from "../../../shared/infrastructure/http/health-handler";
import {
  methodNotAllowed,
  optionsHandler,
} from "../../../shared/infrastructure/http/method-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = getHealth;
export const HEAD = getHealth;
export const OPTIONS = optionsHandler("/api/health", "GET, HEAD, OPTIONS");
const unsupported = methodNotAllowed("/api/health", "GET, HEAD, OPTIONS");
export { unsupported as POST, unsupported as PATCH, unsupported as PUT, unsupported as DELETE };
