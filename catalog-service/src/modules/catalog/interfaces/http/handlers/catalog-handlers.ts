import { z } from "zod";
import { createCatalogUseCases } from "../../../../../bootstrap/catalog-container";
import { readEnvironment } from "../../../../../shared/infrastructure/config/environment";
import { handleRequest } from "../../../../../shared/infrastructure/http/handle-request";
import { readJsonBody } from "../../../../../shared/infrastructure/http/read-json-body";
import { parseSchema, queryObject, validationIssues } from "../../../../../shared/infrastructure/http/parse-schema";
import { HttpError } from "../../../../../shared/infrastructure/http/http-error";
import { normalizeCatalogQuery } from "../../../domain/repositories/catalog-query";
import type { BulkItemResult, UpdateCatalogTitleInput } from "../../../application/dto/catalog-dto";
import { toBulkOutput } from "../../../application/mappers/bulk-result-mapper";
import { bulkEnvelopeSchema, bulkItemSchema, catalogQuerySchema, publicationStatusSchema, tituloIdSchema, updateFichaSchema } from "../schemas/catalog-schemas";
import { presentBulk } from "../presenters/bulk-presenter";

export interface TitleRouteContext { params: Promise<{ tituloId: string }> }
const emptyQuery = z.strictObject({});
const path = "/api/v1/catalog";

export function getCatalog(request: Request): Promise<Response> {
  return handleRequest(request, path, async () => {
    const query = parseSchema(catalogQuerySchema, queryObject(request));
    const input = normalizeCatalogQuery({
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.limit !== undefined ? { limit: query.limit } : {}),
      ...(query.type !== undefined ? { typeId: query.type } : {}),
      ...(query.status !== undefined ? { publicationStatusId: query.status } : {}),
      ...(query.genre !== undefined ? { genreId: query.genre } : {}),
      ...(query.year !== undefined ? { year: query.year } : {}),
      ...(query.q !== undefined ? { q: query.q } : {}),
    });
    return Response.json(await (await createCatalogUseCases()).getCatalogTitles.execute(input));
  });
}

export function bulkCreate(request: Request): Promise<Response> {
  return handleRequest(request, `${path}/bulk`, async () => {
    parseSchema(emptyQuery, queryObject(request));
    const config = readEnvironment();
    const body = parseSchema(bulkEnvelopeSchema(config.BULK_MAX_ITEMS), await readJsonBody(request, config.REQUEST_MAX_BYTES));
    const valid: { index: number; item: z.output<typeof bulkItemSchema> }[] = [];
    const rejected: BulkItemResult[] = [];
    body.items.forEach((item, index) => {
      const result = bulkItemSchema.safeParse(item);
      if (result.success) valid.push({ index, item: result.data });
      else {
        // Detalles de campos por registro, sin repetir el payload original.
        const failure = { index, status: "rejected" as const, code: "VALIDATION_ERROR" as const, issues: validationIssues(result.error) };
        rejected.push(failure);
      }
    });
    if (!valid.length) return presentBulk(toBulkOutput(body.items.length, rejected));
    const outcome = await (await createCatalogUseCases()).bulkCreateCatalogTitles.execute({ items: valid.map(entry => entry.item) });
    const results = outcome.results.map(result => {
      const original = valid[result.index];
      if (!original) throw new HttpError(500, "INTERNAL_SERVER_ERROR", "No se pudo completar la operación.");
      return { ...result, index: original.index };
    });
    return presentBulk(toBulkOutput(body.items.length, [...rejected, ...results]));
  });
}

async function titleId(request: Request, context: TitleRouteContext): Promise<string> {
  parseSchema(emptyQuery, queryObject(request));
  return parseSchema(tituloIdSchema, (await context.params).tituloId);
}

export function getCatalogTitle(request: Request, context: TitleRouteContext): Promise<Response> {
  return handleRequest(request, `${path}/{tituloId}`, async () => {
    const tituloId = await titleId(request, context);
    return Response.json(await (await createCatalogUseCases()).getCatalogTitleById.execute({ tituloId }));
  });
}

export function updateCatalogTitle(request: Request, context: TitleRouteContext): Promise<Response> {
  return handleRequest(request, `${path}/{tituloId}`, async () => {
    const tituloId = await titleId(request, context);
    const body = parseSchema(updateFichaSchema, await readJsonBody(request, readEnvironment().REQUEST_MAX_BYTES));
    // JSON no contiene undefined; Zod permite opcionales que el DTO representa ausentes.
    const ficha = body.ficha as UpdateCatalogTitleInput["ficha"];
    return Response.json(await (await createCatalogUseCases()).updateCatalogTitle.execute({ tituloId, ficha }));
  });
}

export function changePublicationStatus(request: Request, context: TitleRouteContext): Promise<Response> {
  return handleRequest(request, `${path}/{tituloId}/publication-status`, async () => {
    const tituloId = await titleId(request, context);
    const body = parseSchema(publicationStatusSchema, await readJsonBody(request, readEnvironment().REQUEST_MAX_BYTES));
    return Response.json(await (await createCatalogUseCases()).changePublicationStatus.execute({ tituloId, ...body }));
  });
}
