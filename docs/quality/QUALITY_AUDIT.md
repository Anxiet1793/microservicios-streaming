# Auditoría técnica de calidad — NÉVARO

> Actualización de hardening (20/10/2026): este documento conserva el estado de su ejecución original. Autorización de Catalog, dependencias y resultados posteriores están en [SECURITY_REVIEW.md](SECURITY_REVIEW.md) y [HARDENING_RESULTS.json](HARDENING_RESULTS.json). Q02 quedó corregido en código; la rotación de la credencial Atlas expuesta sigue pendiente.

Fecha: **17 de octubre de 2026**. Base auditada: commit `a20fc9a6bf5af7d68ce1066b6c1b5166d08e94b6` (`new`). Árbol de trabajo inicialmente limpio. Alcance: repositorio completo, cuatro aplicaciones, infraestructura, documentación, contratos y automatizaciones existentes. Solo se agregan este informe y [TEST_MATRIX.md](TEST_MATRIX.md); no se modifica producción, configuración ni tests.

## Dictamen y método

El MVP compila y sus verificaciones backend existentes pasan. La calidad **no está asegurada de forma continua**: no hay CI versionado, cobertura instrumental ni validación exhaustiva de contratos de respuesta. El lint del frontend ofrece una señal incompleta porque excluye TSX. Catalog depende de aislamiento de red y del BFF para autorizar escrituras. Hay alertas de dependencias que requieren triaje antes de distribuir otra versión.

Se inspeccionaron archivos versionados, paquetes y lockfiles, configuraciones, rutas, capas de dominio/aplicación/persistencia, adaptadores, interfaz, scripts, pruebas, Compose, Dockerfiles y documentos de los cuatro proyectos. Se contrastaron las afirmaciones documentales con código y ejecución. Los directorios generados/dependencias no se trataron como código propio; no se auditaron línea por línea los paquetes de terceros. Se revisaron las variables y su validación sin exportar secretos. Ningún secreto ni credencial demo se incorpora a estos documentos.

Evidencia diferenciada:

- **E**: ejecutado durante esta auditoría, con resultado observado.
- **I**: inspeccionado en código; no equivale a ejecución ni porcentaje de cobertura.
- **H**: resultado histórico en `*/docs/verification.md`; no se presenta como ejecución nueva.
- **Pendiente**: no se encontró una aserción específica para el caso señalado. No significa que toda su funcionalidad esté sin pruebas.

Los hallazgos Q01–Q23 se clasifican en la sección 20. Severidad y prioridad son independientes: `CRITICAL/HIGH/MEDIUM/LOW` expresan impacto; `P0/P1/P2` ordenan la intervención. No se ejecutaron exploits ni pruebas de carga contra el entorno de QA compartido.

## 1. Servicios y estructura encontrados

Hay **un repositorio Git**, con cuatro proyectos npm independientes; no cuatro repositorios separados. Antes de agregar estos documentos tenía 341 archivos versionados. No existe `package.json` raíz ni workspace npm; el `package-lock.json` raíz está vacío de paquetes y conserva el nombre `clase`.

```text
/
├── frontend/                 # 98 archivos versionados; BFF y UI
│   ├── src/app/              # public, viewer, player, admin, api/bff
│   ├── src/components/
│   ├── src/features/
│   ├── src/lib/{api,server}/
│   ├── src/types/generated/
│   ├── tests/{unit,component,e2e}/
│   ├── docker/               # overrides de integración
│   ├── scripts/
│   └── docs/
├── users-service/            # 79 archivos; 46 en src
│   ├── src/app/              # API y JWKS
│   ├── src/modules/users/{domain,application,infrastructure,interfaces}/
│   ├── drizzle/              # SQL, snapshot y journal
│   ├── tests/{unit,integration}/
│   ├── scripts/
│   └── docs/
├── catalog-service/          # 87 archivos; 51 en src
│   ├── src/app/
│   ├── src/modules/catalog/{domain,application,infrastructure,interfaces}/
│   ├── src/shared/infrastructure/
│   ├── tests/{unit,integration}/
│   ├── scripts/              # verificaciones de fases 4–7
│   └── docs/
├── playback-service/         # 51 archivos; 20 en src
│   ├── src/app/
│   ├── src/modules/playback/{domain,application,infrastructure,interfaces}/
│   ├── tests/{unit,integration}/
│   ├── docker/minio.Dockerfile
│   ├── scripts/
│   └── docs/
├── streaming-plan/           # planificación; no es otra app ejecutable
├── ARQUITECTURA_DATOS_Y_APIS.md
└── docs/quality/             # esta entrega
```

Redis es una **dependencia adicional real** del BFF y dueño de su almacenamiento de sesiones; no estaba enumerado en la lista inicial de persistencias de la solicitud. No se encontró CI, broker, dispatcher de outbox, Payments ni Recommendations implementados.

## 2. Frameworks y arquitectura encontrados

| Proyecto | Stack declarado | Persistencia/adaptadores |
|---|---|---|
| Users | Next 16.3.5 App Router, React 19.3.0, TypeScript 6.0.3, Zod 4.6.5 | Drizzle ORM 0.45.3, pg 8.23.1, PostgreSQL 17; Argon2 0.45.1; jose 6.2.12 |
| Catalog | Next 16.3.5 App Router, React 19.3.0, TypeScript 6.0.3, Zod 4.6.5 | Driver MongoDB 7.6.0; MongoDB 8.0; validadores BSON e índices propios |
| Playback | Next 16.3.5 App Router, React 19.3.0, TypeScript 6.0.3, Zod 4.6.5 | MongoDB 7.6.0/servidor 8.0 con replica set; SDK MinIO; Busboy; ffprobe/ffmpeg; jose |
| Frontend | Next 16.3.5, React 19.3.0, TypeScript 5.9.3, CSS Modules | TanStack Query, RHF/Zod, Lucide, Manrope; ioredis y Redis 7.4; BFF con fetch HTTP |

