# Matriz de pruebas — NÉVARO

Fecha: 17/10/2026. Base: `a20fc9a6bf5af7d68ce1066b6c1b5166d08e94b6`. Diagnóstico y severidades: [QUALITY_AUDIT.md](QUALITY_AUDIT.md). Esta matriz **no añade ni ejecuta tests nuevos**; diferencia pruebas encontradas de ampliaciones propuestas.

Estados: **E** = suite existente ejecutada y correcta en esta auditoría; **I/H** = test inspeccionado y resultado histórico, sin ejecución nueva; **Parcial E** = hay aserciones correctas, faltan los casos indicados; **Pendiente** = no se encontró aserción específica. Cada fila puede agrupar una familia de casos; no cuenta tests ni expresa cobertura porcentual. `E` de API indica un script assert, no necesariamente Vitest. En filas nuevas se señalan expectativas a especificar cuando el contrato actual no las garantiza.

Dependencias abreviadas: **PG-T** PostgreSQL Docker propio; **CM-T** Mongo Catalog propio; **PM-T** Mongo Playback replica set propio; **S3-T** MinIO/bucket propios; **R-T** Redis propio; **STACK-T** cuatro apps + sus persistencias de test; **JWKS-F/CAT-F** servidor HTTP fixture. Estas dependencias son del entorno de prueba, nunca bases productivas. El stack frontend existente todavía es compartido; la columna de dependencias indica ese hecho o el aislamiento propuesto.

## Users Service: todas sus operaciones e invariantes

| Servicio | Funcionalidad | Tipo de prueba | Caso positivo | Caso negativo | Dependencias | Mock/real | Prioridad | Estado |
|---|---|---|---|---|---|---|---|---|
| Users | U01 POST /api/v1/auth/register | API | 201, email normalizado, USER, sin hash | 409 duplicado; 400 role extra; 413 | PG-T, app Docker | Real | P0 | E: verify-docker, grupo registro |
| Users | U02 POST /api/v1/auth/login | API | JWT, expiresIn y cookie HttpOnly/Strict | Password incorrecta; media type/JSON inválido; 429 | PG-T, Argon2/RSA | Real | P0 | E: verify-docker |
| Users | U03 POST /api/v1/auth/refresh | API | Rota cookie/access y conserva expiración absoluta | CSRF, replay, familia revocada | PG-T | Real | P0 | E: API + integración; falta fallo de firma/commit |
| Users | U04 POST /api/v1/auth/logout | API | 204 y refresh revocado; repetición sin cookie | Token anterior o revocado no recupera familia | PG-T | Real | P0 | E: API e integración |
| Users | U05 GET /api/v1/users/me | API | DTO del usuario autenticado | Anónimo/JWT inválido/versión anterior | PG-T | Real | P0 | E: API; ampliar claims en S01 |
| Users | U06 PATCH /api/v1/users/me | API | Perfil parcial y avatar null | status/role/hash/userId extra; identidad inválida | PG-T | Real | P1 | Parcial E: campos protegidos, falta tabla completa |
| Users | U07 POST /api/v1/users/me/change-password | API | Verifica actual, invalida sesiones/versiones | Password actual errónea; antigua no inicia sesión | PG-T, Argon2 | Real | P0 | E: API e integración |
| Users | U08 GET /api/v1/users/me/watchlist | API | Paginación y solo tituloId/addedAt | Otra cuenta no ve items; offset excesivo | PG-T | Real | P1 | Parcial E: aislamiento probado, ampliar límites |
| Users | U09 POST /api/v1/users/me/watchlist/:tituloId | API | 201 referencia propia | Duplicado 409; ID inválido | PG-T | Real | P1 | E: API + unit/integración |
| Users | U10 DELETE /api/v1/users/me/watchlist/:tituloId | API | 204, idempotente | Otra identidad no borra item ajeno | PG-T | Real | P0 | E: API + integración |
| Users | U11 GET /api/v1/users/me/preferences | API | Lista propia paginada | Sin sesión/no hereda otra cuenta | PG-T | Real | P1 | Parcial E: ampliar páginas/bordes |
| Users | U12 PUT /api/v1/users/me/preferences/:tituloId | API | LIKE, DISLIKE, cambio; PUT igual conserva timestamp | Enum/ID/campos extra inválidos | PG-T | Real | P1 | Parcial E: idempotencia real; ampliar tabla inválidos |
| Users | U13 DELETE /api/v1/users/me/preferences/:tituloId | API | Elimina señal, 204 | Otra cuenta/no sesión | PG-T | Real | P1 | Parcial E: eliminación probada; ampliar permisos por ruta |
| Users | U14 GET /api/health | Smoke | SQL y claves disponibles → 200 | PostgreSQL caído → 503 | PG-T, app Docker | Real | P0 | E: verify-docker; caída solo del contenedor propio |
| Users | U15 GET /.well-known/jwks.json | Contract | Clave pública valida JWT externo | No contiene d/p/q/k privados | RSA, app | Real | P0 | E: unit/API; esquema completo pendiente |
| Users | U16 Bordes del agregado/password/perfil/paginación (Q23) | Unit | Fechas, estado, versión y Unicode en borde válido | Restore corrupto, fechas regresivas, longitudes/offset fuera de borde | Ninguna | Puertos fake, dominio real | P1 | Pendiente: ampliar domain/application existentes |
| Users | U17 Migración concurrente y compatibilidad (Q19/Q23) | Integration | Dos migradores convergen con esquema correcto | Lock/DDL/versión incompatible falla sin corrupción | PG-T | Real | P1 | Parcial E: repetición/rollback ya probados; concurrencia pendiente |
| Users | U18 Refresh/password ante fallo y concurrencia | Integration | Una rotación válida; familia segura | Firma después de rotar falla; logout/rotate/password simultáneos | PG-T, firmador controlado | PG real, fallo inyectado | P0 | Parcial E: replay/dos refresh/password ya pasan |
| Users | U19 Cuotas y limpieza | Integration | Contador atómico; expira ventana; cleanup repetible | Cuota global agotada; limpieza no elimina familia vigente | PG-T, reloj controlado | Real | P1 | Parcial E: contador compartido sí; bordes/cleanup pendientes |

