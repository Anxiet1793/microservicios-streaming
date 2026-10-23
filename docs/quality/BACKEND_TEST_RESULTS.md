# Resultados de pruebas automatizadas backend

> Actualización de hardening (20/10/2026): este documento conserva el estado de su ejecución original. Autorización de Catalog, dependencias y resultados posteriores están en [SECURITY_REVIEW.md](SECURITY_REVIEW.md) y [HARDENING_RESULTS.json](HARDENING_RESULTS.json). Q02 quedó corregido en código; la rotación de la credencial Atlas expuesta sigue pendiente.

Fecha: **17/10/2026**. Base: `a20fc9a6bf5af7d68ce1066b6c1b5166d08e94b6`, con los cambios de esta entrega en el árbol de trabajo, sin crear un commit. Alcance: **users-service, catalog-service y playback-service**. El frontend no fue modificado ni se ejecutó su suite sobre el entorno de QA compartido.

Referencias iniciales: [auditoría](QUALITY_AUDIT.md) y [matriz de pruebas](TEST_MATRIX.md). Esos documentos conservan el diagnóstico anterior; este informe registra la implementación y ejecución posteriores. No implica que se hayan cerrado todos los hallazgos de seguridad/CI/frontend de la auditoría.

## Resultado final

**283 tests Vitest ejecutados: 283 passed, 0 failed, 0 skipped, 0 todo.** Son 21 archivos de tests. Las ejecuciones repetidas por comandos distintos no se suman. Las verificaciones Docker/assert se informan por separado.

| Servicio | Unit | API de handlers | Contract | Integration | Total | Passed | Failed | Skipped |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Users | 43 | 31 | 2 | 20 | **96** | 96 | 0 | 0 |
| Catalog | 51 | 17 | 3 | 7 | **78** | 78 | 0 | 0 |
| Playback | 45 | 20 | 31 | 13 | **109** | 109 | 0 | 0 |
| **Total** | **139** | **68** | **36** | **40** | **283** | **283** | **0** | **0** |

La base backend tenía 123 tests Vitest incluyendo integración: 47 Users, 45 Catalog y 31 Playback. Se conservan y amplían; el incremento es de **160 casos**, además de ampliar el ensayo Docker Playback. No se añadieron tests para contar únicamente getters, wrappers o líneas sin riesgo funcional.

| Verificación adicional ejecutada | Resultado final |
|---|---|
| Users `test:smoke` → `test:e2e` | **14 grupos correctos**, imagen/Compose/PostgreSQL propios |
| Catalog `test:smoke` → `verify:phase7` | **10 comprobaciones correctas**, imagen/Compose/Mongo propios |
| Catalog `test:e2e` → build + `verify:phase6` | **14 grupos HTTP correctos**, Next construido y Mongo temporal |
| Catalog `verify:phase4` | **15 grupos correctos**, persistencia/BSON/índices/concurrencia/fallos |
| Catalog `verify:phase5` | **14 grupos correctos**, aplicación y adaptadores runtime |
| Playback `test:smoke` → `test:e2e` | **12 grupos correctos**, MP4/ffprobe/MinIO/replica set/JWKS/Catalog HTTP controlados |
| `npm run check`, en los tres servicios | **Correcto**: typecheck, lint, test, OpenAPI, build Next y scripts |
| `npm run test:coverage`, en los tres servicios | **Correcto**, incluidos todos los umbrales configurados |

Los grupos assert no son tests adicionales de Vitest. El E2E Playback también invoca las 13 integraciones, ya incluidas en los 109; no se duplican en el total.

## Cómo se prueba cada capa