Se encontraron separación de capas, puertos, implementaciones inyectables y Route Handlers delgados en backends. Playback concentra sus casos de uso en un archivo y el BFF concentra su despacho HTTP en otro: son puntos de regresión, no justificación para un refactor previo a las pruebas. La búsqueda de imports de Next/Zod/Drizzle/jose/Mongo/pg en los dominios no encontró dependencias de esos frameworks.

Users conserva referencias `tituloId` en lista/preferencias, no fichas de Catalog. Catalog posee metadatos y referencia técnica del asset. Playback posee assets, sesiones, progreso y outbox; no consulta bases ajenas. El frontend consulta APIs y posee sus sesiones Redis. No se encontró acceso directo del código frontend a PostgreSQL/MongoDB de los servicios.

## 3. Test runner actual por proyecto

| Proyecto | Runner y selección real | Qué queda fuera de `npm test` |
|---|---|---|
| Users | Vitest 5.0.3, entorno Node, `tests/unit/**/*.test.ts` | Integración PostgreSQL y `scripts/verify-docker.ts` |
| Catalog | Vitest 5.0.3, Node, `tests/unit/**/*.test.ts` | Integración Mongo y verificaciones de fases 4–7 |
| Playback | Vitest 5.0.3, Node, `tests/unit/**/*.test.ts` | Integración replica set y E2E Docker |
| Frontend | Vitest 5.0.3: proyecto `unit` Node y `components` jsdom | Playwright; no suite de integración aislada del BFF |

Playwright usa un único proyecto Chromium Desktop Chrome, un worker, sin reintentos. Los scripts backend de API/Docker usan `node:assert`, procesos y fetch; sus grupos **no son tests Vitest ni deben sumarse como si lo fueran**.

## 4. Tests existentes y resultados nuevos

| Proyecto | Archivos de tests | Resultado E de unit/component | Integración E | API/Docker E |
|---|---|---|---|---|
| Users | 3 unit + 1 integración | **31/31** | **16/16**, PostgreSQL efímero propio | `test:e2e`: **14 grupos**, imagen reconstruida y Compose propio |
| Catalog | 3 unit + 1 integración | **38/38** | **7/7**, Mongo efímero propio | fase 4: **15 grupos**; fase 5: **14**; fase 6: **14**; fase 7: **10 comprobaciones**, build Docker propio |
| Playback | 1 unit + 1 integración | **26/26** | **5/5**, ejecutadas dentro del E2E con replica set propio | `test:e2e`: **11 grupos**, imagen local existente; Catalog y JWKS simulados |
| Frontend | 2 unit + 2 componentes + 1 E2E | **20/20** = 16 unit + 4 componentes | No existe suite aislada del servidor BFF | `playwright test --list`: **5 escenarios descubiertos**; no ejecutados en esta auditoría |

Total nuevo observado: **115 tests unit/component y 28 de integración correctos**. No incluye grupos assert ni pruebas de navegador históricas. Todos los comandos backend ejecutados terminaron con código 0; los recursos temporales de sus pruebas se limpiaron.

Los cinco escenarios Playwright existentes cubren un recorrido extenso de registro/lista/preferencias/player/perfil, un upload/publicación ADMIN, refresh concurrente, renovación de URL y logout con Redis caído. Hay evidencia H de cinco escenarios aprobados y cinco repeticiones del recorrido principal en `frontend/docs/verification.md`.

**Límite deliberado de ejecución:** la suite frontend usa el stack local compartido, genera datos persistentes y detiene Redis mediante `docker compose stop redis`. No se volvió a ejecutar para no interrumpir la auditoría manual del usuario ni publicar más contenido de ensayo. Se inspeccionaron todas sus aserciones y se verificó su descubrimiento. Q05 documenta el aislamiento necesario para volver a ejecutarla con seguridad en CI.

## 5. Cobertura actual

**No medida** en los cuatro proyectos. No se encontraron configuración de cobertura, proveedor `@vitest/coverage-*`, umbrales, reportes LCOV/Cobertura/HTML versionados ni reportes de cobertura locales fuera de dependencias/build. No se ejecutó cobertura ni se instaló un proveedor durante esta tarea.

No corresponde informar «0 %» ni inferir porcentajes a partir de cantidad de tests. Las listas de funcionalidades en los documentos anteriores describen alcance, no cobertura de líneas/ramas. Q08: medir posteriormente con el runner existente y delimitar código propio, exclusiones generadas y umbrales por riesgo.

## 6. Endpoints sin prueba o con cobertura parcial

Los OpenAPI declaran **33 operaciones backend**: Users 15, Catalog 6 y Playback 12, incluidos health/JWKS. Se contrastaron con las rutas y scripts. **No se encontró una operación backend principal sin al menos una invocación/aserción HTTP existente**. Eso no implica probar cada código, método auxiliar, límite o rama.

| Servicio | Operaciones verificadas en sus scripts existentes | Vacíos específicos |
|---|---|---|
| Users | Register, login, refresh, logout; GET/PATCH me; change-password; GET/POST/DELETE watchlist; GET/PUT/DELETE preferences; health y JWKS | Matriz completa de claims JWT, `kid`/rotación, cookies duplicadas, UTF-8 y límites exactos por operación, fallos durante firma posterior a rotación, límite global y recuperación de cuotas |
| Catalog | GET listado/detalle, POST bulk, PATCH ficha/estado, health | Autorización en el propio servicio **no existe**; contrato completo de respuestas/errores y fallos parciales de reconciliación requieren ampliar pruebas |
| Playback | POST/GET/DELETE assets; start/progress/pause/resume/complete/refresh-url; continue/history y health | Firma/algoritmo/audience/claims adversos completos, caída/rotación JWKS, compensación upload, red/timeout MinIO y carreras de start/delete/progress |

