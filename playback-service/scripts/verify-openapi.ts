import SwaggerParser from "@apidevtools/swagger-parser";
const document = await SwaggerParser.validate("docs/openapi.yaml");
const operations = Object.values(document.paths ?? {}).reduce((n, p) => n + Object.keys(p ?? {}).filter(k => ["get", "post", "patch", "delete", "put"].includes(k)).length, 0);
if (operations !== 12) throw new Error(`Expected 12 operations, received ${operations}`);
console.log(`OpenAPI válido: ${operations} operaciones.`);