## Catalog Service: todas sus operaciones y persistencia

| Servicio | Funcionalidad | Tipo de prueba | Caso positivo | Caso negativo | Dependencias | Mock/real | Prioridad | Estado |
|---|---|---|---|---|---|---|---|---|
| Catalog | C01 GET /api/health | Smoke | Mongo disponible → 200 | Mongo caído → 503 sin secretos | CM-T, Next construido | Real | P0 | E: fase6/7 |
| Catalog | C02 GET /api/v1/catalog | API | Texto, filtros, proyección y paginación | Operadores, filtros/query desconocidos/repetidos | CM-T | Real | P1 | E: fase6, HTTP unit e integración |
| Catalog | C03 GET /api/v1/catalog/:tituloId | API | Ficha y equivalencias numéricas | ID inválido/404, sin metadata interna | CM-T | Real | P1 | E: fase6 |
| Catalog | C04 POST /api/v1/catalog/bulk | API | 201, retry 200, parcial 207, importKey estable | Conflicto 409, body roto/excesivo, inválidos sin escribir | CM-T | Real | P1 | E: fase6/7; autorización en S06 |
| Catalog | C05 PATCH /api/v1/catalog/:tituloId | API | Edita ficha, null limpia, no-op | Campo inmutable, 404, CAS obsoleto | CM-T | Real | P1 | E: API y persistencia; permiso propio ausente |
| Catalog | C06 PATCH /api/v1/catalog/:tituloId/publication-status | API | 1→2→3, no-op | Transición prohibida → 422 | CM-T | Real | P1 | E: fase6; permiso propio ausente |
| Catalog | C07 Contrato OpenAPI ejecutable (Q07) | Contract | Respuestas/errores de 6 operaciones coinciden con YAML | DTO/schema/header/tipo divergente falla | Next, CM-T, SwaggerParser/Zod existentes | Real | P1 | Parcial E: YAML/diccionarios/ejemplos sí; respuestas completas no |
| Catalog | C08 Bordes de agregado/referencia/ficha (Q23) | Unit | Versión/fecha/límites válidos; arrays canónicos | Overflow, fecha inválida, proveedores/campos inválidos | Ninguna | Dominio real | P1 | Parcial E: invariantes principales probadas; bordes pendientes |
| Catalog | C09 Bulk/CAS ante fallo incierto | Integration | Reconcilia importKey concurrente sin duplicar | Lectura de reconciliación/commit incierto no inventa éxito | CM-T | Real con fallos controlados | P1 | Parcial E: carreras/desconexión sí; ampliar inyección |
| Catalog | C10 Init BSON/índices/episodios preparados | Integration | Init repetible, Int32, índices títulos/episodios | Índice incompatible, BSON inválido, unicidad posición episodio | CM-T | Real | P1 | E: integración + fase4; no API de episodios |

