import { pingMongo } from "../mongodb/connection";
import { handleRequest } from "./handle-request";

export function getHealth(request: Request): Promise<Response> {
  return handleRequest(request, "/api/health", async () => {
    await pingMongo();
    return Response.json({ status: "ok", service: "catalog-service" });
  });
}
