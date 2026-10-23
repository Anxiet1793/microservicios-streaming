# Playback Service

Microservicio del Bounded Context Reproducción. Administra MP4, sesiones, progreso, continuar viendo, historial y eventos outbox. Usuarios, Catálogo y Recomendaciones conservan sus propios datos.

## Inicio con Docker

Requiere Docker Desktop con contenedores Linux. Users debe estar en 3001 y Catalog en 3000 para reproducir títulos reales.

```powershell
cd "C:\Users\Administrador\Desktop\microservicios streaming\playback-service"
docker run --rm -v "${PWD}:/app" -w /app node:24-bookworm-slim node scripts/setup-dev.ts
docker compose up --build -d --wait
curl.exe http://localhost:3002/api/health
```

Setup genera credenciales locales aleatorias sin sobrescribir `.env`. Compose inicia MongoDB replica set, MinIO, inicialización idempotente y API. API y MinIO no ejecutan como root. Mongo está en una red interna; los puertos publicados se limitan a loopback.

| Recurso            | Dirección                                     |
| ------------------ | --------------------------------------------- |
| API                | http://localhost:3002                         |
| Reproductor demo   | http://localhost:3002/demo.html               |
| MinIO S3 / consola | http://localhost:9000 / http://localhost:9001 |
| MongoDB local      | 127.0.0.1:27019                               |

MinIO se compila desde el commit oficial `9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a` (release 2025-10-15). Las imágenes históricas oficiales consultadas ya no se pudieron descargar. El primer build tarda más por Go/FFmpeg. Ver [decisión y fuentes](docs/architecture.md). No requiere cuenta comercial ni imágenes de terceros.

## Stack y estructura

Node 24, TypeScript, Next App Router, driver oficial MongoDB, MinIO SDK, Busboy, ffprobe, Zod, jose/JWKS, Vitest y logs JSON. Versiones exactas en `package-lock.json`; instalar con `npm ci`.

