import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
let output =
  "# Contratos contrastados\n\n17/10/2026. Fuentes: YAML, Route Handlers, validadores y Compose locales. No hay repositorio Git inicializado; se identifica cada YAML mediante SHA-256. Los tipos generados proceden de estos archivos.\n\n";
for (const service of ["users", "catalog", "playback"]) {
  const text = await readFile(`../${service}-service/docs/openapi.yaml`, "utf8");
  output += `## ${service}-service\n\nSHA-256: \`${createHash("sha256").update(text).digest("hex")}\`\n\n| Método | Ruta | operationId |\n|---|---|---|\n`;
  let path = "",
    method = "";
  for (const line of text.split(/\r?\n/)) {
    const p = /^ {2}(\/[^:]+):/.exec(line);
    if (p) path = p[1]!;
    const m = /^ {4}(get|post|patch|put|delete):/.exec(line);
    if (m) method = m[1]!.toUpperCase();
    const operation = /^ {6}operationId: (.+)/.exec(line);
    if (operation) output += `| ${method} | \`${path}\` | ${operation[1]} |\n`;
  }
  output += "\n";
}
output +=
  "## Decisiones verificadas\n\n- Users usa cookie users_refresh, Path=/api/v1/auth, HttpOnly/SameSite Strict; refresh/logout server-to-server requieren X-CSRF-Protection: 1 sin Origin. El BFF conserva esa cookie solo en servidor.\n- Login entrega expiresIn y user; refresh rota cookie y access. GET users/me confirma rol/estado en cada operación BFF.\n- Catalog usa type=1/2, status=1/2/3 y códigos numéricos de géneros/idiomas. Consumidor fuerza status=2 y filtra detalle publicado en servidor.\n- Catalog PATCH solo ficha; playbackReference se asigna al crear. providerId=1 y manifestKey opaco asset:ast_UUID por compatibilidad.\n- Listas Users usan items; Catalog/Playback usan data. Todas tienen pagination. La composición conserva referencias y errores por ficha.\n- Playback usa progress.positionSeconds, playback.url y playback.expiresIn. No se calcula duración desde el navegador para persistir.\n- Publicación exige ADMIN en BFF y comprobación de asset READY. Catalog queda sin puerto publicado en el arranque integrado.\n\n## Evidencia de ejecución\n\nLos recorridos ejecutados, sus límites y las comprobaciones de navegador están en verification.md. Contrato contrastado no implica que cada error posible de cada operación haya sido inyectado. Health/JWKS permanecen como infraestructura; el frontend no expone claves privadas.\n";
await mkdir("docs", { recursive: true });
await writeFile("docs/contracts.md", output);
console.log("Informe de contratos generado sin datos sensibles.");
