import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import SwaggerParser from "@apidevtools/swagger-parser";
import { parse } from "yaml";
import {
  AGE_RATINGS,
  CATALOG_TYPES,
  GENRES,
  LANGUAGES,
  PUBLICATION_STATUSES,
} from "../src/modules/catalog/domain/models";
import {
  bulkEnvelopeSchema,
  bulkItemSchema,
} from "../src/modules/catalog/interfaces/http/schemas/catalog-schemas";

const api = await SwaggerParser.validate("docs/openapi.yaml");
const contract = parse(await readFile("docs/openapi.yaml", "utf8")) as {
  components: { schemas: Record<string, { enum?: number[] }> };
};
for (const [name, dictionary] of Object.entries({
  TypeId: CATALOG_TYPES,
  PublicationStatusId: PUBLICATION_STATUSES,
  GenreId: GENRES,
  LanguageId: LANGUAGES,
  AgeRatingId: AGE_RATINGS,
})) {
  assert.deepEqual(
    contract.components.schemas[name]?.enum,
    Object.keys(dictionary).map(Number),
    `Equivalencias desactualizadas en ${name}`,
  );
}
const operations = Object.entries(api.paths ?? {}).flatMap(([path, item]) =>
  Object.keys(item ?? {})
    .filter((method) => ["get", "post", "patch"].includes(method))
    .map((method) => `${method.toUpperCase()} ${path}`),
);
assert.deepEqual(
  operations.sort(),
  [
    "GET /api/health",
    "GET /api/v1/catalog",
    "GET /api/v1/catalog/{tituloId}",
    "POST /api/v1/catalog/bulk",
    "PATCH /api/v1/catalog/{tituloId}",
    "PATCH /api/v1/catalog/{tituloId}/publication-status",
  ].sort(),
);
const sample = bulkEnvelopeSchema(500).parse(
  JSON.parse(await readFile("examples/catalog.bulk.json", "utf8")),
);
sample.items.forEach((item) => bulkItemSchema.parse(item));
assert.equal(sample.items.length, 5);
console.log(
  JSON.stringify({
    event: "openapi_validated",
    operations: operations.length,
    exampleItems: sample.items.length,
  }),
);