- **Unit:** dominio y casos de uso con puertos controlados, criptografía real donde corresponde. Reglas de estados, límites, identidades, no escritura ante fallos, compensación e idempotencia.
- **API Vitest:** se importan los Route Handlers reales y se invocan con `Request`/`Response`, composición y casos de uso reales, controlando identidad/repositorios o dependencias según el archivo. No abren un servidor Next ni una base por sí solos. Su propósito es comprobar validación, autorización, códigos, cookies, headers y errores del adaptador HTTP.
- **API/E2E Docker:** peticiones HTTP reales a Next construido con PostgreSQL o Mongo/MinIO reales. Cubren el enrutamiento del framework y el comportamiento que los tests de handlers no pueden demostrar.
- **Integration:** SQL/migraciones/repositorios y transacciones Mongo, cuotas atómicas, S3 privado/Range/expiración. Cada suite crea infraestructura propia; no toma direcciones de bases existentes.
- **Contract:** Playback consume por HTTP local DTO producidos por el mapper real Catalog y JWKS/tokens generados por el firmador real Users. Los casos negativos usan un servidor HTTP controlado. También se validan contratos públicos de los productores y sus OpenAPI.
- **Smoke:** reutiliza verificaciones Docker existentes y amplía caída/recuperación de almacenamiento. Verifica proceso, dependencias, no root y operaciones representativas, sin tocar el stack compartido.

Se mantiene **Vitest 5.0.3**, scripts `node:assert`, Zod y SwaggerParser existentes. La única herramienta añadida es **@vitest/coverage-v8 5.0.3** como dependencia de desarrollo. No se introdujo Testcontainers porque el proyecto ya disponía de contenedores de prueba específicos. No se cambió ninguna versión existente de dependencia productiva en los lockfiles.

## Cobertura medida y umbrales

V8 incluye **todo `src/**/*.ts` de cada servicio**, incluidos wiring, adaptadores, configuración y Route Handlers; no se agregaron exclusiones para mejorar el porcentaje. Tests, scripts operativos fuera de src, dependencias y archivos generados Next no pertenecen a ese denominador. Los procesos Docker/ffprobe externos **no se suman** a la cobertura del proceso Vitest.

Umbrales comprobados por `vitest.coverage.config.ts`, para **las cuatro métricas**:

- Global del servicio: **≥70 %**.
- Conjunto Domain: **≥80 %**.
- Conjunto Application: **≥80 %**.

Son umbrales por conjunto, **no por archivo individual**. Los agregados por capa se calculan sumando contadores cubiertos/totales, sin promediar porcentajes de archivos.

| Servicio | Líneas globales | Sentencias globales | Ramas globales | Funciones globales |
|---|---:|---:|---:|---:|
| Users | **96,01 %** (458/477) | **93,29 %** (584/626) | **90,53 %** (220/243) | **88,96 %** (129/145) |
| Catalog | **88,92 %** (490/551) | **85,79 %** (598/697) | **81,87 %** (420/513) | **90,22 %** (157/174) |
| Playback | **90,71 %** (254/280) | **84,32 %** (409/485) | **77,98 %** (209/268) | **86,91 %** (93/107) |

| Servicio / capa | Líneas | Sentencias | Ramas | Funciones |
|---|---:|---:|---:|---:|
| Users Domain | 100 % | 97,56 % | 97,91 % | 100 % |
| Users Application | 100 % | 97,29 % | 94,28 % | 100 % |
| Catalog Domain | 99,02 % | 94,69 % | 95,20 % | 100 % |
| Catalog Application | 93,54 % | 93,33 % | 84,26 % | 100 % |
| Playback Domain | 100 % | 92,30 % | 89,47 % | 100 % |
| Playback Application | 100 % | 97,50 % | 94,31 % | 100 % |

### Partes por debajo del objetivo individual y por qué

No hay conjuntos Global/Domain/Application incumplidos. Sí quedan archivos o métricas individuales bajos. Se declaran para no confundir un umbral agregado correcto con cobertura exhaustiva:

| Servicio | Archivo o grupo, bajo src | Métrica inferior | Explicación / evidencia complementaria |
|---|---|---|---|
| Users | bootstrap/container.ts | 22,22 % líneas; 25 % funciones | API Vitest inyecta container; wiring real se comprueba en Docker sin fusionar su cobertura |
| Users | modules/users/infrastructure/persistence/schema.ts | 50 % líneas; 9,09 % funciones | Callbacks de definición Drizzle no todos se invocan en V8; esquema SQL real, rollback y restricciones se prueban mediante migración/integración |
| Users | modules/users/infrastructure/persistence/connection.ts | 50 % funciones | Rama de cierre/error no exhaustiva en Vitest; conexión real usada por integración |
| Users | app/api/v1/auth/logout/route.ts | 0 % funciones | Callback específico de cookie ante error no ejecutado; logout normal y revocación real sí se prueban |
| Users | application/use-cases/change-password.ts, set-content-preference.ts | 75 % / 50 % ramas | Faltan ramas internas concretas de carrera/entrada tipada inválida, aunque el contrato HTTP y caminos principales/negativos están cubiertos |
| Users | watchlist-repository.ts, interfaces/http/handlers.ts y schemas.ts | 50 % ramas | No se inyectan todos los errores de persistencia, cookies y condiciones cortocircuitadas; no se afirma exhaustividad |
| Catalog | bootstrap/catalog-container.ts | 33,33 % líneas/funciones | Wiring productivo ejecutado por smoke/HTTP construido, no por el container inyectado de API Vitest |
| Catalog | shared/infrastructure/mongodb/connection.ts | 4,16 % líneas; 0 % funciones | Vitest de repositorio conecta directamente a su Mongo propio; conexión compartida/reconexión se ejercita en fase4 y HTTP real fuera de V8 |
| Catalog | infrastructure/persistence/mongodb/initialize-catalog.ts | 46,15 % líneas; 0 % ramas | Init correcto sí es instrumentado; errores de índice/BSON y privilegios se cubren parcialmente en fase4 o quedan pendientes |
| Catalog | infrastructure/runtime/system-clock.ts, uuid-title-id-generator.ts | 0 % líneas/funciones | Adaptadores mínimos verificados por fase5 y ejecución HTTP; no se añadieron unitarios de wrappers para subir el número |
| Catalog | shared/infrastructure/config/environment.ts | 55,55 % líneas; 50 % funciones | Config válida usada; variantes inválidas adicionales cubiertas en fase4 fuera de V8, no todas sus ramas |
| Catalog | application/mappers/catalog-dto-mapper.ts, use-cases/update-catalog-title.ts | 77,77 % / 75 % ramas | Opcionales/no-op y algunos errores no enumerados completamente; capa agregada pasa 80 % |
| Catalog | domain/repositories/catalog-query.ts | 77,77 % sentencias | Guardas internas no exhaustivas; filtros, operadores, límites y búsqueda tienen pruebas positivas/negativas |
| Catalog | persistence/mongodb/repositories/catalog-query.ts | 62,50 % ramas | Algunas combinaciones de filtros y cortocircuitos sin aserción independiente |
| Catalog | shared/infrastructure/http/handle-request.ts, read-json-body.ts | 66,66 % ramas / 50 % funciones | No todas las clases de error/lectura fallida están instrumentadas; fase6 amplía bytes, desconexión y errores seguros |
| Playback | bootstrap/container.ts | 0 % líneas/funciones | API Vitest inyecta dependencias; wiring real comprobado en la imagen Docker reconstruida |
| Playback | modules/playback/interfaces/http/upload.ts | 51,42 % líneas; 32,07 % ramas; 40 % funciones | Parte negativa del parser en Vitest; flujo MP4/ffprobe positivo y tamaños/MIME reales en Docker. Falta instrumentar/inyectar todos los aborts, timeouts y fallos de limpieza |

Los nombres abreviados de módulos Users/Catalog se resuelven dentro de `src/modules/{users,catalog}/`. El HTML/JSON contiene los nombres completos y líneas restantes. No se bajaron los umbrales, se excluyeron archivos ni se marcaron tests como skip para aprobar.

## Riesgos cubiertos y casos negativos

### Users

