# Resultados de pruebas del frontend NÉVARO

> Actualización de hardening (20/10/2026): este documento conserva el estado de su ejecución original. Autorización de Catalog, dependencias y resultados posteriores están en [SECURITY_REVIEW.md](SECURITY_REVIEW.md) y [HARDENING_RESULTS.json](HARDENING_RESULTS.json). Q02 quedó corregido en código; la rotación de la credencial Atlas expuesta sigue pendiente.

Fecha: 20 de octubre de 2026 (America/Lima). Alcance: `frontend` y su integración real con Users, Catalog y Playback. Se reutilizaron Next App Router, React, TypeScript, Vitest, Testing Library y Playwright existentes. No se cambiaron reglas de producción ni se agregaron endpoints de depuración.

## Inspección y cambios

La base tenía 20 pruebas Vitest y cinco E2E que dependían de `.env`, cuentas demo compartidas, un JSON local y un MP4 ignorado por Git. Una prueba detenía Redis del entorno de desarrollo. Se conservaron sus regresiones útiles y se distribuyeron en escenarios independientes, con infraestructura exclusiva del runner.

Los componentes existentes se llaman `AuthForm` (login y registro), `Card`, `Section`, `Explore`, `PersonalActions`, `Library`, `Player` y `Upload`. No se introdujeron componentes ficticios para adaptar los nombres del requerimiento.

ESLint ahora comprueba TSX y TypeScript incluye explícitamente código/pruebas TSX. Esto detectó opciones `exact` que Testing Library no admite en `getByRole`; se eliminaron, manteniendo la coincidencia exacta que esa consulta ya aplica a nombres de tipo string. Las opciones equivalentes de Playwright se conservan.

## Verificaciones ejecutadas

| Comando desde `frontend` | Resultado |
|---|---|
| `npm test` | **65/65**, confirmado también mediante `npm run check` |
| `npm run test:coverage` | **65/65**, diez archivos; 16 Unit y 49 Component |
| `npm run typecheck` | **Correcto**, incluidos tests y reporter nuevos |
| `npm run lint` | **Correcto**, incluidos tests y reporter nuevos |
| `npm run build` | Correcto; build de producción Next y generación de rutas |
| `npm run test:e2e` | **12/12**, cero fallos/skips/flaky, cero retries; última suite de **67,1 s** |

No hay `skip`, `fixme`, `test.fails` ni reintentos automáticos. Los E2E usan Chromium real y un worker; las llamadas BFF/microservicios y los bytes MP4 no están interceptados con mocks.

## Cobertura V8

| Métrica | Cubierto/total | Porcentaje |
|---|---|---|
| Statements | 484/608 | 79,60% |
| Branches | 433/600 | 72,16% |
| Functions | 102/147 | 69,38% |
| Lines | 465/574 | **81,01%** |

El denominador incluye componentes, features, cliente HTTP y utilidades, también archivos sin pruebas de componente. No incluye las rutas Next/BFF, el código server de Redis, CSS ni los otros servicios. Playwright no aporta instrumentación a estos porcentajes.

AuthForm: 96,55% de líneas; catálogo: 97,67%; PersonalActions: 92,85%; Player: 77,65%; cola de reproducción: 100%; Upload: 89,77%; Editor: 95%; Shell: 100%; Profile: 88%. `Providers` y `Content` conservan 0% de cobertura de componente: la expiración de sesión sí se comprueba en el navegador real. No se presenta esto como cobertura completa de todas las ramas de administración.

## Matriz de componentes y comportamiento

