import { changePublicationStatus } from "../../../../../../modules/catalog/interfaces/http/handlers/catalog-handlers";
import {
  methodNotAllowed,
  optionsHandler,
} from "../../../../../../shared/infrastructure/http/method-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const PATCH = changePublicationStatus;
export const OPTIONS = optionsHandler(
  "/api/v1/catalog/{tituloId}/publication-status",
  "PATCH, OPTIONS",
);
const unsupported = methodNotAllowed(
  "/api/v1/catalog/{tituloId}/publication-status",
  "PATCH, OPTIONS",
);
export {
  unsupported as GET,
  unsupported as HEAD,
  unsupported as POST,
  unsupported as PUT,
  unsupported as DELETE,
};