```text
playback-service/
├── src/app/api/health/route.ts
├── src/app/api/v1/media/assets/[assetId]/route.ts
├── src/app/api/v1/playback/
│   ├── sessions/[sessionId]/{progress,pause,resume,complete,refresh-url}/route.ts
│   └── me/{continue-watching,history}/route.ts
├── src/modules/playback/
│   ├── domain/model.ts
│   ├── application/{ports,use-cases}.ts
│   ├── infrastructure/{mongo,adapters}.ts
│   └── interfaces/http/{handlers,upload}.ts
├── src/bootstrap/container.ts
├── src/shared/config.ts
├── scripts/{setup-dev,init,prepare-demo,verify-docker,generate-openapi,verify-openapi}.ts
├── tests/{unit,api,contract,integration,support}/
├── public/demo.html
├── docs/{architecture,frontend-integration,demo,verification}.md
├── docs/openapi.yaml
├── docker/minio.Dockerfile
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

Los doce casos de uso son clases separadas en `application/use-cases.ts`, agrupadas por el tamaño del MVP. Domain no importa Next, MongoDB, Zod ni JWT. Repositorios y gateways se inyectan mediante interfaces.

## Desarrollo local

Node 24 y ffprobe en PATH, o `FFPROBE_PATH` absoluto.

```powershell
npm ci
npm run dev:setup
docker compose up -d --wait mongodb minio
npm run db:init
npm run dev
```

No ejecutar dev mientras Docker ocupa 3002: `docker compose stop playback-service`. Los volúmenes conservan datos al usar `docker compose down`. La inicialización no borra datos.

## Variables

| Variable                                        | Función / valor local                                     |
| ----------------------------------------------- | --------------------------------------------------------- |
| `MONGODB_URI`                                   | Replica set; host local usa directConnection=true         |
| `MONGODB_DATABASE`                              | playback_service, base exclusiva                          |
| `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL` | Endpoint interno S3                                       |
| `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`          | Generados por setup; no versionar                         |
| `MINIO_BUCKET`                                  | streaming-media, privado                                  |
| `MINIO_PUBLIC_URL`                              | Endpoint S3 accesible al navegador, http://localhost:9000 |
| `PLAYBACK_URL_TTL`                              | 900 segundos; permitido 60–3600                           |
| `CATALOG_SERVICE_URL`                           | Base HTTP de Catalog; timeout 4 s                         |
| `USERS_JWKS_URL`                                | http://127.0.0.1:3001/.well-known/jwks.json               |
| `JWT_ISSUER`, `JWT_AUDIENCE`                    | users-service, streaming-services                         |
| `APP_ORIGIN`                                    | http://localhost:3002                                     |
| `MAX_UPLOAD_BYTES`                              | 268435456 (256 MiB), máximo 1 GiB                         |
| `UPLOAD_LIMIT_PER_HOUR`                         | 10 por ADMIN                                              |
| `FFPROBE_PATH`                                  | ffprobe, instalado en Docker                              |

Compose reemplaza endpoints internos por mongodb/minio/host.docker.internal. El firmado usa directamente el endpoint público: no se cambia el host de una URL ya firmada. Para otro equipo, configurar endpoints y APP_ORIGIN; localhost identifica el equipo del navegador.

## Endpoints

Todos salvo health requieren Bearer accessToken de Users. ADMIN requiere role ADMIN. userId se obtiene exclusivamente del JWT.

| Método | Ruta                                               | Resultado                   |
| ------ | -------------------------------------------------- | --------------------------- |
| POST   | `/api/v1/media/assets`                             | ADMIN, multipart file, 201  |
| GET    | `/api/v1/media/assets/:assetId`                    | ADMIN, metadata             |
| DELETE | `/api/v1/media/assets/:assetId`                    | ADMIN, borrado lógico, 204  |
| POST   | `/api/v1/playback/sessions`                        | tituloId, sesión + URL, 201 |
| PATCH  | `/api/v1/playback/sessions/:sessionId/progress`    | positionSeconds             |
| POST   | `/api/v1/playback/sessions/:sessionId/pause`       | Posición opcional           |
| POST   | `/api/v1/playback/sessions/:sessionId/resume`      | Reanuda + URL nueva         |
| POST   | `/api/v1/playback/sessions/:sessionId/complete`    | Completa una sola vez       |
| POST   | `/api/v1/playback/sessions/:sessionId/refresh-url` | Renueva URL                 |
| GET    | `/api/v1/playback/me/continue-watching`            | Referencias + progreso      |
| GET    | `/api/v1/playback/me/history`                      | Último estado por título    |
| GET    | `/api/health`                                      | MongoDB/MinIO, 200/503      |

Listas: `?page=1&limit=20`, máximo 100 elementos. [OpenAPI](docs/openapi.yaml) detalla cuerpos, respuestas, seguridad y errores. Metadata nunca incluye bucket/objectKey; una URL S3 sí contiene la ruta necesaria para servir bytes.

MP4 H.264 con AAC opcional, validado mediante MIME, extensión, firma ftyp y ffprobe. Duración/resolución/codec se obtienen en servidor; no se transcodifica ni se confía en duración enviada por frontend.

## CURL

Ejemplos Bash/Git Bash. En PowerShell usar curl.exe y ajustar variables/continuaciones, o seguir [demo](docs/demo.md). Definir ADMIN_TOKEN y USER_TOKEN con respuestas reales de Users.

```bash
BASE=http://localhost:3002
# 1. Subir archivo propio; copiar asset.assetId en ASSET_ID
curl -sS -X POST "$BASE/api/v1/media/assets" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -F 'file=@exposicion.mp4;type=video/mp4'
# Asociar/publicar en Catalog según docs/demo.md.

# 2. Metadata
curl -sS "$BASE/api/v1/media/assets/$ASSET_ID" -H "Authorization: Bearer $ADMIN_TOKEN"

# 3. Iniciar; copiar session.sessionId en SESSION_ID
curl -sS -X POST "$BASE/api/v1/playback/sessions" \
  -H "Authorization: Bearer $USER_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"tituloId\":\"$TITULO_ID\"}"

# 4. Progreso
curl -sS -X PATCH "$BASE/api/v1/playback/sessions/$SESSION_ID/progress" \
  -H "Authorization: Bearer $USER_TOKEN" -H 'Content-Type: application/json' -d '{"positionSeconds":30}'

