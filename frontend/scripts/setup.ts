import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
try {
  await writeFile(
    ".env",
    `USERS_SERVICE_URL=http://127.0.0.1:3001\nCATALOG_SERVICE_URL=http://127.0.0.1:3000\nPLAYBACK_SERVICE_URL=http://127.0.0.1:3002\nREDIS_URL=redis://127.0.0.1:6380\nAPP_ORIGIN=http://localhost:3003\nMEDIA_ORIGIN=http://localhost:9000\nSESSION_SECRET=${randomBytes(32).toString("hex")}\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log("Entorno local creado; no se muestran secretos.");
} catch (e) {
  if (e && typeof e === "object" && "code" in e && e.code === "EEXIST")
    console.log("Se conserva el entorno existente.");
  else throw e;
}
