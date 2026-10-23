import { route } from "../../../../../../../shared/http";
import {
  addWatchlist,
  removeWatchlist,
} from "../../../../../../../modules/users/interfaces/http/handlers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const endpoint = route("/api/v1/users/me/watchlist/{tituloId}", {
  POST: addWatchlist,
  DELETE: removeWatchlist,
});
export const GET = endpoint.GET;
export const POST = endpoint.POST;
export const PATCH = endpoint.PATCH;
export const PUT = endpoint.PUT;
export const DELETE = endpoint.DELETE;
export const HEAD = endpoint.HEAD;
export const OPTIONS = endpoint.OPTIONS;
