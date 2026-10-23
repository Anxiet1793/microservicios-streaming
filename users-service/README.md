# Users Service

Microservicio independiente para Usuarios del MVP académico de streaming. Implementa registro, login, refresh con rotación, logout, perfil, cambio de contraseña, Mi Lista y LIKE/DISLIKE. No incluye interfaz gráfica ni modifica Catalog Service.

**Stack:** Node.js 24.x, TypeScript 6, Next.js App Router, PostgreSQL 17, Drizzle, Zod, Argon2id, JOSE/RS256, Vitest y Docker. Arquitectura DDD/hexagonal: [decisiones y modelo de datos](docs/architecture.md). Contrato: [OpenAPI](docs/openapi.yaml).

## Iniciar con Docker

Requisitos: Docker Desktop/Engine con contenedores Linux y Compose v2. Desde `users-service`, generar secretos de desarrollo una sola vez:

```powershell
docker run --rm -v "${PWD}:/app" -w /app node:24-bookworm-slim node scripts/setup-dev.ts
docker compose up --build -d --wait
curl.exe http://127.0.0.1:3001/api/health
```

El primer comando no requiere Node ni npm en el host. Genera `.env` con contraseña PostgreSQL y claves RSA aleatorias, sin imprimir secretos y sin sobrescribir un `.env` existente. El Compose necesita ese archivo. No usar los marcadores vacíos de `.env.example` como credenciales.

API: `http://127.0.0.1:3001`. PostgreSQL: `127.0.0.1:5433`, base `users_service`. El puerto 3000 de Catálogo permanece independiente. `users-migrate` termina con código 0 después de aplicar migraciones; es normal que aparezca como exited.

```powershell
docker compose logs -f users-service
docker compose down
```

`down` conserva el volumen. No usar `down -v` si se quieren conservar usuarios/sesiones. Cada servicio mantiene su propia persistencia; no hay conexión a Catalog DB.

## Desarrollo local con Node

Requiere Node **24.x** y npm. Si el Node global es otra versión, seleccionar Node 24 antes de ejecutar estos comandos.

```powershell
npm ci
npm run dev:setup
docker compose up -d --wait postgres
npm run db:migrate
npm run dev
```

Si la API Docker ocupa 3001, detenerla antes con `docker compose stop users-service`. Next carga `.env`; los scripts DB lo cargan explícitamente.

```powershell
npm run build
npm start
```

## Variables

| Variable                       | Uso / valor predeterminado                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                 | Conexión exclusiva a Users PostgreSQL. `.env` apunta al puerto local 5433; Compose la reemplaza por `postgres:5432`. |
| `POSTGRES_PASSWORD`            | Secreto aleatorio generado para Compose.                                                                             |
| `APP_ENV`                      | `production` si se omite. `dev:setup` usa `development` para HTTP local y seed.                                      |
| `APP_ORIGIN`                   | Origen web permitido, sin slash final. Local `http://127.0.0.1:3001`. Producción exige HTTPS.                        |
| `JWT_PRIVATE_KEY`              | PEM PKCS8 RSA; solo Users lo recibe.                                                                                 |
| `JWT_PUBLIC_KEY`               | PEM SPKI de la misma clave; se publica como JWKS.                                                                    |
| `JWT_KEY_ID`                   | `users-key-1`; identifica la clave en header/JWKS.                                                                   |
| `JWT_ISSUER`                   | `users-service`.                                                                                                     |
| `JWT_AUDIENCE`                 | `streaming-services`.                                                                                                |
| `ACCESS_TOKEN_TTL`             | Segundos: 900, rango 60–1800.                                                                                        |
| `REFRESH_TOKEN_TTL`            | Segundos: 2592000 (30 días), rango 3600–2592000; caducidad absoluta, no deslizante.                                  |
| `REQUEST_MAX_BYTES`            | 16384, rango 1024–65536.                                                                                             |
| `AUTH_RATE_WINDOW`             | 900 segundos, rango 60–3600.                                                                                         |
| `LOGIN_RATE_LIMIT`             | 10 intentos por email y ventana.                                                                                     |
| `REGISTER_RATE_LIMIT`          | 5 intentos por email y ventana.                                                                                      |
| `AUTH_GLOBAL_LIMIT`            | 200 por endpoint de autenticación y ventana, compartidos entre instancias.                                           |
| `USERS_PORT` / `POSTGRES_PORT` | Puertos locales Compose: 3001 / 5433.                                                                                |
| `USERS_ENV_FILE`               | Archivo de runtime Compose; predeterminado `.env`.                                                                   |
| `USERS_IMAGE_TAG`              | Tag Compose; predeterminado `local`.                                                                                 |
| `SEED_PASSWORD`                | Contraseña exclusiva de desarrollo para las dos cuentas demo. Se genera aleatoriamente en `.env`.                    |