| Área solicitada | Evidencia principal |
|---|---|
| Registro válido/inválido, email/password y duplicado | Domain/application, API real de handlers y HTTP Docker; duplicado concurrente con UNIQUE SQL |
| Hash y perfil transaccional | PostgreSQL: Argon2id real, comprobación del hash, rol USER, perfil creado y rollback si falla el perfil |
| Login válido, password errónea, ausente e INACTIVE | Unit/API/SQL y JWT real; respuesta genérica INVALID_CREDENTIALS y ausencia de sesión ante rechazo |
| Claims, expiración, firma, USER/ADMIN | Firma RS256, kid/typ, sub/userId, role, ver, issuer/audience, iat/exp/jti; contratos Playback verifican la emisión real Users |
| Refresh válido, expirado/revocado/consumido, rotación y replay | Integración SQL real, dos refresh simultáneos, caducidad absoluta y revocación de familia |
| Logout | Revoca familia incluso con token anterior; refresh inutilizable; otra familia independiente permanece válida |
| GET/PATCH me y campos prohibidos | API: perfiles parciales/avatar null, identidad desaparecida devuelve 401 según contrato actual; campos privilegiados rechazados antes de escribir |
| Mi Lista | Alta, duplicado/secuencia concurrente, paginación, delete inexistente idempotente y aislamiento entre cuentas |
| Preferencias | LIKE/DISLIKE, cambio de valor sin perder createdAt, PUT igual sin alterar updatedAt, eliminación e independencia por usuario |
| Protección HTTP | Sin token, token inválido/expirado/firma alterada, CSRF/origen, body/JSON/media type, límites, métodos, Retry-After y ocultamiento de secretos |

Archivos: `users-service/tests/{unit,api,contract,integration}/`. Las cuatro pruebas SQL añadidas cubren familias independientes, preferencias entre cuentas, UNIQUE concurrente de lista y recuperación del rate limit al vencer su ventana.

### Catalog

| Área solicitada | Evidencia principal |
|---|---|
| Bulk válido/inválido, duplicados y mezcla | Unit, handlers y Next HTTP; resumen/indexación por entrada, 201/200/207/409/503 sin inventar éxito |
| Idempotencia y máximo | Mongo real con importKey canónica y concurrencia; API acepta el máximo configurado exactamente y rechaza máximo+1 sin escribir |
| Listado | Paginación, límite 100 y rechazo 101, filtros combinados, búsqueda Unicode/textual, vacío y proyección mínima |
| Identidad y retirados | Encontrado/404/ID público inválido; detalle retirado devuelve estado 3 conforme al contrato interno, sin ocultarlo dentro de Catalog |
| Update y publicación | PATCH editorial/protegidos/inexistente; CAS; 1→2→3, repetición sin escritura y transición prohibida 422 |
| MOVIE/SERIES | Película válida; requiere duración y referencia; serie válida sin ambas y rechazo de campos incompatibles |
| Bordes | Fecha inválida/regresiva, versión máxima/overflow, texto Unicode, cast/categorías/año, referencia técnica/proveedor inválidos |
| Contrato público | Datos internos excluidos; referencia/playback y estados consumibles; campos opcionales y diccionarios numéricos coherentes |

En la ejecución original, Catalog era una API interna sin autorización propia; estas pruebas no certificaban la seguridad de escrituras anónimas. Q02 fue corregido posteriormente con ADMIN por RS256/JWKS; consultar SECURITY_REVIEW.md y los nuevos resultados.

### Playback

| Área solicitada | Evidencia principal |
|---|---|
| Assets | ADMIN carga MP4 real; USER403; MIME/firma/body roto/tamaño; ffprobe duration=60, h264, 320×240 y bytes; asset404; soft delete conserva objeto y bloquea sesión activa |
| Start | JWT válido, publicado/READY, missing/unpublished/retirado, Catalog404/5xx/timeout, referencia incompatible, asset ausente y storage no disponible |
| Caída MinIO | Start devuelve503 sin nuevas sesiones/eventos; health503; reinicio conserva endpoint y una URL nueva vuelve a responder Range206 |
| Progress | Posición válida, negativa/no finita/exceso, porcentaje, tolerancia de 2 s, ownership incluso frente a ADMIN, late write de sesión sustituida |
| Estados | Tabla completa de 25 pares; ACTIVE→PAUSED/COMPLETED/FAILED, PAUSED→ACTIVE/COMPLETED, prohibición de reabrir COMPLETED/FAILED |
| Continue/History | Límites exactos 25/50/75/89,99/90/100; exclusión ≥90/completed; orden por actividad, paginación, última sesión por título y aislamiento |
| Outbox | Started/Paused/Completed reales; complete concurrente una sola publicación; rollback de sesión/progreso/outbox ante publisher fallido, incluso con sesión previamente existente |
| Carreras | Dos start reales dejan un único player vigente; progreso del anterior devuelve SESSION_SUPERSEDED; quotas Mongo concurrentes no superan el límite |
| Compensación upload | Si storage sube y metadata falla, se intenta eliminar el mismo objeto; si la compensación también falla no se reporta éxito |
| Seguridad/storage | Bucket privado; sin firma403, firma expirada403, bytes exactos/Range206, credenciales incorrectas no se confunden con objeto inexistente |

