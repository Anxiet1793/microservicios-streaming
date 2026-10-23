# NÉVARO

Frontend del MVP de streaming, implementado desde `streaming-plan/PLAN_COMPLETO_NEVARO.md`. Next.js App Router, React, TypeScript, CSS Modules, Manrope local, Lucide, TanStack Query, React Hook Form y Zod.

## Abrir y levantar

Con Docker Desktop Linux iniciado y los entornos locales de los tres servicios preparados:

```powershell
cd "C:\Users\Administrador\Desktop\microservicios streaming\frontend"
.\scripts\start.ps1
```

Abrir **http://localhost:3003**. El script conserva volúmenes y credenciales, levanta Users/Catalog/Playback, aplica aislamiento de Catalog y construye frontend/Redis. Los archivos `.env` de Users y Playback deben existir: consultar sus README para setup y seed inicial. El frontend genera su propio secreto si falta. No modifica ni copia tablas de los servicios.

Usuarios de desarrollo: `admin@streaming.local` y `demo@streaming.local`, con la contraseña aleatoria del seed local de Users. También puedes registrar tu propia cuenta USER desde la interfaz. No hay contraseña pública ni selector de rol.

## Pantallas disponibles

Login, registro, Inicio, Explorar, Buscar, detalle, reproductor, Mi Lista, Continuar viendo, Historial, Perfil, cambio de contraseña, Tus gustos, administración de contenido, upload/publicación y edición editorial.

Series se presentan como fichas sin reproducción hasta que exista una API de episodios. El catálogo consumidor solo expone publicados. No hay recomendaciones/rankings simulados. El contenido mostrado procede de los servicios; los fondos sin imágenes son placeholders identificables, no pósteres obtenidos del backend.

## Autenticación y BFF

El navegador usa una cookie opaca `nevaro_session`, HttpOnly/SameSite Strict y Secure cuando APP_ORIGIN es HTTPS. Access/refresh permanecen cifrados AES-256-GCM en Redis con TTL. Redis está en red interna sin puerto público en Compose normal. Se coordina refresh con un lock por sesión y se guarda mediante compare-and-set; RSC y Route Handlers usan el mismo almacén. El navegador nunca recibe JWT ni la cookie upstream `users_refresh`.

El BFF valida sesión y rol mediante Users por operación. Las rutas permitidas están enumeradas en `src/app/api/bff/[...path]/route.ts`; no es un proxy arbitrario. Las escrituras requieren header propio y verifican Origin/Fetch Metadata. La protección upstream de Users se satisface con su contrato server-to-server `X-CSRF-Protection: 1`, sin reenviar Origin del navegador.

Una renovación cuyo resultado no puede confirmarse queda marcada como incierta y requiere volver a iniciar sesión; evita reutilizar un refresh que pudo rotar. Un cierre local sin confirmación de Users se comunica explícitamente. Logout limpia la cache privada. El cambio de password revoca sesiones en Users y cierra la sesión local.

**Catalog:** el modo integrado elimina su puerto publicado usando `docker/catalog.private.yml`. El BFF verifica ADMIN en importación, edición y publicación. Playback se conecta a Catalog por red Docker con `docker/playback.integrated.yml`. Iniciar Catalog posteriormente con su Compose base puede volver a publicar el puerto: conservar los overrides del script para este modo. La alternativa futura preferible es autorización JWT también dentro de Catalog.

## Reproducción

El navegador recibe solo la URL temporal necesaria para el video; los bytes van directamente a MinIO. Preparar reproducción es una acción explícita y single-flight. La posición inicial viene de Playback. Se guardan posiciones cada 10 s y tras seek, con una cola que agrupa el último valor pendiente sin impedir retrocesos. Pause y complete se ordenan con esas escrituras. Se renueva la URL antes de vencer y se restauran tiempo y pausa.

El player detiene escrituras de sesiones reemplazadas, muestra problemas de guardado y conserva el video cuando puede. `pagehide` es best effort; no garantiza el último intervalo ante cierre abrupto. MP4 H.264/AAC, sin transcodificación ni subtítulos inventados. Las credenciales de Users no se envían a MinIO.

## Upload y publicación

ADMIN → seleccionar MP4 → transferencia multipart por streaming → ffprobe/MinIO en Playback → metadata confirmada → nueva ficha por Catalog bulk → publicar. Hasta 256 MiB. El progreso muestra bytes transferidos y luego validación, sin inventar porcentaje de ffprobe. No se usa `formData()` para bufferizar el video en el BFF.

El asset confirmado y la importKey se retienen en sessionStorage, asociados al usuario, para recuperar la ficha sin repetir upload. Solo contienen referencias públicas; no tokens. No existe asignación de video a títulos existentes en Catalog. El editor cambia únicamente la ficha editorial. Publicar comprueba que el asset sigue READY.

## Desarrollo

Node 24. Se usa TypeScript 5.9.3 por compatibilidad declarada de openapi-typescript; los servicios conservan sus versiones independientes. npm 12 evita un fallo de resolución observado con npm 10 en este árbol.

```powershell
npm install --global npm@12.2.0
npm ci
npm run dev:setup
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d redis
npm run dev
```

