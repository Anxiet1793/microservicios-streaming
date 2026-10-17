import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
const values = `MONGODB_URI=mongodb://127.0.0.1:27019/?replicaSet=rs0&directConnection=true
MONGODB_DATABASE=playback_service
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=playback-local
MINIO_SECRET_KEY=${randomBytes(32).toString("hex")}
MINIO_BUCKET=streaming-media
MINIO_PUBLIC_URL=http://localhost:9000
PLAYBACK_URL_TTL=900
CATALOG_SERVICE_URL=http://127.0.0.1:3000
USERS_JWKS_URL=http://127.0.0.1:3001/.well-known/jwks.json
JWT_ISSUER=users-service
JWT_AUDIENCE=streaming-services
APP_ORIGIN=http://localhost:3002
MAX_UPLOAD_BYTES=268435456
UPLOAD_LIMIT_PER_HOUR=10
FFPROBE_PATH=ffprobe
`;
try { await writeFile(".env", values, { flag: "wx", mode: 0o600 }); console.log("Entorno local creado; no se muestran credenciales."); }
catch (e) { if (e && typeof e === "object" && "code" in e && e.code === "EEXIST") console.log("Se conserva el entorno existente."); else throw e; }