La compensación de upload se prueba con puertos controlados; no se afirma que se haya resuelto el seguimiento operativo de objetos huérfanos si también falla el delete. Ese riesgo residual continúa documentado.

## Contratos entre servicios implementados

`playback-service/tests/contract/gateways.test.ts` contiene **31 casos**:

- **13 Playback → Catalog:** DTO real del productor en estados 1/2/3, serie con referencia null, 404/500/503, tres payloads incompatibles, redirección rechazada, conexión HTTP realmente bloqueada que vence en ~4 s y referencia legacy que no se interpreta como asset Playback.
- **18 Playback → Users/JWKS:** token real USER y ADMIN, issuer/audience/exp/sub/userId/role/jti/iat/nbf inválidos, kid/typ incorrectos, firma de otra clave conservando el kid esperado, material RSA inválido, JWKS503 y rechazo de alg none/HS256.

Los imports entre servicios son **exclusivos de tests**. No hay acceso entre bases ni import de módulos ajenos dentro del código productivo. La imagen Playback excluye tests del contexto Docker para mantener su build independiente.

El timeout es real contra un servidor local que no responde; no se simula simplemente un rechazo inmediato de fetch. La firma inválida usa un JWT completo emitido por otra clave, evitando que el test pase por claims ausentes antes de verificar la firma.

## Aislamiento y reproducibilidad

- Users Integration crea su propio PostgreSQL, password y puerto Docker. Truncate solo opera sobre esa conexión generada dentro de la suite. El E2E usa proyecto/volúmenes/env exclusivos.
- Catalog crea Mongo propio; no lee Atlas ni `MONGODB_URI` del usuario para integración. Los scripts de fases usan recursos exclusivos.
- Playback Integration ahora **siempre crea su propio Mongo replica set** y MinIO. No acepta `TEST_MONGODB_URI` externa. La base lleva UUID; no se borra una base de una instancia indicada por usuario.
- MinIO de test usa credenciales generadas, bucket propio y archivos temporales bajo tmpdir. Cleanup valida el directorio temporal antes de borrarlo recursivamente. Docker rm recibe solo nombres generados por la suite.
- No se usó PostgreSQL/Mongo/MinIO del stack de QA, no se borraron sus volúmenes y no se reiniciaron sus contenedores. Las imágenes nuevas se probaron en contenedores exclusivos; la corrección de código no se desplegó reiniciando el servicio compartido.
- `test:coverage` incluye integración y por tanto requiere Docker. `npm test`, `test:unit`, `test:api` y `test:contract` no crean contenedores. Contract Playback sí necesita tener instalados los paquetes de Users y Catalog dentro del monorepo.
- La imagen `playback-minio:2025-10-15` ya existía y fue usada realmente; **no se reconstruyó MinIO en esta tarea**. El comando para prepararla desde clon limpio está indicado abajo. Su compilación requiere red/Go/GitHub y conserva el riesgo de mantenimiento señalado en Q16.

Entorno: Windows/PowerShell, Node 24.21.0 seleccionado para las verificaciones, Docker Desktop Linux 29.8.2, Compose v5.6.0, PostgreSQL17, Mongo8 y MinIO propio. El Node global del host no fue reemplazado. Los tests nuevos no dependen de la cuenta demo ni de archivos multimedia ignorados del frontend.

## Fallos encontrados y correcciones

