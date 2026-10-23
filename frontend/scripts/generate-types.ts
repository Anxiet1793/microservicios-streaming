import { readFile, writeFile, mkdir } from "node:fs/promises";
import openapiTS, { astToString } from "openapi-typescript";
await mkdir("src/types/generated", { recursive: true });
for (const service of ["users", "catalog", "playback"]) {
  const source = await readFile(`../${service}-service/docs/openapi.yaml`, "utf8");
  await writeFile(`src/types/generated/${service}.ts`, astToString(await openapiTS(source)));
}
console.log("Tipos generados desde los tres OpenAPI locales.");
