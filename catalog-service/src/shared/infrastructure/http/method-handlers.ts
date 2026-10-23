import { handleRequest } from "./handle-request";
import { HttpError } from "./http-error";

export function methodNotAllowed(endpoint: string, allow: string) {
  return async (request: Request): Promise<Response> => {
    const response = await handleRequest(request, endpoint, async () => {
      throw new HttpError(405, "METHOD_NOT_ALLOWED", "Método no permitido para esta ruta.");
    });
    response.headers.set("allow", allow);
    return response;
  };
}

export function optionsHandler(endpoint: string, allow: string) {
  return (request: Request) =>
    handleRequest(
      request,
      endpoint,
      async () => new Response(null, { status: 204, headers: { allow } }),
    );
}
