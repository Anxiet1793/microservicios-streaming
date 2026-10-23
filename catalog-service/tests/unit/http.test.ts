import { describe, expect, it, vi } from "vitest";
import {
  bulkItemSchema,
  catalogQuerySchema,
  updateFichaSchema,
} from "../../src/modules/catalog/interfaces/http/schemas/catalog-schemas";
import { readJsonBody } from "../../src/shared/infrastructure/http/read-json-body";
import { queryObject } from "../../src/shared/infrastructure/http/parse-schema";
import { handleRequest } from "../../src/shared/infrastructure/http/handle-request";
import { presentBulk } from "../../src/modules/catalog/interfaces/http/presenters/bulk-presenter";
import { toBulkOutput } from "../../src/modules/catalog/application/mappers/bulk-result-mapper";
import { importMovie, movie } from "../helpers/fixtures";

describe("Contrato HTTP y protección de entradas", () => {
  it("rechaza operadores, campos internos e IDs como cadenas", () => {
    expect(bulkItemSchema.safeParse(importMovie()).success).toBe(true);
    for (const patch of [
      { _id: "x" },
      { publicationStatusId: 2 },
      { typeName: "MOVIE" },
      { typeId: "1" },
    ]) {
      expect(bulkItemSchema.safeParse({ ...importMovie(), ...patch }).success).toBe(false);
    }
    expect(catalogQuerySchema.safeParse({ type: { $ne: null } }).success).toBe(false);
    expect(updateFichaSchema.safeParse({ ficha: { $set: { title: "x" } } }).success).toBe(false);
    expect(updateFichaSchema.safeParse({ ficha: {} }).success).toBe(false);
    expect(() => queryObject(new Request("http://localhost/?page=1&page=2"))).toThrow();
  });

  it.each([
    ["text/plain", "{}", 415],
    ["application/json", "{", 400],
    ["application/json", "", 400],
    ["application/json", '"🌎🌎🌎"', 413],
  ])("valida tipo y bytes: %s %s", async (contentType, body, status) => {
    const request = new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });
    await expect(readJsonBody(request, 10)).rejects.toMatchObject({ status });
  });

  it("cuenta bytes reales aunque Content-Length declare menos", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('"' + "x".repeat(20) + '"'));
        controller.close();
      },
    });
    const request = new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "2" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    await expect(readJsonBody(request, 10)).rejects.toMatchObject({ status: 413 });
  });

  it("oculta errores internos y correlaciona respuesta y log", async () => {
    const logger = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await handleRequest(
      new Request("http://localhost/test?secret=x"),
      "/test",
      async () => {
        throw new Error("secret-value");
      },
    );
    const body = await response.text();
    expect(response.status).toBe(500);
    expect(body).not.toContain("secret-value");
    expect(JSON.parse(body).error.requestId).toBe(response.headers.get("x-request-id"));
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(logger.mock.calls[0]?.[0]).not.toContain("secret");
  });

  it("elige códigos HTTP según los resultados confirmados del bulk", () => {
    const tituloId = movie().tituloId;
    expect(presentBulk(toBulkOutput(1, [{ index: 0, status: "inserted", tituloId }])).status).toBe(
      201,
    );
    expect(presentBulk(toBulkOutput(1, [{ index: 0, status: "duplicate", tituloId }])).status).toBe(
      200,
    );
    expect(
      presentBulk(
        toBulkOutput(2, [
          { index: 0, status: "duplicate", tituloId },
          { index: 1, status: "rejected", code: "IMPORT_KEY_CONFLICT" },
        ]),
      ).status,
    ).toBe(207);
    expect(
      presentBulk(toBulkOutput(1, [{ index: 0, status: "rejected", code: "IMPORT_KEY_CONFLICT" }]))
        .status,
    ).toBe(409);
    expect(
      presentBulk(
        toBulkOutput(1, [
          { index: 0, status: "indeterminate", code: "PERSISTENCE_OUTCOME_UNKNOWN" },
        ]),
      ).status,
    ).toBe(503);
  });
});