## Playback Service: todas sus operaciones y medios

| Servicio | Funcionalidad | Tipo de prueba | Caso positivo | Caso negativo | Dependencias | Mock/real | Prioridad | Estado |
|---|---|---|---|---|---|---|---|---|
| Playback | P01 GET /api/health | Smoke | Mongo/bucket disponibles → 200 | MinIO caído → 503 | PM-T, S3-T | Real | P0 | Parcial E: caída MinIO sí; Mongo/recuperación por ampliar |
| Playback | P02 POST /api/v1/media/assets | API | ADMIN sube MP4 real, metadata sin objectKey | USER403, MIME/firma/tamaño/multipart/campo extra | PM-T, S3-T, ffprobe, JWKS-F | Media/DB reales; identidad fixture | P0 | E: verify-docker |
| Playback | P03 GET /api/v1/media/assets/:assetId | API | ADMIN recibe metadata | USER403, asset inexistente404 | PM-T, JWKS-F | Real + JWT fixture | P1 | Parcial E: éxito/403 sí; ampliar ID/404 |
| Playback | P04 DELETE /api/v1/media/assets/:assetId | API | Borrado lógico conserva bytes | Asset en uso409; USER403 | PM-T, S3-T, JWKS-F | Real + fixtures | P0 | E: unit/API; carrera en P15 |
| Playback | P05 POST /api/v1/playback/sessions | API | Publicado + READY → ACTIVE y URL | 401, Catalog404/503/no publicado, asset ausente | PM-T, S3-T, CAT-F/JWKS-F | Storage/DB reales; HTTP fixture | P0 | E: API; integración real H |
| Playback | P06 PATCH /api/v1/playback/sessions/:sessionId/progress | API | Persiste posición, milestones y retry | Propietario ajeno403, negativo/exceso400, sustituida409 | PM-T, JWKS-F | Real + fixtures | P0 | E: API/unit |
| Playback | P07 POST /api/v1/playback/sessions/:sessionId/pause | API | Pausa con posición; retry igual | Estado/owner/posición inválidos | PM-T, JWKS-F | Real + fixtures | P1 | Parcial E: éxito/idempotencia; matriz negativos por ampliar |
| Playback | P08 POST /api/v1/playback/sessions/:sessionId/resume | API | PAUSED→ACTIVE y nueva URL | COMPLETED→ACTIVE409; otro propietario | PM-T, S3-T, JWKS-F | Real + fixtures | P1 | Parcial E: estados sí; todos los permisos por ampliar |
| Playback | P09 POST /api/v1/playback/sessions/:sessionId/complete | API | Dos complete publican un evento | Sesión ajena/inexistente/sustituida | PM-T, JWKS-F | Real + fixtures | P0 | Parcial E: concurrencia real sí; negativos completos pendientes |
| Playback | P10 POST /api/v1/playback/sessions/:sessionId/refresh-url | API | URL vigente para dueño | Otro owner403/sustituida409/asset borrado | PM-T, S3-T, JWKS-F | Real + fixtures | P0 | Parcial E: ownership/sustitución sí; outage/asset por ampliar |
| Playback | P11 GET /api/v1/playback/me/continue-watching | API | Retoma posición; excluye completados/≥90 % | Otra cuenta vacía; filtros/paginación inválida | PM-T, JWKS-F | Real + fixtures | P1 | Parcial E: camino principal sí; umbral exacto/páginas pendiente |
| Playback | P12 GET /api/v1/playback/me/history | API | Historial propio con completed | Otra cuenta vacía; sin identidad401 | PM-T, JWKS-F | Real + fixtures | P1 | E principal; negativos/límites a ampliar |
| Playback | P13 Progreso/transiciones/milestones (Q23) | Unit | Límites 25/50/75/90/100, tolerancia y retroceso | Todos los pares prohibidos y duración inválida | Ninguna | Dominio real, repositorios fake | P1 | Parcial E: 26 unit; tabla de bordes pendiente |
| Playback | P14 Unidad transaccional/outbox | Integration | Sesión/progreso/evento atómicos; complete único | Publisher falla → rollback de todos los writes | PM-T | Mongo real; publisher con fallo | P0 | E: 5 integración dentro del E2E |
| Playback | P15 Carreras start/start/delete/progress | Integration | Una sesión vigente y progreso coherente | No aceptar escritura tardía ni borrar asset que quedó en uso | PM-T, storage/catalog controlados | DB real, puertos controlados | P1 | Parcial E: sustitución secuencial sí; carreras pendientes |
| Playback | P16 Replica set/commit/retry | Integration | Retry conserva identidad lógica y eventos únicos | Caída primario/commit no confirma éxito falso | PM-T | Real | P1 | Pendiente |
| Playback | P17 Upload abortado y ffprobe fallido | Integration | MP4 H.264/AAC y limpieza temporal | Abort, timeout, códec inválido, múltiples archivos, salida inválida | S3-T, PM-T, ffprobe | Real con fallos inyectados | P1 | Parcial E: formato/body sí; abort/timeout/cleanup pendientes |
| Playback | P18 Compensación y objetos huérfanos (Q11) | Integration | Fallo DB tras put elimina objeto | Delete compensatorio falla; no READY falso; huérfano detectable | PM-T, S3-T | Real + fallo controlado | P1 | Pendiente |
| Playback | P19 URL/privacidad/Range | Security | Firma válida, GET parcial206 y tamaño | Sin firma403 y firma vencida403 | S3-T | Real | P0 | E: verify-docker |
| Playback | P20 MinIO caído/permiso/config | Integration | Recupera upload/lectura con permisos necesarios | Timeout403/5xx, bucket ausente, IAM insuficiente | S3-T, PM-T | Real | P1 | Parcial E: health caído sí; permisos/recuperación pendientes |
| Playback | P21 OpenAPI completo | Contract | 12 operaciones/DTO/errores conforme a YAML | Drift de shape/headers/status falla | App, PM-T, S3-T | Real | P1 | Parcial E: YAML/cantidad sí; validación de todas las respuestas no |

