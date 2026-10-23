# Colección API de NÉVARO

Bruno 4.2.1, archivos de texto versionables y CLI fijada por `package-lock.json`. Contiene **59 peticiones** para los **33 endpoints** de los tres contratos OpenAPI actuales. No necesita consultar bases de datos directamente.

## Ejecutar desde la raíz

Requisitos: Node 24, npm y el stack Docker local con sus cuentas demo inicializadas. Si aún no está levantado:

```sh
npm run stack:up
```

Después:

```sh
npm run api:install
npm run api:check
npm run api:health
npm run api:demo
```

`api:health` ejecuta cuatro peticiones, sin credenciales. `api:demo` ejecuta **57 peticiones y 220 tests** en orden contra APIs, PostgreSQL, ambos MongoDB y MinIO reales. No usa mocks. Cualquier fallo, petición omitida o reporte incompleto produce exit code distinto de cero. No se deshabilitan los rate limits ni se reintentan automáticamente errores 429; esperar su ventana si se hacen muchas ejecuciones seguidas.

La contraseña ADMIN se lee en memoria desde `SEED_PASSWORD` del `.env` raíz. El usuario de pruebas se registra con correo único `bruno-<runId>@example.test` y contraseña aleatoria por ejecución. No depende de cuentas personales ni usa el contenido seed existente. Si se conservaron volúmenes, la contraseña configurada debe coincidir con la cuenta ADMIN previamente creada.

Variables opcionales de proceso: `NEVARO_API_ADMIN_PASSWORD`, `NEVARO_API_USERS_URL`, `NEVARO_API_CATALOG_URL`, `NEVARO_API_PLAYBACK_URL`. No pasar contraseñas mediante argumentos de CLI. Se rechazan destinos remotos: esta colección crea y modifica datos de demostración.

## Abrir en Bruno Desktop

1. Ejecutar `npm run api:setup` desde la raíz.
2. Abrir la carpeta `api/bruno` con **Open Collection**.
3. Seleccionar el entorno **Local**, creado e ignorado por Git. Si ya existe, setup lo conserva.
4. Desactivar envío/almacenamiento automático de cookies en la configuración de la colección. Las peticiones de refresh/logout llevan su cookie explícita para separar USER y ADMIN.
5. Ejecutar `01 Auth/00 ADMIN begin new demo run`, y continuar con el orden de `demo-plan.json` o el flujo de abajo.

Los entornos públicos `Root Stack` (8081/8082/8083) e `Individual Services` (3001/3000/3002) no contienen passwords ni tokens. Para los Compose individuales, copiar el entorno a un archivo `*.local.bru`, configurar las contraseñas demo locales y seleccionarlo en Bruno.

La navegación de carpetas agrupa funcionalidades; **Run Collection en orden de carpetas no equivale al demo**: contiene logout, casos negativos y operaciones que requieren estados previos. El comando `api:demo` pasa al CLI la secuencia exacta de `demo-plan.json`, sin peticiones duplicadas en el repositorio ni paralelismo.

## Carpetas

| Carpeta              | Contenido                                                              |
| -------------------- | ---------------------------------------------------------------------- |
| 00 Health            | Users, Catalog, Playback y JWKS público RS256                          |
| 01 Auth              | Registro, login USER/ADMIN, refresh rotatorio, logout y errores        |
| 02 User              | Me, perfil, cambio de contraseña y rechazo de cambios protegidos       |
| 03 Watchlist         | Agregar, consultar, duplicado 409 y eliminar                           |
| 04 Preferences       | LIKE, DISLIKE, cambio, listado, eliminación y valor inválido           |
| 05 Catalog           | Listado, búsqueda/filtros, detalle, 404 y operador NoSQL rechazado     |
| 06 Admin Catalog     | Importar, reintentar importación, editar, publicar, retirar y permisos |
| 07 Media Assets      | MP4 multipart, metadata, eliminación, asset en uso, MIME y permisos    |
| 08 Playback          | Crear sesión, progreso, pausa, reanudar, renovar URL y completar       |
| 09 Continue Watching | Posición guardada y exclusión de contenido completado                  |
| 10 History           | Historial con contenido completado                                     |

## Variables y captura automática

| Variable                                           | Origen                                                   |
| -------------------------------------------------- | -------------------------------------------------------- |
| usersBaseUrl / catalogBaseUrl / playbackBaseUrl    | Entorno seleccionado o wrapper local                     |
| accessToken                                        | Login USER y refresh exitosos                            |
| adminAccessToken                                   | Login ADMIN exitoso                                      |
| tituloId                                           | Primer resultado de importación exitosa                  |
| assetId                                            | Upload MP4 exitoso                                       |
| sessionId                                          | Inicio de Playback exitoso                               |
| refreshCookie / adminRefreshCookie                 | `Set-Cookie: users_refresh=…`, solo valor de envío       |
| userEmail / userId / runId / importKey / titleName | Datos únicos de la ejecución                             |
| userPassword / newPassword                         | Contraseña generada; nueva contraseña para probar cambio |