Para desarrollo fuera de Docker, las URLs `.env` deben ser alcanzables desde el host. El modo integrado mantiene Catalog privado; usar un túnel local temporal al contenedor o ejecutar el frontend mediante Docker. No abrir Catalog públicamente para resolverlo. Detener primero la API frontend Docker si ocupa 3003.

## Configuración

| Variable             | Uso                                                            |
| -------------------- | -------------------------------------------------------------- |
| USERS_SERVICE_URL    | URL privada de Users                                           |
| CATALOG_SERVICE_URL  | URL privada de Catalog                                         |
| PLAYBACK_SERVICE_URL | URL privada de Playback                                        |
| REDIS_URL            | Almacén exclusivo de sesiones BFF                              |
| APP_ORIGIN           | Origen exacto del navegador, por defecto http://localhost:3003 |
| SESSION_SECRET       | 32 bytes hex, generados por setup; no versionar                |
| MEDIA_ORIGIN         | Origen público de MinIO para CSP; argumento de build Docker    |

Para otro dominio/dispositivo, configurar APP_ORIGIN y MEDIA_ORIGIN, y el MINIO_PUBLIC_URL de Playback antes de emitir URLs. Reconstruir frontend al cambiar MEDIA_ORIGIN. No editar el host de una URL ya firmada. No hay variables NEXT_PUBLIC con secretos.

## Validación

```powershell
npm run types:generate
npm run check
npm run test:coverage
npx playwright install chromium
npm run test:e2e
```

Los tipos se generan desde los tres YAML reales y se versionan en `src/types/generated`. Vitest y Testing Library verifican formularios, catálogo, búsqueda, bibliotecas, actualizaciones optimistas, preferencias, upload, perfil, cierre de sesión y el reproductor. Los nombres reales son `AuthForm` (login/registro), `Card` y `Section` (tarjeta/fila). Se ejecutan los archivos secuencialmente para evitar contención de workers durante builds Docker; no hay reintentos de tests. TypeScript y ESLint incluyen archivos TSX.

`npm run test:e2e` requiere Docker Desktop con motor Linux/Compose y Chromium de Playwright. El runner construye las cuatro aplicaciones desde el código actual, ejecuta migraciones/inicializadores y crea un proyecto Compose aleatorio `nevaro-e2e-*`. PostgreSQL, los dos MongoDB, MinIO y Redis pertenecen exclusivamente a esa ejecución. Reserva puertos loopback libres; no lee los `.env` locales ni accede a sus bases. Compila imágenes secuencialmente para reducir el consumo de la VM.

Se generan claves RSA, contraseñas efímeras, las cuentas `demo@streaming.local`/`admin@streaming.local`, dos títulos y un MP4 H.264 sintético de 12 segundos/320×180 (menos de 1 MiB) con ffmpeg dentro de Playback. No necesita cuentas personales, `docs/demo-local.json` ni videos descargados. Al terminar elimina sus contenedores, volúmenes y secretos temporales. Los tests de caída detienen solo servicios del proyecto propio y los recuperan en `finally`. La preparación de expiración JWT se ejecuta por stdin exclusivamente dentro de ese stack, sin endpoint de depuración ni código añadido al runtime.

Reportes conservados: `playwright-report/index.html`, `test-results/results.json`, `test-results/junit.xml`; capturas solo al fallar. Los traces están deshabilitados localmente y se retienen solo al fallar con `CI=true`, sin snapshots ni fuentes; los videos están deshabilitados. El reporter inicial redacta las contraseñas efímeras de prueba en títulos de acciones y errores, ya que el HTML incluye valores de `fill` incluso sin traces. CI sanea también los ZIPs antes de subirlos: ver [pipeline](../docs/quality/CI_PIPELINE.md). Cobertura V8 en `coverage/index.html`, `coverage/coverage-summary.json` y `coverage/lcov.info`. Mide componentes, features, cliente HTTP y utilidades; no instrumenta rutas Next/BFF ni los otros servicios. No se deben sumar porcentajes E2E a esa cobertura.

Los ocho flujos E2E solicitados y las regresiones adicionales (roles/CSRF, sesión revocada, renovación de URL, perfil/password, responsive y Redis caído) se ejecutan con un worker y cero retries. Para filtrar casos conservando aislamiento: `npm run test:e2e -- --grep E2E-04`. Ver [resultados de frontend](../docs/quality/FRONTEND_TEST_RESULTS.md), [verificación histórica](docs/verification.md), [arquitectura](docs/architecture.md) y [contratos](docs/contracts.md).

Licencias de Manrope y Lucide en `docs/licenses`, también incluidas en la imagen runtime.

## Hardening de calidad y seguridad

ESLint cubre TS/TSX; TypeScript conserva strict; Prettier comparte la configuración raíz.

```powershell
npm run format:check
npm run lint
npm run typecheck
npm audit --audit-level=high
```

`npm run format` aplica el formato. Los gates de CI también escanean secretos y auditan dependencias. Consulte [Security Review](../docs/quality/SECURITY_REVIEW.md) y [Dependency Audit](../docs/quality/DEPENDENCY_AUDIT.md), incluidos los pendientes de rotación de secretos y avisos MEDIUM. No versionar `.env` ni claves privadas.