1. **Fallo real productivo Playback, Q21:** `handle()` capturaba un fallo al construir container/config, pero volvía a llamar `container()` fuera del catch para CORS. La prueba inicialmente falló con excepción sin Response JSON. Se conserva el origen permitido obtenido dentro del try y se usa después solo si existe. El mismo test ahora recibe500 seguro sin detalles privados. **Único archivo productivo modificado:** `playback-service/src/modules/playback/interfaces/http/handlers.ts` (3 líneas añadidas/2 sustituidas en el diff).
2. **Fixture Docker de recuperación:** el primer ensayo nuevo falló por dirección inestable al reiniciar MinIO con publicación de puerto vacía. Una comprobación aislada confirmó que Docker asignó puertos distintos antes/después de stop/start. Se reserva/publica explícitamente un puerto loopback libre, se exige conservarlo y se verifica de nuevo Range206 tras recuperación. Se mantuvieron las aserciones de503/health/ausencia de escrituras; no se debilitó el test.
3. **Tipado de datos adversos en tests:** se corrigieron los tipos de fixtures inválidas y la representación de ENV como strings. Los tres typechecks/lints/builds finales pasaron. No se añadió `ts-ignore`, exclusión de tests ni skip.

Hubo fallos durante el desarrollo de la suite; **los conteos de arriba corresponden a la ejecución final corregida**, no ocultan que se usaron pruebas rojas para encontrarlos. Los errores de depuración no se contabilizan como tests pendientes ni se suman a los casos finales.

## Comandos ejecutados

Con Node24 en PATH y dependencias instaladas, se ejecutaron **en cada uno de los tres servicios**, con código final0:

```powershell
npm run test:unit
npm run test:api
npm run test:contract
npm run test:integration
npm run test:coverage
npm run test:smoke
npm run check
```

`check` ejecutó también `npm test`, `typecheck`, `lint`, `docs:check`, `build` y `build:scripts` (Users/Playback) o `build:init` (Catalog). Se verificaron los comandos de selección por separado, además de la ejecución conjunta de coverage; no basta haberlos declarado en package.json.

También se ejecutaron:

```powershell
# En playback-service: reconstrucción real de la imagen que contiene la corrección.
docker compose build playback-service

# En catalog-service:
npm run verify:phase4
npm run verify:phase5
npm run test:e2e
```

Users/Catalog smoke construyeron sus imágenes/proyectos temporales automáticamente. Playback smoke probó la imagen recién construida. No se ejecutó Docker Compose down sobre el proyecto de QA.

Para preparar **un clon limpio** antes de ejecutar los comandos anteriores (receta de reproducción; no equivale a una reinstalación limpia del host realizada en esta tarea):

```powershell
# Desde la raíz del repositorio, con Docker Linux y Node24 disponibles:
foreach ($service in @('users-service', 'catalog-service', 'playback-service')) {
  Push-Location $service
  try {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw "Falló npm ci en $service" }
  } finally { Pop-Location }
}
Push-Location playback-service
try {
  docker build -f docker/minio.Dockerfile -t playback-minio:2025-10-15 .
  if ($LASTEXITCODE -ne 0) { throw 'Falló la imagen MinIO de test' }
  docker build -t playback-service:local .
  if ($LASTEXITCODE -ne 0) { throw 'Falló la imagen Playback de test' }
} finally { Pop-Location }
# Después ejecutar los comandos de cada servicio; las suites crean su infraestructura.
```

## Artefactos y límites pendientes

Cada servicio genera en su directorio ignorado `coverage/`:

- `test-results.json`: resultado por caso/archivo, passed/failed/pending/todo.
- `coverage-summary.json`: contadores y porcentajes por archivo/global.
- `coverage-final.json`: cobertura detallada V8 convertida al formato del reporte.
- `index.html` y archivos asociados: navegación de cobertura.
- `lcov.info`: integración futura con CI.

Resultados de cobertura reproducibles: [Users HTML](../../users-service/coverage/index.html), [Catalog HTML](../../catalog-service/coverage/index.html), [Playback HTML](../../playback-service/coverage/index.html). Esos artefactos son locales y se regeneran; este documento conserva el resumen versionable. Los reportes no incluyen JWT/cookies ni passwords reales del entorno.

Pendiente fuera de esta entrega: CI versionado, hardening/autorización propia Catalog, remediación de dependencias vulnerables, rotación solapada de claves, revocación distribuida instantánea, todos los escenarios de failover/abort/cleanup, backup/restore/carga sostenida y pruebas del BFF/frontend. Los checks funcionales no resuelven por sí mismos esos riesgos. No se implementaron Playback adicionales ajenos a las pruebas, Recommendations, pagos ni nuevos servicios.