## Seguridad transversal

| Servicio | Funcionalidad | Tipo de prueba | Caso positivo | Caso negativo | Dependencias | Mock/real | Prioridad | Estado |
|---|---|---|---|---|---|---|---|---|
| Users/Playback | S01 Matriz JWT/claims | Security | RS256 issuer/audience/sub/userId/role/exp coherentes | alg none/HS256, firma/clave/kid/aud/typ/claims ausentes o alterados | Claves de prueba, JWKS-F | Criptografía real | P0 | Parcial E: firma/exp/aud Users y issuer/exp Playback; ampliar matriz |
| Users/BFF | S02 CSRF/cookies | Security | HttpOnly/Strict, Secure HTTPS, cabecera/origen válidos | Origin ajeno, Fetch Metadata cross-site, sin cabecera, cookie duplicada | PG-T, R-T, BFF test | Real + requests controlados | P0 | Parcial E backend; BFF I/H; matriz completa pendiente |
| Users | S03 Password hashing y no filtración | Security | Argon2id sal aleatoria y parámetros previstos | Hash/password/token nunca en DTO/log; login genérico | Argon2, capturador de logs | Real | P0 | E: unit/API; extender al BFF/Playback |
| BFF | S04 Todas las operaciones personales/ADMIN | Security | Identidad válida actúa solo en alcance propio | Anónimo401/USER403 en cada rama admin; no proxy arbitrario | R-T, Users fixture o PG-T | Servidor real, upstream controlado | P0 | Parcial I/H: un POST admin negado; matriz completa pendiente |
| Users/Playback | S05 Cuotas y recuperación | Security | Usuarios distintos operan dentro de cuotas | Email targeting, límite global/API, concurrencia y cambio de ventana | PG-T/PM-T, reloj | Real | P1 | Parcial E: contadores/upload/login sí; carga y recuperación no |
| Catalog | S06 Autorización propia y red (Q02) | Security | Consumidor autorizado según contrato objetivo | Anónimo/USER no pueden bulk/editar/publicar; red pública cerrada | CM-T, app, RSA/JWKS efímeros | Real | P0 | Ejecutado: 25 casos API con JWT/JWKS reales y smoke Docker denegando anónimo/USER en tres escrituras; ADMIN publica/edita en E2E |
| Frontend | S07 Dependencias y superficies Next (Q01) | Security | Paquetes corregidos/no alcanzables documentados | Alerta no justificada falla gate; nuevas rutas OG/remotas disparan revisión | Registro npm, lockfiles/imágenes | Audit real; no exploit | P0 | E: audit detecta alertas; gate/remediación pendientes |
| Users/Playback | S08 JWKS rotación/cache/outage | Integration | Cache caliente y transición de kid según política | Clave desconocida, claves antiguas retiradas, JWKS timeout/malformado | Users real + JWKS-F, reloj | Mixto | P1 | Pendiente: hoy una sola clave; definir solapamiento objetivo |
| Users/Playback/MinIO | S09 Logout/password y TTL externo | Security | Refresh revocado; rechazo local por authVersion | JWT/URL anterior solo hasta TTL; no afirmar revocación inmediata | PG-T, PM-T, S3-T, reloj | Real | P1 | Parcial E Users; límite temporal entre servicios pendiente |
| Frontend/Playback | S10 Logs y artefactos saneados | Security | requestId y metadatos útiles | Ningún password/cookie/JWT/URL firmada en logs/reportes | Capturador, STACK-T | Real | P1 | Parcial E Users/Catalog; Playback/BFF/artefactos pendiente |

