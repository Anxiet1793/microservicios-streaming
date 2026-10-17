import { openAsBlob } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { basename } from "node:path";
import { randomUUID } from "node:crypto";
// Development helper: uses the seeded admin password without exposing it or tokens.
const file = process.argv[2];
if (!file) throw new Error("Uso: node --import tsx scripts/prepare-demo.ts ruta/exposicion.mp4");
const local = parseEnv(await readFile("../users-service/.env", "utf8"));
if (local.APP_ENV !== "development" || !local.SEED_PASSWORD) throw new Error("Solo disponible con el seed local de Users.");
async function request(url: string, options?: RequestInit) { const r = await fetch(url, options); if (!r.ok) throw new Error(`Demo HTTP ${r.status}`); return r.json(); }
const login = await request("http://127.0.0.1:3001/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "admin@streaming.local", password: local.SEED_PASSWORD }) });
if (login.user.role !== "ADMIN") throw new Error("Se requiere administrador del seed local.");
const form = new FormData(); form.append("file", await openAsBlob(file, { type: "video/mp4" }), basename(file));
const uploaded = await request("http://127.0.0.1:3002/api/v1/media/assets", { method: "POST", headers: { Authorization: `Bearer ${login.accessToken}` }, body: form });
const assetId = uploaded.asset.assetId;
const imported = await request("http://127.0.0.1:3000/api/v1/catalog/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ importKey: `playback-demo-${randomUUID()}`, typeId: 1, ficha: { title: "Exposición académica", synopsis: "Video propio de demostración de la plataforma.", releaseYear: 2026, genres: [10], languages: [1], durationMinutes: Math.max(1, Math.ceil(uploaded.asset.durationSeconds / 60)) }, playbackReference: { providerId: 1, assetId, manifestKey: `asset:${assetId}` } }] }) });
const tituloId = imported.results[0]?.tituloId; if (!tituloId) throw new Error("Catálogo no aceptó el título demo.");
await request(`http://127.0.0.1:3000/api/v1/catalog/${tituloId}/publication-status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicationStatusId: 2 }) });
await writeFile("docs/demo-local.json", JSON.stringify({ assetId, tituloId, player: "http://localhost:3002/demo.html" }, null, 2) + "\n");
console.log(JSON.stringify({ assetId, tituloId, player: "http://localhost:3002/demo.html" }));