Claves PEM entre comillas con saltos `\n`; el script crea el formato correcto. No imprimir ni versionar `.env`, cookies o JWT. Para un despliegue real usar secretos de runtime, APP_ENV=production y HTTPS; no reutilizar la configuración de desarrollo.

## PostgreSQL, migraciones y seeds

Modelo: `users` (credenciales/rol/estado), `profiles` (1:1), `refresh_tokens`, `watchlist_items`, `content_preferences` y `rate_limit_buckets` (infraestructura). Solo las FK internas apuntan a users. Mi Lista/preferencias tienen PK compuesta `(user_id,title_id)`; title_id es `ttl_UUIDv4`, sin FK externa ni metadata de catálogo.

Migración versionada inicial: [0000_busy_carlie_cooper.sql](drizzle/0000_busy_carlie_cooper.sql). El esquema fuente está en `src/modules/users/infrastructure/persistence/schema.ts`. Se usa el journal de Drizzle y advisory lock para serializar migraciones. Repetir `db:migrate` no recrea datos.

```powershell
npm run db:generate  # Después de cambiar schema.ts, revisar el SQL generado
npm run db:migrate
npm run db:seed      # Solo con APP_ENV=development y SEED_PASSWORD configurada
```

Equivalentes Docker:

```powershell
docker compose run --rm users-migrate
docker compose exec users-service node dist/seed.mjs
docker compose exec users-service node dist/cleanup.mjs
```

Seed crea `admin@streaming.local` (ADMIN) y `demo@streaming.local` (USER), con la contraseña almacenada en `SEED_PASSWORD` dentro de tu `.env`. No hay contraseña fija en código. Es idempotente: no sobrescribe password ni promueve cuentas existentes. Se rechaza fuera de development. `cleanup` elimina contadores vencidos y tokens expirados hace más de un día; puede programarse periódicamente.

## Endpoints

| Método | Ruta                                      | Autenticación / resultado                                   |
| ------ | ----------------------------------------- | ----------------------------------------------------------- |
| POST   | `/api/v1/auth/register`                   | Pública; crea USER/ACTIVE y perfil, 201.                    |
| POST   | `/api/v1/auth/login`                      | Pública; JWT en JSON y refresh en cookie, 200.              |
| POST   | `/api/v1/auth/refresh`                    | Cookie + comprobación CSRF; rota sesión, 200.               |
| POST   | `/api/v1/auth/logout`                     | Cookie opcional + CSRF; revoca familia, 204.                |
| GET    | `/api/v1/users/me`                        | Bearer; perfil del usuario autenticado.                     |
| PATCH  | `/api/v1/users/me`                        | Bearer; displayName/avatarUrl/preferredLanguage.            |
| POST   | `/api/v1/users/me/change-password`        | Bearer + contraseña actual; revoca todas las sesiones, 204. |
| POST   | `/api/v1/users/me/watchlist/{tituloId}`   | Bearer; agrega, 201; duplicado 409.                         |
| DELETE | `/api/v1/users/me/watchlist/{tituloId}`   | Bearer; elimina de forma idempotente, 204.                  |
| GET    | `/api/v1/users/me/watchlist`              | Bearer; referencias paginadas.                              |
| PUT    | `/api/v1/users/me/preferences/{tituloId}` | Bearer; LIKE/DISLIKE idempotente, 200.                      |
| DELETE | `/api/v1/users/me/preferences/{tituloId}` | Bearer; elimina, 204.                                       |
| GET    | `/api/v1/users/me/preferences`            | Bearer; señales paginadas.                                  |
| GET    | `/.well-known/jwks.json`                  | Pública; solo clave pública RSA.                            |
| GET    | `/api/health`                             | Pública; PostgreSQL y par de claves, 200/503.               |