## BFF: rutas adicionales y sesiones de servidor

| Servicio | Funcionalidad | Tipo de prueba | Caso positivo | Caso negativo | Dependencias | Mock/real | Prioridad | Estado |
|---|---|---|---|---|---|---|---|---|
| BFF | B01 POST auth/register y auth/login | API | Registro/login, respuesta sin tokens y cookie opaca | JSON/credencial inválida, upstream429, forma auth inválida | R-T, Users HTTP controlado | BFF real, upstream fixture | P0 | I/H positivo; negativos aislados pendientes |
| BFF | B02 GET me, PATCH me, POST me/change-password | API | DTO/actualización/password seguido de logout | Invalid credentials no expira UI; upstream401 sí | R-T, Users HTTP | Mixto | P0 | I/H positivo; componente E diferencia401; servidor aislado pendiente |
| BFF | B03 POST auth/logout | API | Borra cookie y sesión/refresh | Redis/Users caído → revoked=false; sin promesa de revocación | R-T, Users HTTP | Real con fallos | P0 | I/H: test detiene Redis compartido; aislar antes de ejecutar |
| BFF | B04 Sesión cifrada/TTL | Integration | AES-GCM roundtrip y TTL absoluto | Ciphertext/tag corrupto, cookie inválida, sesión expirada | R-T | Redis/crypto reales | P0 | Pendiente |
| BFF | B05 Lock refresh concurrente | Integration | Varias peticiones → una rotación | Lock vencido/owner ajeno/CAS fallido sin sobreescribir sesión | R-T, Users HTTP | Redis real; upstream controlado | P0 | I/H single refresh; bordes pendientes |
| BFF | B06 Refresh incierto | Integration | Respuesta confirmada guarda nuevo refresh | Timeout después de rotar marca uncertain; no reutiliza refresh anterior | R-T, Users HTTP | Real con corte controlado | P0 | Pendiente |
| BFF | B07 GET catalog y catalog/:tituloId | API | Solo publicados; consumidor no filtra status arbitrario | Registrado/retirado no visible; datos malformados/404 | R-T, Catalog HTTP | Servidor real, fixture | P0 | I/H detalle; matriz servidor pendiente |
| BFF | B08 GET library/{watchlist,preferences,continue-watching,history} | Integration | Conserva paginación y referencias, cuatro consultas concurrentes máximo | 404/503 parcial, timeout global/cancelación; sin datos cruzados | R-T, APIs controladas | BFF real, upstream fixtures | P1 | I/H principal; fallos/enriquecimiento no aislados |
| BFF | B09 GET state/:tituloId | Integration | Encuentra señal a través de varias páginas | Más de 10 páginas → unknown; error de una fuente | R-T, Users HTTP | Mixto | P1 | Componente E con unknown; servidor pendiente |
| BFF | B10 POST/DELETE watchlist y PUT/DELETE preferences | API | Alta/cambio/borrado de referencias propias | Duplicado409, valor inválido, sin sesión | R-T, Users HTTP | Mixto | P1 | I/H POST/PUT; DELETE de ambas rutas sin aserción HTTP encontrada |
| BFF | B11 POST sessions y PATCH progress; POST pause/resume/complete/refresh-url | API | Las seis operaciones envían body/método correcto | Owner ajeno/sesión sustituida/body inválido/upstream caído | R-T, Playback HTTP | Mixto | P1 | I/H parcial; resume BFF sin aserción específica encontrada |
| BFF | B12 GET/POST admin/catalog; GET/PATCH admin/catalog/:id; PATCH publication-status | API | ADMIN administra; publicar película exige asset READY | USER403; asset ausente/DELETED; no campos protegidos | R-T, Catalog/Playback HTTP | Mixto | P0 | I/H POST/PATCH; GETs, retiro/READY negativo y permisos completos pendientes |
| BFF | B13 POST admin/assets; GET/DELETE admin/assets/:id | API | Streaming acotado y metadata sin secretos | 413 chunked/abort/415/USER403; GET/DELETE adversos | R-T, Playback HTTP | Stream real, upstream controlado | P0 | I/H upload; GET/DELETE y negativos específicos pendientes |
| BFF | B14 Contrato/métodos/rutas/tipos generados | Contract | 31 combinaciones y diccionarios géneros/idiomas coinciden con APIs | Método/ruta/query/body no admitidos y drift de tipos/etiquetas fallan | YAML backend, generador existente, BFF | Real + fixture | P1 | Pendiente; no OpenAPI BFF ni gate de drift actual |