El BFF expone **31 combinaciones lógicas de método/ruta**, contando por separado las cuatro bibliotecas y las cinco acciones de sesión. No dispone de OpenAPI propio ni suite de servidor aislada. Los tests frontend unit/component no importan el servidor BFF. Los E2E cubren parte de sus ramas indirectamente, pero no tienen una matriz HTTP completa.

Los alias generados existen en `frontend/src/lib/api/contracts.ts`, pero varios modelos se mantienen manualmente en `src/lib/models.ts`, incluidos diccionarios de géneros/idiomas. No se encontró una aserción que compare esos diccionarios frontend con Catalog. Generar tipos por sí solo no valida el JSON recibido ni evita esa divergencia semántica (Q07).

Rutas BFF sin aserción HTTP específica encontrada en los E2E/componentes existentes:

- `DELETE /api/bff/watchlist/:tituloId` y `DELETE /api/bff/preferences/:tituloId`.
- `POST /api/bff/sessions/:sessionId/resume` (sí existe prueba directa del backend Playback).
- `GET /api/bff/admin/catalog` y `GET /api/bff/admin/catalog/:tituloId`; la carga del editor por RSC no verifica necesariamente estas ramas HTTP.
- `GET` y `DELETE /api/bff/admin/assets/:assetId`; la comprobación interna de asset al publicar tampoco ejercita el endpoint GET del BFF.
- Matrices de métodos no admitidos, rutas desconocidas, query duplicada, validación y permisos por cada operación ADMIN.

Q06/Q07/Q12: comenzar por esas rutas y por la autenticación del BFF. Las páginas `/explore` y `/search` tampoco tienen recorrido de navegador específico; la función de normalización sí tiene unitarios.

## 7. Reglas de dominio sin prueba específica suficiente

| Contexto | Ya probado | Falta una aserción específica o una tabla de límites |
|---|---|---|
| Users | Normalización, password inválido, perfil parcial, campos protegidos, referencia pública, rol/estado/authVersion | `Usuario.restore`: todas las variantes de estado/rol/versión/fechas; límites 12/128 por puntos de código; idioma/avatar en límites; ventana exacta de paginación de 10 000 registros |
| Catalog | Inmutabilidad, película/serie, 1→2→3, transiciones prohibidas, PATCH/no-op y categorías | Versión máxima/overflow; fecha inválida o regresiva en cada operación; límites exactos de texto/arrays/URL/reparto; `ReferenciaReproduccion` con todos los campos/proveedores adversos |
| Playback | Progreso inválido y tolerancia, transiciones principales, ownership, sustitución, idempotencia y milestones | Umbrales exactamente 25/50/75/90/100 %; todos los pares de estados; duración cero/no finita; salto y retroceso cruzando milestones; nuevos inicios simultáneos del mismo usuario/título |

Q23: ampliar tests dirigidos a invariantes sin duplicar los happy paths actuales. No se declara ausencia total de tests en ninguna de estas reglas.

## 8. Integraciones críticas sin prueba completa

| Integración | Evidencia disponible | Vacío |
|---|---|---|
| Users → PostgreSQL | Transacción usuario/perfil, rollback, unicidad concurrente, refresh replay/carrera, cambio de password, rate limit atómico | Dos migradores simultáneos, fallos de conexión/commit en auth, limpieza de expirados y paginación con escrituras concurrentes |
| Catalog → Mongo | Validadores, índices repetibles/incompatibles, importKey canónica, CAS/versiones, bulk parcial y desconexión | Interrupción durante reconciliación/confirmación de escritura, presupuestos BSON en borde y recuperación después del fallo |
| Playback → Mongo replica set | Rollback de outbox, complete concurrente, índice continue-watching | Start/start, start/delete, progress/start, reintentos de transacción con eventos; errores de primario/commit |
| Playback → MinIO + ffprobe | Upload real, MIME/firma/tamaño, bucket privado, expiración, Range 206, health degradado | Fallo después de subir y antes de insertar; fallo de compensación; cliente abortado; ffprobe timeout/códec inválido; limpieza temporal y objetos huérfanos |
| Playback → JWKS/Catalog HTTP | API E2E con servidor fixture y JWT reales de prueba; H con servicios reales | Rotación y solapamiento de claves, caché caliente/fría con JWKS caído, respuestas malformadas, timeout/redirecciones y revalidación de publicación durante sesión |
| BFF → Redis → Users | H de single refresh y logout degradado; inspección de lock/CAS/cifrado | Integración aislada de lock vencido, propietario incorrecto, ciphertext alterado, sesión vencida, renovación incierta, Redis sin memoria/reinicio y TTL |
| Frontend/BFF → tres APIs | H del recorrido completo real; E de compilación y smoke anónimo | Contratos ejecutables de respuestas; fallos parciales del enriquecimiento; presupuesto global de tiempo; aislamiento de cache y permisos en todas las ramas |

Q06/Q10/Q11/Q18. Las simulaciones de Catalog/JWKS en Playback son útiles para fallos controlados, pero no sustituyen la aceptación entre servicios reales.

## 9. Casos negativos faltantes

