import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import SwaggerParser from "@apidevtools/swagger-parser";
import { parse } from "yaml";
import { registerSchema, loginSchema, profileSchema, changePasswordSchema, preferenceSchema } from "../src/modules/users/interfaces/http/schemas";
import { TITLE_ID, USER_ID } from "../src/modules/users/domain/user";
await SwaggerParser.validate("docs/openapi.yaml");
const spec = parse(await readFile("docs/openapi.yaml", "utf8")) as { paths: Record<string, Record<string, { requestBody?: { content: { "application/json": { example: unknown } } } }>>; components: { schemas: Record<string, { pattern?: string }> } };
const operations = Object.values(spec.paths).flatMap(p => Object.keys(p).filter(m => ["get", "post", "put", "delete", "patch"].includes(m)));
assert.equal(operations.length, 15);
assert.equal(spec.components.schemas.TituloId!.pattern, TITLE_ID.source);
assert.equal(spec.components.schemas.UserId!.pattern, USER_ID.source);
for (const [path, method, schema] of [
  ["/api/v1/auth/register", "post", registerSchema], ["/api/v1/auth/login", "post", loginSchema],
  ["/api/v1/users/me", "patch", profileSchema], ["/api/v1/users/me/change-password", "post", changePasswordSchema],
  ["/api/v1/users/me/preferences/{tituloId}", "put", preferenceSchema],
] as const) schema.parse(spec.paths[path]![method]!.requestBody!.content["application/json"].example);
console.log(JSON.stringify({ event: "openapi_validated", operations: operations.length, examples: 5 }));