## Frontend: recuperación, aceptación y UX

| Servicio | Funcionalidad | Tipo de prueba | Caso positivo | Caso negativo | Dependencias | Mock/real | Prioridad | Estado |
|---|---|---|---|---|---|---|---|---|
| Frontend | F01 Cola de progreso y navegación segura | Unit | Orden, coalescencia, retroceso, safeReturn | Error de red no bloquea; sustituida detiene; retorno externo rechazado | Ninguna | Callbacks controlados | P1 | E: player.test.ts |
| Frontend | F02 Normalización query | Unit | Unicode/filtros válidos | Operadores, códigos/bordes fuera de contrato | Ninguna | Función real | P1 | E: query.test.ts |
| Frontend | F03 Acciones personales/cache | Integration | Preview4 y biblioteca20 no comparten página incompleta | POST rechazado revierte; estado unknown deshabilita | jsdom, QueryClient, fetch fake | Mock HTTP | P1 | E: 4 tests component incluyendo401 |
| Frontend | F04 AuthForm/errores/Unicode | Integration | Login/registro y cooldown recuperable | Email/password en bordes,429, fallo de red; doble submit | jsdom, RHF, router/fetch fake | Mock | P1 | Pendiente: recorrido positivo I/H; sin suite específica de formulario |
| Frontend | F05 SearchField/debounce/URL | Integration | 300 ms, filtro y back/forward coherentes | Petición anterior/timer desmontado no gana ni rompe Unicode | jsdom, reloj/router fake | Mock | P1 | Pendiente |
| Frontend | F06 Library paginación/error parcial | Integration | Avanza páginas y compone items | Borra último item de página,404/503, error/retry sin perder referencias | jsdom, QueryClient, fetch fake | Mock | P1 | Parcial E: clave preview/tamaño sí; límites y recuperación pendientes |
| Frontend | F07 Upload incierto/importKey/draft | Integration | Asset confirmado conserva clave y recupera ficha | Timeout/abort/409/207 incierto no duplica carga/ficha | jsdom, XHR/sessionStorage fake | Mock | P1 | Pendiente; aceptación positiva I/H |
| Frontend | F08 Editor/campos/confirmación retiro | Integration | Preserva campos no editables y muestra éxito | Fallo409/503, cancelar dialog, doble publicación | jsdom, fetch fake | Mock | P1 | Pendiente; edición positiva I/H |
| Frontend | F09 Player fallos/renovación/competencia | Integration | Guardar, renovar y conservar paused/posición | Media error,401/409, TTL inválido, retry, pagehide concurrente | jsdom o navegador según API media, BFF fixture | Mixto | P1 | Parcial E cola; interacción Player y fallos pendientes |
| Frontend | F10 Perfil/cambio de cuenta | Integration | Guardado parcial/aviso de cambios/cache vacía | Password actual errónea no expulsa; error conserva formulario | jsdom/router/QueryClient | Mock | P1 | Parcial E: diferencia401; formularios/dirty/cache ampliar |
| Frontend | F11 Registro→login→lista/preferencias→logout | E2E | Persistencia real y cuenta B aislada | Duplicado/credenciales incorrectas/DELETE y permisos | Hoy stack compartido; migrar a STACK-T | Servicios reales | P0 | I/H: escenario extenso existente; no ejecutado ahora |
| Frontend | F12 Ver MP4→seek→pausa→continuar→completar | E2E | Bytes reales/posición/historial/renovación | Sesión sustituida, MinIO inaccesible, renovación fallida | STACK-T, MP4 generado propio | Real | P0 | I/H: positivo y renovación existentes; fallos pendientes |
| Frontend | F13 ADMIN upload→ficha→publicación→edición | E2E | Nuevo título visible/reproducible | USER bloqueado; fallo parcial/retry/retirar | Hoy stack compartido; migrar a STACK-T | Real | P0 | I/H positivo; negativos/retiro pendientes |
| Frontend | F14 Refresh concurrente y logout degradado | E2E | Una rotación; cierre local explícito | Redis/Users caído; sin reutilización insegura | STACK-T exclusivo, Docker | Real | P0 | I/H: tests existentes acoplados a nombres/Redis compartido |
| Frontend | F15 Explorar/buscar/paginar/series | E2E | Filtros combinados, URL y detalle publicados | Sin resultados, inválidos, retirado, serie sin reproducir | STACK-T, catálogo fixture real | Real | P1 | Pendiente: no recorrido específico encontrado |
| Frontend | F16 Navegadores/responsive | E2E | Chromium/WebKit/Firefox y anchos representativos | Overflow/dialog/fullscreen/codec no soportado recuperables | STACK-T, navegadores Playwright | Real | P2 | I/H cinco anchos Chromium; otros navegadores pendientes |
| Frontend | F17 Teclado/AT/accesibilidad | E2E | Foco, labels, dialog, player y navegación por teclado | Sin trampas, errores anunciados, zoom/reduced motion | Navegador; lector de pantalla en campaña manual | Real | P2 | Pendiente de campaña completa; semántica inspeccionada |
| Frontend | F18 Presupuesto UX/composición | Smoke | Inicio/listas/player con tiempos medidos y volumen definido | Catalog lento/caído no acumula espera sin límite | STACK-T, fixtures de volumen/red | Real con degradación | P2 | Pendiente; sin métricas p75 reales actuales |