Listados aceptan `page` y `limit`: 1/20 por defecto, máximo 100 filas y offset 10000. Rechazan filtros no soportados/repetidos. Todos los endpoints rechazan métodos no admitidos con JSON 405 y Allow; admiten OPTIONS y GET incluye HEAD.

Errores: `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS/UNAUTHORIZED`, `403 FORBIDDEN`, `404 USER_NOT_FOUND`, `409 EMAIL_ALREADY_EXISTS/WATCHLIST_ITEM_ALREADY_EXISTS`, `413 PAYLOAD_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE`, `429 RATE_LIMIT_EXCEEDED`, `500 INTERNAL_SERVER_ERROR`; health usa 503.

```json
{
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "Ya existe una cuenta asociada a ese correo.",
    "requestId": "uuid"
  }
}
```

## Ejemplos PowerShell / curl

Registro:

```powershell
curl.exe -X POST "http://127.0.0.1:3001/api/v1/auth/register" -H "Content-Type: application/json" --data-raw '{"email":"samuel@example.com","password":"PasswordSegura123!","displayName":"Samuel"}'
```

Login, conservando cookie y JWT en variables locales:

```powershell
$login = curl.exe -s -c .dev-cookies.txt -X POST "http://127.0.0.1:3001/api/v1/auth/login" -H "Content-Type: application/json" --data-raw '{"email":"samuel@example.com","password":"PasswordSegura123!"}' | ConvertFrom-Json
$accessToken = $login.accessToken
curl.exe "http://127.0.0.1:3001/api/v1/users/me" -H "Authorization: Bearer $accessToken"
```

Agregar un título a Mi Lista y registrar LIKE:

```powershell
# Sustituir por un tituloId devuelto por Catalog Service.
$tituloId = "ttl_00000000-0000-4000-8000-000000000001"
curl.exe -X POST "http://127.0.0.1:3001/api/v1/users/me/watchlist/$tituloId" -H "Authorization: Bearer $accessToken"
curl.exe -X PUT "http://127.0.0.1:3001/api/v1/users/me/preferences/$tituloId" -H "Authorization: Bearer $accessToken" -H "Content-Type: application/json" --data-raw '{"value":"LIKE"}'
curl.exe "http://127.0.0.1:3001/api/v1/users/me/watchlist?page=1&limit=20" -H "Authorization: Bearer $accessToken"
```

Refresh y logout para CLI sin Origin:

```powershell
$renewed = curl.exe -s -b .dev-cookies.txt -c .dev-cookies.txt -X POST "http://127.0.0.1:3001/api/v1/auth/refresh" -H "X-CSRF-Protection: 1" | ConvertFrom-Json
$accessToken = $renewed.accessToken
curl.exe -b .dev-cookies.txt -c .dev-cookies.txt -X POST "http://127.0.0.1:3001/api/v1/auth/logout" -H "X-CSRF-Protection: 1"
```

En bash usar `curl` y adaptar la asignación de variables. Los ejemplos de contraseña son ilustrativos para la cuenta local; no son credenciales predeterminadas del seed.

## Sesiones y relación con otros servicios

Refresh es opaco y solo existe en cookie HttpOnly, SameSite=Strict, Path=/api/v1/auth, Secure en producción. PostgreSQL conserva su hash SHA-256. Cada uso rota el token; reutilización revoca la familia. El frontend debe serializar renovaciones para evitar que dos solicitudes simultáneas se interpreten como replay. La caducidad absoluta no se extiende.

Logout revoca refresh; un access token ya emitido conserva validez hasta expirar. ChangePassword revoca todas las sesiones e incrementa authVersion: Users rechaza también access tokens antiguos. Servicios externos que verifiquen solo JWT deben respetar su TTL; revocación distribuida inmediata queda para eventos/introspección futuros.

Los consumidores verifican **RS256, issuer, audience, exp, kid y claims** usando JWKS público. No reciben la clave privada ni consultan Users DB. Esta entrega prepara ese contrato; no añade autenticación a Catalog ni implementa Playback/Recommendations.