# 5. Pausar
curl -sS -X POST "$BASE/api/v1/playback/sessions/$SESSION_ID/pause" \
  -H "Authorization: Bearer $USER_TOKEN" -H 'Content-Type: application/json' -d '{"positionSeconds":30}'

# 6. Reanudar
curl -sS -X POST "$BASE/api/v1/playback/sessions/$SESSION_ID/resume" -H "Authorization: Bearer $USER_TOKEN"

# 7. Completar
curl -sS -X POST "$BASE/api/v1/playback/sessions/$SESSION_ID/complete" -H "Authorization: Bearer $USER_TOKEN"

# 8. Continuar viendo (excluye el completado)
curl -sS "$BASE/api/v1/playback/me/continue-watching?page=1&limit=20" -H "Authorization: Bearer $USER_TOKEN"

# 9. Historial
curl -sS "$BASE/api/v1/playback/me/history?page=1&limit=20" -H "Authorization: Bearer $USER_TOKEN"
```

## Pruebas

```powershell
# Preparación de imágenes de test, sin levantar/reiniciar el stack de QA:
docker compose build playback-service minio
npm test                  # unitarios + handlers API + contratos HTTP/JWKS
npm run test:unit
npm run test:api
npm run test:contract
npm run test:integration  # replica set y MinIO propios; no requiere una URI
npm run test:coverage     # todas las suites Vitest e infraestructura aislada
npm run test:smoke        # alias de test:e2e
npm run check             # tipos, lint, npm test, OpenAPI y builds
npm run test:e2e
```

Check ejecuta typecheck, lint, unitarias/API/contratos, OpenAPI, build Next y scripts. E2E crea contenedores/red con nombres aleatorios, MongoDB replica set y MinIO reales, JWT de prueba, Catalog/JWKS HTTP controlados y MP4 sintético de 60 s. Usa puertos de loopback libres, ejecuta integración y elimina solo sus recursos en finally. No usa Users PostgreSQL ni otras bases existentes. El puerto público MinIO del test se publica explícitamente para conservarlo al detener/reiniciar el contenedor durante la prueba de recuperación.

Integración crea siempre su propio MongoDB con replica set y su propio MinIO; ignora `TEST_MONGODB_URI`, `.env` y URIs del usuario. Genera base `playback_test_<UUID>`, credenciales nuevas y puertos efímeros, con cleanup incluso si falla la preparación. Requiere Docker y la imagen MinIO compilada en el primer comando. No usa instancia productiva, tampoco mediante túnel local.

Los contratos importan **solo desde tests** los DTO de Catalog y el firmador de Users, los transportan por HTTP local y comprueban su consumo real por los adapters Playback. No hay dependencia productiva entre los módulos. Por eso los tests se excluyen del contexto Docker de la aplicación. La suite del monorepo requiere tener instaladas las dependencias de los tres backends.

Coverage V8 incluye todo `src/**/*.ts` sin exclusiones adicionales y exige 70 % global y 80 % Domain/Application en las cuatro métricas. Reportes HTML/LCOV/JSON/resultados en `coverage/`, ignorado por Git. La carga MP4/ffprobe positiva se comprueba también en el E2E Docker; su cobertura de procesos externos no se suma artificialmente a V8. [Resultados backend actuales](../docs/quality/BACKEND_TEST_RESULTS.md).

[Demo completa](docs/demo.md), [frontend](docs/frontend-integration.md), [arquitectura](docs/architecture.md), [verificación](docs/verification.md).

## Hardening de calidad y seguridad

ESLint cubre TS/TSX; TypeScript conserva strict; Prettier comparte la configuración raíz.

```powershell
npm run format:check
npm run lint
npm run typecheck
npm audit --audit-level=high
```

`npm run format` aplica el formato. Los gates de CI también escanean secretos y auditan dependencias. Consulte [Security Review](../docs/quality/SECURITY_REVIEW.md) y [Dependency Audit](../docs/quality/DEPENDENCY_AUDIT.md), incluidos los pendientes de rotación de secretos y avisos MEDIUM. No versionar `.env` ni claves privadas.