| Área | Casos comprobados | Archivo |
|---|---|---|
| AUTH | Login correcto; retorno seguro; envío único/loading; registro; validación; credenciales incorrectas; Retry-After; distinción entre credenciales inválidas y sesión expirada | `auth.test.tsx`, `actions.test.tsx` |
| CATALOG | Card/metadatos/enlace; fallback de imagen; Section/Grid; detalle reproducible y serie sin episodios; búsqueda con debounce/cancelación; filtros/paginación; resultados vacíos | `catalog.test.tsx`, `unit/query.test.ts` |
| WATCHLIST | POST/DELETE; estado optimista; bloqueo durante escritura; rollback de alta y baja; estado incompleto bloqueado; separación de cachés por tamaño de página | `personal.test.tsx`, `actions.test.tsx`, `library.test.tsx` |
| PREFERENCES | LIKE; DISLIKE; quitar señal; LIKE → DISLIKE con PUT; rollback si falla el cambio | `personal.test.tsx` |
| PLAYER | Loading; single-flight; creación; currentTime inicial; play; seek y PATCH; pausa con posición; resume; intervalo de diez segundos; complete idempotente; renovar URL sin perder posición/pausa; error de video y de servicio; recuperación | `player.test.tsx` |
| COLA | Ordenar progreso/pause/complete; agrupar posiciones pendientes; retroceso intencional; recuperarse de fallo; detener sesiones reemplazadas | `unit/player.test.ts` |
| CONTINUE WATCHING | Progreso/porcentaje accesible; enlace al mismo título; error controlado y reintento de las cuatro bibliotecas | `catalog.test.tsx` |
| ADMIN | USER sin formulario; ADMIN permitido; multipart; progreso y metadata de asset; rechazo de formato; error HTTP; error/red/timeout/abort sin reenvío; ficha/publicación; importKey estable tras fallo; edición conserva metadata no editable | `admin.test.tsx` |
| SESSION/PROFILE | Logout confirmado y local; caché privada vaciada; fallo de logout; permisos del perfil; actualización/loading; cambio de password y salida | `session.test.tsx` |

Los componentes usan HTTP simulado y eventos HTMLMediaElement simulados donde JSDOM no reproduce video. Se comprueba el MP4 y la persistencia reales en E2E; no se confunden esas dos capas.

## E2E reales

| Caso | Flujo y evidencia | Estado final |
|---|---|---|
| E2E-01 | Registro UI → login UI → Home; cookie HttpOnly/Strict; sin refresh ni JWT en navegador/localStorage | **PASS** |
| E2E-02 | Login → catálogo filtrado → detalle → Mi Lista → listado → eliminar → búsqueda vacía | **PASS** |
| E2E-03 | LIKE → DISLIKE → navegación/recarga conserva la señal | **PASS** |
| E2E-04 | MP4 real → seek/PATCH → pause → Home → progreso → reabrir a menos de dos segundos de la posición guardada → complete → historial | **PASS** |
| E2E-05 | ADMIN → upload MP4 → asset GET 200 y metadata → crear/publicar ficha → editar → verificar persistencia | **PASS** |
| E2E-06 | JWT RS256 realmente vencido → tres lecturas concurrentes → exactamente una rotación de refresh → navegar | **PASS** |
| E2E-07 | Detener Catalog propio → error Home y error boundary Explorar → recuperar servicio y Home | **PASS** |
| E2E-08 | Detener Playback propio → error en preparar video → recuperar servicio → nuevo reproductor funciona | **PASS** |
| Regresión roles/CSRF/sesión | USER no accede a ADMIN por UI/API; Origin ajeno 403; sesión eliminada redirige a login | **PASS** |
| Regresión URL | Adelantar reloj del navegador → refresh-url real 200 → conserva currentTime y pausa | **PASS** |
| Regresión perfil | Editar perfil; tamaños 1440/1100/820/390/320 sin overflow; lista vacía de una cuenta nueva; cambio de password y nuevo login | **PASS** |
| Regresión Redis | Detener Redis propio → logout limpia cookie y comunica revocación no confirmada → recuperar Redis | **PASS** |

La expiración usa una utilidad por stdin que exige `E2E_STACK_ID=nevaro-e2e-*`, modifica solo la sesión cifrada del stack descartable y firma un JWT vencido con la clave efímera de ese stack. La renovación de URL usa el reloj Playwright; la reproducción, firma de URLs y peticiones de red son reales.

## Datos, aislamiento y reproducibilidad

`scripts/test-e2e.ts` genera un proyecto Compose aleatorio, puertos explícitos loopback, bases independientes (`users_e2e`, `catalog_e2e`, `playback_e2e`), Redis y MinIO privados al ensayo. No lee `.env` de desarrollo ni conecta bases productivas. Usa los Dockerfiles actuales, ejecuta migración Drizzle e inicializadores Mongo/MinIO. No usa mocks de servicios.