Priorizar: JWT con algoritmo/clave/`kid`/audience/subject/role inválidos y claims ausentes; rotación JWKS; cada escritura ADMIN desde USER/anónimo; cada ruta personal con identidad ajena; cookie duplicada y sesión Redis alterada; fallo después de consumir refresh; CSRF sin cabecera y Fetch Metadata adverso; JSON inválido/UTF-8 roto y límite exacto/chunked; queries repetidas; timeout y respuesta de dependencia malformada; subida abortada/ffprobe fallido/compensación fallida; navegación con errores y doble acción; retry tras fallo incierto sin duplicar publicación o progreso.

**Ya existen** negativos de contraseña, email duplicado, replay, CSRF básico, ownership, progreso inválido, tamaño/MIME y operadores Mongo. La matriz identifica cuáles ampliar; no empezar reescribiéndolos. Q06/Q07/Q10/Q11/Q12/Q23.

## 10. Riesgos de regresión

- Q03/Q04/Q09: cambios de UI podrían pasar un lint verde sin analizar TSX y sin typecheck de sus dos archivos de tests de componentes; nada obliga a ejecutar gates al integrar código.
- Q06/Q07: cambios de cookie Users, forma de respuesta, sesión/cifrado/lock o BFF pueden romper simultáneamente todas las pantallas.
- Q11: un fallo de persistencia tras un upload puede dejar bytes huérfanos; su eliminación compensatoria es best effort y silencia fallos de limpieza.
- Q18: bibliotecas dependen de múltiples lecturas Catalog y el estado personal recorre hasta 10 páginas por colección. Una degradación puede multiplicar latencia y solicitudes.
- Q05: ensayos largos mezclan muchos comportamientos y dependen de datos locales/identificadores/servicios compartidos; dificultan localizar el fallo y repetirlo.
- Q10: cambios de claves o expectativas de logout pueden romper validación externa o generar una garantía falsa de revocación instantánea.

## 11. Seguridad

Controles presentes: Argon2id con sal (`m=19456,t=2,p=1`), JWT RS256 con issuer/audience/exp, refresh aleatorio almacenado mediante SHA-256, rotación/revocación familiar transaccional, `authVersion` local, esquemas estrictos, consultas parametrizadas, límites de body, CSRF, cookies HttpOnly/Strict, secretos fuera de Git, logs sin cuerpos/tokens y runtime no root. JWKS vivo respondió con una clave pública y sin campos privados. El BFF guarda tokens cifrados AES-256-GCM en Redis y entrega al navegador una cookie opaca.

### Alertas de dependencias observadas

Se ejecutó `npm audit --json` y `npm audit --omit=dev --json` en cada proyecto. Los procesos npm audit devolvieron **1** por alertas; el wrapper de lectura devolvió 0 al procesar el JSON. Estos son conteos de paquetes afectados por proyecto, **no de vulnerabilidades únicas sumables entre proyectos**:

| Proyecto | Audit completo: critical/high/moderate/low | Solo producción: critical/high/moderate/low |
|---|---|---|
| Users | 1 / 0 / 4 / 0 | 1 / 0 / 0 / 0 |
| Catalog | 1 / 2 / 0 / 0 | 1 / 2 / 0 / 0 |
| Playback | 1 / 0 / 4 / 0 | 1 / 0 / 4 / 0 |
| Frontend | 1 / 0 / 0 / 0 | 1 / 0 / 0 / 0 |

Q01: Next **16.3.5** coincide con el rango del aviso [GHSA-vcvr-r3jv-pc5j del mantenedor](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j), publicado el 22/09/2026. Su severidad de dependencia es CRITICAL. **No se encontró `next/og`/`ImageResponse` ni la condición de entrada atacante requerida en este repositorio; no se confirmó RCE explotable en la aplicación.** El aviso indica corrección de ese problema en 16.3.6; otros avisos devueltos por audit afectan versiones inferiores a 16.3.8. Audit propone 16.4.2: es una propuesta del registro, no una actualización aplicada ni validada aquí.