Mi Lista y señales solo guardan `tituloId`. No se valida existencia mediante Catalog API en esta versión para evitar dependencia síncrona. Puede haber referencias a títulos retirados/inexistentes; el cliente maneja 404/estado al enriquecerlas.

## Tests y build

```powershell
npm test                  # unitarios + API de Route Handlers + contratos, sin DB
npm run test:unit
npm run test:api
npm run test:contract
npm run test:integration  # PostgreSQL real desechable, requiere Docker
npm run test:coverage     # todas las suites Vitest, incluida integración; requiere Docker
npm run test:smoke        # alias de test:e2e, imagen/Compose exclusivos
npm run check             # tipos + lint + npm test + OpenAPI + builds
npm run test:e2e          # Construye imagen y verifica los 15 endpoints en Compose aislado
```

Los unitarios no abren PostgreSQL. Integración/E2E generan credenciales, contenedores, puertos y volúmenes exclusivos; no cargan `.env` del usuario ni usan su DATABASE_URL. Al terminar eliminan esos recursos temporales. No hay tests apuntando automáticamente a una base productiva.

Coverage V8 incluye todo `src/**/*.ts`, sin exclusiones adicionales. Exige 70 % global y 80 % en Domain/Application, en líneas/sentencias/ramas/funciones. Reportes en `coverage/` (HTML, LCOV, JSON y resultados de tests), ignorados por Git. Los tests API Vitest llaman los Route Handlers reales con puertos de repositorio controlados; `test:e2e` comprueba HTTP contra Next construido y SQL reales. Resultados actuales y límites en [BACKEND_TEST_RESULTS.md](../docs/quality/BACKEND_TEST_RESULTS.md).

`docs/openapi.yaml` se genera con `node --import tsx scripts/generate-openapi.ts`; `docs:check` valida su estructura, las 15 operaciones, patrones de IDs y ejemplos contra Zod. Resultados ejecutados: [verification.md](docs/verification.md).

## Árbol del proyecto

```text
users-service/
├── src/
│   ├── app/
│   │   ├── .well-known/jwks.json/route.ts
│   │   └── api/
│   │       ├── health/route.ts
│   │       └── v1/
│   │           ├── auth/{register,login,refresh,logout}/route.ts
│   │           └── users/me/
│   │               ├── route.ts
│   │               ├── change-password/route.ts
│   │               ├── watchlist/route.ts
│   │               ├── watchlist/[tituloId]/route.ts
│   │               ├── preferences/route.ts
│   │               └── preferences/[tituloId]/route.ts
│   ├── bootstrap/container.ts
│   ├── modules/users/
│   │   ├── domain/{user,repositories,errors}.ts
│   │   ├── application/
│   │   │   ├── use-cases/       # 13 clases independientes
│   │   │   └── {ports,dto,current-user}.ts
│   │   ├── infrastructure/
│   │   │   ├── persistence/    # Esquema, migrador y cuatro repositorios
│   │   │   └── security/       # Argon2, JWT, refresh y rate limiting
│   │   └── interfaces/http/{schemas,handlers}.ts
│   └── shared/{config,http}.ts
├── drizzle/                    # SQL inicial, snapshot y journal
├── scripts/                    # Setup, migraciones, seed, limpieza y verificación
├── tests/{unit,api,contract,integration,helpers}/
├── docs/{architecture.md,openapi.yaml,verification.md}
├── Dockerfile / docker-compose.yml / .dockerignore
├── .env.example
├── drizzle.config.ts / next.config.ts / tsconfig.json
├── eslint.config.mjs / vitest*.config.ts
└── package.json / package-lock.json
```

## Hardening de calidad y seguridad

ESLint cubre TS/TSX; TypeScript conserva strict; Prettier comparte la configuración raíz.

```powershell
npm run format:check
npm run lint
npm run typecheck
npm audit --audit-level=high
```

`npm run format` aplica el formato. Los gates de CI también escanean secretos y auditan dependencias. Consulte [Security Review](../docs/quality/SECURITY_REVIEW.md) y [Dependency Audit](../docs/quality/DEPENDENCY_AUDIT.md), incluidos los pendientes de rotación de secretos y avisos MEDIUM. No versionar `.env` ni claves privadas.