El seed crea `demo@streaming.local`/USER y `admin@streaming.local`/ADMIN con contraseña aleatoria por ejecución. Los flujos de biblioteca, preferencias, reproducción, perfil, roles y logout crean además cuentas propias por la API; registro crea su cuenta desde la UI. ADMIN usa el seed de administración; refresh y caída de Catalog usan el demo del stack. Se crean una película publicada y una serie publicada sin episodios. ffmpeg genera dentro de Playback un MP4 H.264 de doce segundos, 320×180/24 fps, sin material externo y menor de 1 MiB.

El runner elimina sus contenedores/volúmenes/red y credenciales temporales en `finally`; las pruebas de caídas recuperan sus servicios también en `finally`. Solo publica los cinco puertos loopback necesarios. No se detienen servicios del Compose de desarrollo. Las imágenes de ensayo de las cuatro aplicaciones se eliminan; se conserva la caché normal de builds Docker.

## Fallos encontrados y tratamiento de flakiness

1. Docker Desktop estaba detenido y después se cerró durante el primer build concurrente. Se reinició y se cambiaron los builds a secuenciales, evitando targets duplicados de init. No hay evidencia suficiente para atribuir la parada del motor a una causa concreta.
2. Bajo ejecución simultánea de archivos Vitest y builds Docker, dos esperas de un segundo terminaban aún en `Comprobando…`. Se ejecutan archivos secuencialmente, con las mismas aserciones y sin añadir sleeps, aumentar timeouts o retries. Se verificaron ejecuciones posteriores completas.
3. La primera búsqueda E2E vacía usaba `no-existe-qa-987654`. Mongo `$text` busca cualquiera de las palabras y `QA` sí está en los títulos. Se sustituyó por un término único ausente; no era un fallo del buscador.
4. El flujo ADMIN leía `page.url()` inmediatamente después de pulsar un Link de Next. Podía conservar `/admin/upload` y construir `/admin/content/upload`. Se agregó una espera explícita a la URL de detalle y al heading del editor antes de continuar. No se aumentó el timeout ni se silenciaron fallos.
5. La inspección del ZIP embebido en HTML detectó quince apariciones de contraseñas efímeras en títulos de acciones `fill`, aun con traces deshabilitados. Se incorporó `tests/support/redact-reporter.ts` antes de los reporters de salida para redactar esos títulos y errores, sin alterar estados, aserciones o stack de ejecución. El artefacto final contiene **cero contraseñas y quince etiquetas de redacción**; JSON tampoco contiene las contraseñas.

La ejecución completa inicial terminó con 10/12 E2E aprobados y esos dos fallos; la ejecución corregida terminó con **12/12 aprobados**, sin reintentos, y se volvió a ejecutar al incorporar la redacción del reporte. No se implementaron cambios de producción para hacer pasar expectativas incorrectas de pruebas.

La segunda ejecución corregida también terminó con **12/12 aprobados**, `unexpected=0`, `skipped=0`, `flaky=0`, código de salida 0. Después se verificó que no quedaban contenedores ni imágenes `nevaro-e2e-*`; los reportes HTML/JSON/JUnit permanecen en el workspace. Se retiraron también las imágenes del primer build interrumpido.

## Comandos y reportes

Requisitos: Node 24, npm 12.2, Docker Desktop con WSL2/motor Linux y Compose, acceso a imágenes/npm en el primer build.

```powershell
cd frontend
npm ci
npx playwright install chromium
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run build
npm run test:e2e
npx playwright show-report
```

Se puede filtrar sin perder aislamiento: `npm run test:e2e -- --grep E2E-04`.

Artefactos locales, ignorados por Git:

- `frontend/playwright-report/index.html`: reporte HTML Playwright.
- `frontend/test-results/results.json`: resultados Playwright estructurados.
- `frontend/test-results/junit.xml`: reporte para CI.
- `frontend/test-results/**/test-failed-1.png`: captura únicamente si falla un caso.
- `frontend/coverage/index.html`, `coverage-summary.json`, `lcov.info`: cobertura.

No se guardan traces ni videos de Playwright. Credenciales y claves del entorno son efímeras y nunca pertenecen a cuentas personales. Los reportes no sustituyen una auditoría de seguridad ni garantizan todos los navegadores/codecs: esta ejecución cubre Chromium desktop con H.264, no Safari, Firefox, móviles físicos, DRM ni transcodificación.