El [aviso SSRF de Image Optimization](https://github.com/vercel/next.js/security/advisories/GHSA-cjq9-62q9-8jv4) requiere URLs remotas permitidas. No se encontró `images.remotePatterns`; tampoco se confirmó esa condición explotable. Catalog además reporta `sharp` y `source-map-js` HIGH; [el aviso de sharp](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) afecta `<0.35.5`. Falta comprobar alcanzabilidad y dependencias efectivamente incluidas en cada imagen Linux; audit del lock no es un análisis de imagen. Users tiene alertas transitivas de drizzle-kit/esbuild de desarrollo. Playback tiene alertas transitivas de MinIO/query-string/decode-uri-component/stream-json. No usar `npm audit fix --force` de forma automática: algunas propuestas son downgrades mayores.

Otros riesgos:

- **Q02:** Catalog no autentica lecturas ni escrituras. Los handlers llaman los casos de uso sin verificar identidad. El modo integrado quita el puerto de host y el BFF exige ADMIN, pero otro consumidor de esa red podría escribir. El Compose base vuelve a publicar `127.0.0.1:3000`. No se explotó una escritura sobre datos reales para demostrarlo.
- **Q10:** logout revoca refresh, no JWT ya emitidos. Users comprueba `authVersion` contra su DB; Playback solo firma/claims y no comprueba esa versión. Un JWT externo y una URL MinIO emitidos conservan su vigencia hasta expirar. Es una limitación documentada; falta una prueba del límite temporal, no una promesa de revocación global instantánea. JWKS publica una sola clave, sin solapamiento de rotación implementado.
- **Q16/Q22:** MinIO usa credenciales root en el adaptador local; Mongo local no tiene autenticación. Red privada/loopback limita exposición actual; no es configuración de producción. Redis interno tampoco exige autenticación, aunque las sesiones están cifradas. La red default de Users/Catalog también contiene sus bases: la separación lógica de datos no equivale a aislamiento de red del BFF.
- **Q17:** CSP existe, pero permite `unsafe-inline` para scripts/estilos y fuentes de imagen HTTP/HTTPS amplias. No se encontró `dangerouslySetInnerHTML`; no se afirma XSS demostrado. Endurecimiento y pruebas con cargas de texto/URLs quedan pendientes.
- **Q12:** el límite global de auth es compartido por endpoint (`all`), además de cuotas por email. Falta probar agotamiento, expiración y recuperación sin bloquear indebidamente usuarios distintos bajo carga legítima/adversa.

## 12. Reproducibilidad

Fortalezas: cuatro lockfiles v3, engines Node 24, imágenes Node fijadas por digest, setups que no sobrescriben `.env`, migración SQL versionada, init Mongo repetible, pruebas backend con nombres/puertos propios y limpieza en finally.

Brechas Q05/Q14/Q15/Q16/Q20:

- El host tiene Node **22.14.0**, distinto del engine declarado. Para iniciar checks se seleccionó el Node **24.21.0** disponible en caché local; esa ruta de caché no es un requisito portable del proyecto. No hay pin de runtime/packageManager raíz. Frontend fija npm 12.2.0 en Docker, los otros Dockerfiles usan el npm de la imagen.
- No se reinstalaron dependencias de host desde cero. Users/Catalog sí reconstruyeron sus imágenes temporales desde Dockerfiles; Playback E2E utiliza `playback-service:local` y `playback-minio:2025-10-15` preexistentes. El test no obliga a reconstruir ni comprobar un label de commit.
- Las integraciones Playback necesitan `TEST_MONGODB_URI` local explícita y replica set. El E2E provisiona uno y ejecuta esa suite; no basta `npm run test:integration` sin preparación.
- Frontend necesita seed local, `docs/demo-local.json` y `.verification/synthetic-demo.mp4`, ambos no versionados. El hostname localhost no demuestra aislamiento de una base. Los tests acoplan nombres concretos de contenedores y el nombre visible «Exposición académica».
- `scripts/start.ps1` supone redes Compose con nombres concretos y `.env` de Users/Playback preparados; no prepara todo desde clon limpio. La receta está documentada, pero no automatizada en CI.
- Postgres/Redis y las imágenes usadas por varias suites se seleccionan por tag, no siempre digest; `apt-get`/descarga de fuentes MinIO requieren red. MinIO tiene commit fijo, pero la compilación depende de GitHub/Go y paquetes Debian.
- `frontend/docs/contracts.md` y su generador dicen que no hay Git, lo cual ya es obsoleto. La referencia válida de esta auditoría es el commit indicado arriba.

## 13. Lint

**E:** `npm run lint` pasó con cero warnings en los cuatro proyectos como parte de `check`.

**Q03 — HIGH/P0:** `frontend/eslint.config.mjs:6` solo aplica reglas a `**/*.ts`. Hay **41 archivos TSX versionados** (39 en src, 2 tests). La comprobación:

```powershell
cd frontend
node node_modules/eslint/bin/eslint.js --print-config src/features/playback/Player.tsx
# Resultado observado: undefined
```

confirma que un componente central queda fuera. No hay reglas React Hooks/Next/a11y configuradas. El verde actual no debe presentarse como revisión de todos los componentes. La [documentación de ESLint sobre extensiones y files](https://eslint.org/docs/latest/use/configure/configuration-files#specifying-files-with-arbitrary-extensions) explica el alcance del patrón. No se corrigió la configuración en esta fase.

## 14. Typecheck

**E:** `next typegen && tsc --noEmit` pasó en los cuatro proyectos. Todos usan `strict`, `noUncheckedIndexedAccess` y controles de símbolos no usados; Catalog también `exactOptionalPropertyTypes`. Se generan tipos de rutas Next.

**Q04 — MEDIUM/P1:** frontend incluye `src/**/*.ts` y `tests/**/*.ts`, pero no glob TSX explícito. `tsc --listFilesOnly` sí incluyó Player/AuthForm por sus imports desde páginas/tipos Next, y **no incluyó** `tests/component/actions.test.tsx` ni `library.test.tsx`. No afirmar que todo TSX de producción está fuera de TypeScript: el agujero confirmado son esos dos tests. Vitest los transforma/ejecuta, lo que no sustituye su comprobación de tipos. La [documentación de include](https://www.typescriptlang.org/tsconfig/include.html) es la referencia del patrón.

## 15. Build

**E:** los cuatro `npm run check` finalizaron con código **0**. Incluyen typecheck, lint, unit/component y build Next. Los tres backends también validan OpenAPI y compilan scripts. Resultados:

| Proyecto | Build host Next | Scripts adicionales | Contrato estático |
|---|---|---|---|
| Users | Correcto | migrate/seed/cleanup con esbuild | 15 operaciones y 5 ejemplos |
| Catalog | Correcto | init-mongo con esbuild | 6 operaciones, diccionarios y 5 ejemplos |
| Playback | Correcto | init con esbuild | 12 operaciones |
| Frontend | Correcto, UI y BFF | No hay compilación adicional requerida | Tipos generados existentes; no gate de drift |

Build correcto no demuestra seguridad de dependencias, disponibilidad de APIs, cobertura completa ni igualdad entre imágenes locales y HEAD. No se actualizaron paquetes ni lockfiles.

## 16. Docker y persistencias

**E:** Docker Desktop Linux 29.8.2, Compose v5.6.0 operativos. Al revisar el stack del proyecto había **9 contenedores activos healthy**: cuatro apps, PostgreSQL, dos MongoDB, MinIO y Redis. Los tres init/migrador finalizaron 0. Los cuatro contenedores de app declaran usuario `node`; los tests Users/Catalog/Playback comprobaron UID distinto de 0.

| Componente local | Exposición observada | Diseño |
|---|---|---|
| Frontend | `127.0.0.1:3003` | Standalone multietapa; Redis propio con AOF/TTL |
| Users / PostgreSQL | `127.0.0.1:3001` / `127.0.0.1:5433` | SQL propio; seis tablas públicas; migrador previo al servicio |
| Catalog / Mongo | Catalog sin puerto host / Mongo sin puerto host | Override integrado activo; init con dos colecciones y nueve índices propios |
| Playback / Mongo | `127.0.0.1:3002` / Mongo sin publicación efectiva observada | Replica set requerido para transacciones de sesión/progreso/outbox |
| MinIO | `127.0.0.1:9000` y consola `9001` | Bucket privado, URL presignada, runtime no root |
| Redis | Sin puerto host | Red interna, límite 128 MB y política noeviction |

La configuración base Playback **sí declara** `127.0.0.1:27019` para Mongo; el contenedor actual no tenía publicación efectiva visible. Registrar la diferencia entre configuración declarada y runtime; la conectividad externa de ese Mongo no es requisito para la app integrada.

Users: migración `drizzle/0000_busy_carlie_cooper.sql`, con tres enums; users/profiles/refresh_tokens/watchlist_items/content_preferences/rate_limit_buckets; PK/FK internas, uniques y checks. No hay FK a Catalog. El migrador usa advisory lock. Repetición y rollback se probaron en SQL real aislado.

Catalog: esquema e índices de `catalog_titles` y `catalog_episodes`, sin API de episodios; init con collMod y diagnóstico de índices incompatibles. Playback: media_assets/playback_sessions/playback_progress/outbox_events/rate_limit_buckets, únicos, índice de consulta y TTL de cuotas. Redis pertenece al BFF. No hay prueba de backup/restore conjunto ni de actualización desde datos de una versión anterior (Q19).

**Q13:** health del frontend consulta `/login`, que puede responder sin verificar Redis/Users/Catalog/Playback; es señal de proceso/HTML, no readiness completa. Users comprueba SQL y claves; Catalog ping Mongo; Playback Mongo y bucket MinIO, pero no JWKS/Catalog. Sus caídas parciales necesitan smoke diferenciado.

**Q16:** el [repositorio oficial MinIO](https://github.com/minio/minio) está archivado desde 25/04/2026. El Dockerfile local compila un commit fijo. Eso permite reproducir este MVP, pero falta política de mantenimiento/actualización del almacenamiento antes de producción. No se propone migrarlo en esta fase de diagnóstico.

## 17. Frontend

Pantallas encontradas: login/registro, home, explorar/buscar, detalle, player, Mi Lista, continuar, historial, preferencias, perfil/password, admin/contenido/upload/editor. Server guards y BFF comprueban identidad/ADMIN. Los consumidores fuerzan títulos publicados; las bibliotecas enriquecen referencias con concurrencia máxima 4 y preservan resultados fallidos. No se inventan recomendaciones. Series son informativas sin reproducción por episodios.

El player usa MP4 nativo, controles propios, guardado cada 10 s/seek/pausa, cola ordenada, URL renovable y envío best effort al salir. Upload transmite multipart por streaming, valida H.264/AAC con ffprobe en Playback y usa una importKey estable para la ficha. Cache personal usa userId/página/límite y se limpia al salir.

**E de smoke sin sesión:** login 200 con CSP/X-Frame-Options; `/profile` 307 a login; BFF me 401. Users me y Playback history anónimos respondieron 401. Health Users/Playback y health Catalog por red interna respondieron 200. Catalog listado interno respondió 200 sin identidad, coherente con Q02. Desde el contenedor Playback, la URL configurada de JWKS Users respondió 200 con una clave pública; esto verifica conectividad, no toda la matriz de autenticación. No se efectuaron cambios de datos demo.

Q17: hay semántica, labels, estados y skip link, pero no suite de accesibilidad/teclado/dialog/player completa ni Safari/WebKit/Firefox. H incluye cinco anchos sin overflow y capturas; no una certificación WCAG ni métricas reales de rendimiento. No se hizo inspección visual nueva ni se afirma compatibilidad móvil nativa.

Q18: `compose()` tiene límite de concurrencia, pero no presupuesto global de tiempo y no propaga la cancelación de la solicitud a cada consulta. Con 100 referencias y timeout individual de 10 s, una caída de Catalog puede acumular hasta 25 tandas de espera. Es una estimación derivada del código, **no una medición de carga**. `state/:tituloId` recorre hasta 1 000 referencias por colección y devuelve estado desconocido al superar el límite, comportamiento ya parcialmente probado en componente.

## 18. CI

**No se encontró CI versionado**: sin `.github/workflows`, GitLab CI, Jenkinsfile, Azure Pipelines ni CircleCI entre archivos versionados o configuraciones locales inspeccionadas. No hay gate raíz, publicación de resultados/cobertura ni smoke automático de imágenes dentro del repositorio. No se consultaron configuraciones externas del proveedor Git ni branch protections; su estado es desconocido.

Q09: `check` no ejecuta integración/E2E en ningún proyecto y no revisa dependencias. No confundir `npm run check` verde con aprobación integral del sistema. Automatizar inicialmente los comandos existentes y el aislamiento, sin incorporar otra plataforma de tests.

## 19. Dependencias externas necesarias para tests

| Grupo | Requisitos reales | Aislamiento actual |
|---|---|---|
| Unit Users | Node 24, dependencias y binario nativo Argon2 | Sin DB; criptografía real y repositorios mock |
| Unit Catalog/Playback | Node 24 y dependencias | Sin DB; fixtures/fakes |
| Frontend unit/component | Node 24, jsdom, Testing Library | fetch/Next simulados según archivo; sin servicios |
| Integration Users | Docker Linux, imagen postgres:17, puerto efímero, Drizzle/migraciones | Contenedor y password propios; no usa DATABASE_URL de usuario |
| Integration Catalog/fase4 | Docker, mongo:8.0, puerto efímero | Contenedor/DB propios; no Atlas |
| Integration Playback | Mongo local con replica set y `TEST_MONGODB_URI` explícita | DB UUID `playback_test_*`; URI local no demuestra instancia exclusiva; E2E sí la crea propia |
| API Users / Catalog fase7 | Docker build, registro npm/imágenes en build frío, puertos libres | Compose/proyecto/volúmenes/credenciales propios |
| API Catalog fase6 | Build Next ya generado, Node, Mongo Docker temporal | Next y Mongo de prueba propios |
| API Playback | Imágenes playback-service:local, playback-minio:2025-10-15 y mongo:8.0; ffmpeg en imagen; acceso Docker→host | Red/DB/bucket/JWKS/puertos propios; fixture HTTP simula Catalog/Users JWKS |
| Frontend navegador | Chromium instalado por Playwright; todo el stack, Redis, seed Users, MP4 y demo-local.json | Stack de desarrollo compartido; requiere corregir Q05 antes de CI |
| Audit dependencias | Acceso al registro npm | Consulta de metadatos; sin actualización |

No se requieren cuentas Atlas/AWS ni OpenAI para los tests actuales. La construcción fría MinIO necesita GitHub, toolchain Go e Internet. No instalar otro runner, broker ni framework de contratos para resolver esta fase.

## 20. Hallazgos priorizados y orden exacto de implementación

| ID | Severidad | Prioridad | Hallazgo / evidencia principal | Criterio para cerrar |
|---|---|---|---|---|
| Q01 | CRITICAL (dependencia; explotación no confirmada) | P0 | Next 16.3.5 y alertas npm audit; otros paquetes afectados según §11 | Triaje de alcanzabilidad e imagen; versión corregida validada; audit sin alertas no justificadas y regresión completa |
| Q02 | HIGH | P0 | Catalog handlers sin auth; override privado es la barrera actual | Tests negativos de escritura y red; acordar/implantar control del servicio antes de exposición externa |
| Q03 | HIGH | P0 | ESLint omite 41 TSX; print-config Player = undefined | Gate demuestra configuración aplicable a TS/TSX y ejecuta reglas pertinentes |
| Q04 | MEDIUM | P1 | Typecheck no incluye dos tests TSX de componentes | Ambos aparecen en listFiles y pasan typecheck |
| Q05 | HIGH | P0 | E2E frontend conserva datos y detiene Redis compartido; `nevaro.spec.ts:380` | Stack/credenciales/fixtures por ejecución, sin tocar entorno QA del usuario; cleanup propio incluso al fallar |
| Q06 | HIGH | P0 | Sesión/lock/CAS/cifrado/BFF sin suite aislada; `src/lib/server/session.ts` | Casos de auth/CSRF/TTL/carreras/fallos Redis ejecutables e idempotentes |
| Q07 | HIGH | P1 | OpenAPI se valida estáticamente; no respuestas completas ni drift de tipos/BFF | Respuestas/errores/cookies contrastados con YAML; generación no produce diff inesperado |
| Q08 | MEDIUM | P1 | Sin cobertura instrumental ni umbral | Reportes de ramas/líneas del código propio y umbrales basados en riesgos |
| Q09 | HIGH | P0 | Sin CI versionado; check excluye suites externas | Pipeline con Node/npm definidos, gates existentes y servicios aislados; artefactos sin secretos |
| Q10 | HIGH | P1 | JWKS de una clave; falta matriz adversa/rotación/outage; revocación externa por TTL | Contrato temporal probado y rotación/fallos reproducibles, sin prometer revocación inmediata |
| Q11 | HIGH | P1 | Compensación upload best effort; `playback-service/src/modules/playback/application/use-cases.ts:18` | Fallos storage/DB/ffprobe/abort no dejan estado falso; huérfanos detectables |
| Q12 | MEDIUM | P1 | Negativos HTTP/quotas incompletos; Playback colapsa queries repetidas con Object.fromEntries | Matriz por ruta de límites, encoding, métodos, queries y recuperación de cuotas |
| Q13 | MEDIUM | P1 | Health frontend solo /login; readiness parcial | Smoke distingue proceso de dependencias/recuperación y no da falso verde |
| Q14 | MEDIUM | P1 | Host Node 22 vs engine 24, npm heterogéneo, arranque acoplado | Receta de clon limpio con versiones explícitas y preflight reproducible |
| Q15 | MEDIUM | P1 | Tags de DB/Redis; E2E Playback acepta imagen local sin commit | Pruebas identifican código/imagen y prerequisitos; builds fríos verificables |
| Q16 | HIGH | P1 | MinIO archivado, build propio y credenciales root locales | Plan de mantenimiento y prueba de permisos mínimos/compatibilidad S3 antes de producción |
| Q17 | MEDIUM | P2 | Solo Chromium; sin a11y completa/rendimiento y CSP permisiva | Campaña teclado/AT/navegadores, cargas de texto/URL y presupuestos medidos |
| Q18 | HIGH | P1 | Composición N+1 sin plazo global; búsquedas de estado paginadas | Latencia/cancelación/fallo parcial acotados y comprobados con listas grandes |
| Q19 | MEDIUM | P2 | Sin restore/upgrade probado ni automatización de retención; outbox PENDING | Ensayo de recuperación, limpieza segura/retención y crecimiento observado; sin implementar Recommendations |
| Q20 | LOW | P2 | Docs/generador frontend afirman ausencia de Git | Documentación ligada al commit y comandos vigentes |
| Q21 | MEDIUM | P1 | Playback consulta container/config fuera del catch (`handlers.ts:26`); errores BFF inesperados → 503 | Env inválido y fallos internos dan resultado seguro/diagnosticable conforme a contrato |
| Q22 | MEDIUM | P2 | Mongo sin auth local y redes default compartidas con DB | Pruebas de exposición/config y mínimo acceso de red antes de despliegue externo |
| Q23 | MEDIUM | P1 | Bordes de invariantes no enumerados en tests actuales (§7) | Tablas de límites/estados/fechas y carreras con aserciones de no escritura/evento duplicado |

Q01 identifica una alerta crítica del componente instalado, no una demostración de intrusión. Q02/Q16/Q22 deben valorarse con la exposición local observada; el informe no afirma que las bases sean públicas en Internet.

### Secuencia de trabajo obligatoria para la siguiente fase

1. **Preparación P0: baseline e aislamiento.** Conservar resultados de este commit; definir Node 24/npm y proyecto Compose de test; generar seed/MP4/IDs propios. Separar tests que detienen servicios. No ejecutar la suite destructiva frontend sobre QA compartido. Referencias matriz: X01, X02, X03.
2. **Gates P0: alcance de lint/typecheck, dependencias y CI mínimo.** Primero verificar que TSX se analiza y tipa; añadir al pipeline los checks ya existentes, audit con triaje y resultados. No añadir pruebas de negocio duplicadas. X04–X07.
3. **Seguridad P0: fronteras de identidad.** Pruebas de anónimo/USER/ADMIN en BFF y Catalog, rutas permitidas, CSRF, sesiones Redis/TTL/cifrado, refresh concurrente/ambiguo y logout fallido. Las expectativas de Catalog requieren acordar el contrato objetivo; una prueba del estado actual no debe certificar que escribir sin identidad es seguro. S01–S07, B01–B10.
4. **Unit P1: bordes de dominio.** Users restore/password/paginación; Catalog versión/fechas/referencias/límites; Playback porcentajes/transiciones/milestones. Sin DB ni framework adicional. U16, C08, P13.
5. **Integration P1: persistencia y concurrencia.** Migradores/SQL y cuotas, errores de commit/rotación, CAS/bulk Mongo, start/start/start-delete/progress/outbox. Fixtures propias, cleanup solo por namespace del test. U17–U19, C09, P14–P16.
6. **Contract y API P1: contratos completos.** Validar las 33 operaciones backend y las 31 combinaciones BFF, incluidos errores/cookies/headers; comparar tipos generados y diccionarios frontend. Cubrir rutas BFF hoy no ejercitadas y respuestas malformadas/timeouts. U01–U15, C01–C07, P01–P12, P21, B11–B14.
7. **Integration/Security P1: medios y dependencias.** Abort/ffprobe/compensación/huérfanos, fallos MinIO, expiración/Range, JWKS rotación/outage y TTL externo; probar identidad de imagen y configuración. P17–P20, S08–S10, X08.
8. **Frontend Unit/Integration P1: recuperación de UI.** Componentes de búsqueda/debounce, bibliotecas paginadas, errores parciales, upload incierto/importKey, editor, player error/renovación/sustitución y cache entre cuentas. F01–F10. Reutilizar Testing Library/Vitest/Playwright existentes.
9. **E2E P1: aceptación real aislada.** Dividir los cinco escenarios largos en recorridos independientes, ejecutar contra Users/Catalog/Playback/Redis/MinIO reales y recién entonces probar caídas del stack de test. Registrar IDs/resultado sin tokens. F11–F15.
10. **Smoke P1 y campaña P2.** Validar imágenes tras levantar/restaurar dependencias y despliegue; luego navegadores/teclado/AT, rendimiento con volumen, backup/restore/retención. X09–X12, F16–F18. Publicar evidencias saneadas en CI.

Ordenar por estos pasos y dependencias, no únicamente por cantidad de tests. Los casos P0 pendientes bloquean considerar completa la garantía de calidad; P1 consolida regresión del MVP; P2 amplía operación, rendimiento y accesibilidad. Cualquier corrección de producción queda para la siguiente fase, con sus pruebas específicas.

## Apéndice: comandos usados y límites

Con Node 24 seleccionado en PATH, desde cada proyecto:

```powershell
npm run check
```

Además:

```powershell
cd users-service
npm run test:integration
npm run test:e2e

cd ../catalog-service
npm run test:integration
npm run verify:phase4
npm run verify:phase5
npm run verify:phase6
npm run verify:phase7

cd ../playback-service
npm run test:e2e
# Incluye test:integration con TEST_MONGODB_URI del replica set efímero.

cd ../frontend
node node_modules/@playwright/test/cli.js test --list
node node_modules/eslint/bin/eslint.js --print-config src/features/playback/Player.tsx
node node_modules/typescript/bin/tsc --listFilesOnly
```

En cada proyecto se consultaron `npm audit --json` y `npm audit --omit=dev --json`; no se ejecutó fix. También se inspeccionaron `docker ps`, usuario/health/imagen mediante `docker inspect`, versiones, archivos Git y smokes HTTP anónimos. Los checks generaron artefactos locales ignorados; no se editaron fuentes productivas. No hubo reinstalación limpia de host, build frío de todas las imágenes, escaneo de imágenes/OS, pentest, carga, prueba de Atlas/AWS, ejecución nueva de Playwright ni revisión visual nueva. No se borraron volúmenes del entorno local.