## Infraestructura, reproducibilidad y CI

| Servicio | Funcionalidad | Tipo de prueba | Caso positivo | Caso negativo | Dependencias | Mock/real | Prioridad | Estado |
|---|---|---|---|---|---|---|---|---|
| Todos | X01 Baseline comandos/commit | Smoke | Repite checks identificando commit/runtime | Fallo de cualquier comando detiene gate | Node24, cuatro proyectos | Real | P0 | E local; automatización pendiente |
| Todos/Frontend | X02 Aislamiento de recursos E2E | Security | Namespace, puertos, datos y cleanup por ejecución | URL/DB/volumen ajenos y stack compartido rechazados | Docker, STACK-T propuesto | Real | P0 | Backend E aislado; frontend pendiente |
| Frontend | X03 Fixtures reproducibles | Integration | Genera seed/MP4/título/IDs sin depender de archivos ignorados | Falta de fixture falla preflight sin tocar QA | STACK-T, ffmpeg | Real | P0 | Pendiente de automatización para clon limpio |
| Frontend | X04 Alcance ESLint TSX (Q03) | Smoke | Player/componentes tienen configuración aplicable | TSX omitido falla gate | ESLint existente | Real | P0 | E diagnóstico: print-config undefined; corregir después |
| Frontend | X05 Alcance typecheck TSX tests (Q04) | Smoke | Ambos tests de componentes incluidos y tipados | Omisión/error de tipos detectado | TypeScript existente | Real | P1 | E diagnóstico: tests no aparecen en listFiles |
| Todos | X06 Audit y triage dependencias | Security | Alertas cerradas o excepción específica justificada | Avisos nuevos/no justificados bloquean release | npm registry, lockfiles, imágenes | Real | P0 | E: alertas detectadas; gate y remediación pendientes |
| Todos | X07 CI mínima de regresión | Smoke | npm ci, check e integración con reportes saneados | Tests/build/contrato fallan job | Runner CI, Node24, Docker | Real | P0 | Pendiente: no CI versionado |
| Todos | X08 Imagen/config/secreto/runtime | Security | Imagen identificada, no root, ENV mínima y servicios privados | Secretos en capa/log, env inválida, puerto abierto, imagen obsoleta | Docker builds, namespace de test | Real | P1 | Parcial E: Docker Users/Catalog y no-root; ampliar imagen/ENV/secretos |
| Todos | X09 Smoke integrado/readiness | Smoke | Apps/dependencias y JWT real entre servicios funcionan | Caída de cada dependencia detectada; se recupera | STACK-T | Real | P1 | Parcial E smoke anónimo/backend aislado; readiness frontend pendiente |
| Users/Catalog/Playback | X10 Backup/restore/upgrade | Integration | Restaura datos/índices/assets/relaciones por ID | Backup incompleto o versión incompatible no pasa validación | PG-T, CM-T, PM-T, S3-T | Real | P2 | Pendiente |
| Users/Playback/BFF | X11 Retención/TTL/outbox | Integration | Expiran sesiones/cuotas y limpieza conserva estado válido | No borrar familia vigente; crecimiento PENDING visible | PG-T, PM-T, R-T | Real | P2 | Parcial E TTL/limpieza inspeccionados; ciclo completo pendiente |
| Todos | X12 Volumen y recuperación sostenida | Smoke | Paginación/colas/carga dentro de presupuesto acordado | DB/Redis llenos, latencia, reinicio y límites de pools | STACK-T dedicado | Real | P2 | Pendiente; no generar carga en QA compartido |

## Orden de implementación y aceptación

Seguir exactamente los diez pasos de la sección 20 del informe: **aislamiento → gates/CI/dependencias → identidad/BFF → bordes unitarios → persistencia/concurrencia → contratos/API → medios/JWKS → recuperación frontend → E2E real aislado → smoke y campaña P2**. Los IDs de la matriz permiten planificar ese orden sin crear otra herramienta de gestión.

Una fila solo pasa a «E» cuando se implementan y ejecutan sus aserciones pendientes en un entorno identificado. Registrar comando, commit, versiones, resultado y limpieza. No convertir H en E por copiar un informe anterior, ni exigir a la aplicación comportamientos fuera del contrato sin documentar primero el cambio. Mantener Vitest, Testing Library, SwaggerParser/Zod, scripts assert y Playwright existentes; no se necesita un runner nuevo.