Los scripts usan **`bru.setVar`**: tokens, cookies e IDs quedan en memoria, disponibles para las siguientes peticiones de la misma ejecución o sesión Desktop. No usan `setEnvVar`: Bruno 4 guarda sus cambios en disco. `03 Login ADMIN keep captured IDs` permite renovar el acceso ADMIN conservando los IDs para inspección/limpieza manual. `00 ADMIN begin new demo run` inicia datos nuevos.

Refresh/logout usan cookie HttpOnly y `X-CSRF-Protection: 1`, conforme al contrato de este cliente sin Origin. El caso negativo sin el header exige 403. El test de refresh exige rotación de cookie; después de logout se verifica revocación con 401. El cambio de contraseña solo afecta la cuenta recién creada y obliga a un login nuevo.

## Flujo reproducible

```text
Health + JWKS
ADMIN LOGIN → UPLOAD VIDEO → metadata
→ IMPORTAR CATÁLOGO → reintento idempotente → edición → PUBLICAR
→ REGISTER USER → USER LOGIN → DETAIL
→ WATCHLIST → duplicado 409 → LIKE → DISLIKE → LIKE
→ PLAYBACK → PROGRESS (3 s) → PAUSE
→ CONTINUE WATCHING (3 s) → RESUME (3 s) → renovar URL
→ COMPLETE (100%) → excluido de Continue Watching → HISTORY (completed)
→ casos negativos y permisos → REFRESH → cambio de contraseña → LOGIN
→ eliminar watchlist/preferencia → LOGOUT → refresh revocado → ADMIN LOGOUT
```

También comprueba rechazo de eliminación del asset mientras la sesión está pausada, progreso negativo, MIME falso, JWT ausente, USER bloqueado en operaciones ADMIN, email duplicado, credenciales inválidas, campos protegidos y ausencia de hashes/campos internos en todas las respuestas.

El demo predeterminado conserva el título publicado y su pequeño video para inspección. Las cuentas de prueba y el historial permanecen porque no existe un endpoint de borrado de usuario/historial. Mi Lista y preferencias de la cuenta de pruebas se eliminan al finalizar.

Para ejecutar el mismo flujo y **retirar el título y borrar únicamente su asset recién creado**, antes del logout ADMIN:

```sh
npm run api:demo:cleanup
```

Este modo ejecuta 59 peticiones y 227 tests. Conserva el registro de catálogo retirado y la cuenta/historial; no vacía bases ni volúmenes. Si un fallo interrumpe un demo, sus datos parciales pueden permanecer. Para limpiar manualmente en Desktop, conservar los IDs, ejecutar `03 Login ADMIN keep captured IDs`, completar la sesión si sigue abierta, retirar el título y después eliminar su asset. Retirar es irreversible en el dominio actual; usar solo el título creado para la prueba.

## Video de prueba

`fixtures/demo.mp4` es propio y sintético: 12 segundos, H264, 320×180, 24 fps, sin audio, 350607 bytes. No descarga contenido de terceros ni necesita ffmpeg en el host. Se generó con el ffmpeg del contenedor Playback:

```sh
ffmpeg -f lavfi -i testsrc2=size=320x180:rate=24 -t 12 -c:v libx264 -pix_fmt yuv420p -movflags +faststart demo.mp4
```

La petición multipart usa `body: multipartForm` y la parte `file: @file(fixtures/demo.mp4) @contentType(video/mp4)`. `fixtures/not-video.mp4` contiene texto y comprueba que el backend inspecciona el archivo, exigiendo 415 aunque se anuncie como video/mp4.

## Contratos, reportes y mantenimiento

Cada petición comprueba status, JSON Schema derivado del OpenAPI correspondiente (o cuerpo vacío 204), campos sensibles ausentes y sus invariantes específicos: IDs, rol, estado, progreso, códigos de error. Los tests se ejecutan con el sandbox seguro de Bruno, sin permisos de filesystem desde scripts.

`endpoint-coverage.json` enumera los 33 endpoints. `api:check` analiza todos los archivos con el parser real de Bruno, verifica cobertura de operaciones y detecta diferencias con las peticiones generadas, esquemas OpenAPI y plan. Ante cambios de contrato, editar `generate.mjs`, regenerar y revisar el diff:

```sh
npm run generate --prefix api/bruno
npm run api:check
npm test
npm audit --prefix api/bruno --audit-level=moderate
```

El wrapper guarda `reports/<modo>-results.json`, `-junit.xml`, `-output.log` y `-summary.json`, ignorados por Git. Omite cuerpos y headers de los reportes y redacta contraseñas conocidas, JWT, refresh tokens y URLs firmadas antes de guardar/mostrar diagnósticos. Borra los reportes crudos temporales al terminar. Los entornos públicos se comparan antes/después para detectar persistencia accidental.

CI instala esta CLI mediante `npm ci`, valida contratos y audit, y ejecuta `api:demo:cleanup` después del smoke del stack raíz. Sube solo reportes saneados. El resultado local está en [API_COLLECTION_RESULTS.md](../../docs/quality/API_COLLECTION_RESULTS.md); no implica que exista un run remoto de GitHub Actions.

Referencias: [Bruno 4 y persistencia de variables](https://www.usebruno.com/v4-release), [API de scripts](https://docs.usebruno.com/testing/script/javascript-reference), [CLI](https://docs.usebruno.com/bru-cli/commandOptions).
