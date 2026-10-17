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

| Variable | Uso |
|---|---|
| USERS_SERVICE_URL | URL privada de Users |
| CATALOG_SERVICE_URL | URL privada de Catalog |
| PLAYBACK_SERVICE_URL | URL privada de Playback |
| REDIS_URL | Almacén exclusivo de sesiones BFF |
| APP_ORIGIN | Origen exacto del navegador, por defecto http://localhost:3003 |
| SESSION_SECRET | 32 bytes hex, generados por setup; no versionar |
| MEDIA_ORIGIN | Origen público de MinIO para CSP; argumento de build Docker |

Para otro dominio/dispositivo, configurar APP_ORIGIN y MEDIA_ORIGIN, y el MINIO_PUBLIC_URL de Playback antes de emitir URLs. Reconstruir frontend al cambiar MEDIA_ORIGIN. No editar el host de una URL ya firmada. No hay variables NEXT_PUBLIC con secretos.

## Validación

```powershell
npm run types:generate
npm run check
npx playwright install chromium
npm run test:e2e
```

Los tipos se generan desde los tres YAML reales y se versionan en `src/types/generated`. Tests unitarios prueban orden/agrupación de progreso y límites de navegación. Playwright utiliza los servicios locales reales y un clip sintético propio; requiere el seed de Users y `playback-service/docs/demo-local.json`. Ver [verificación](docs/verification.md), [arquitectura](docs/architecture.md), [contratos](docs/contracts.md) y [demo](docs/demo.md).

Las cuentas y títulos creados por ensayos se conservan: no existe DELETE de títulos en la API y no se borran bases/volúmenes para limpiar tests. Usar un entorno local dedicado para repetir suites. Traces/videos de tests están deshabilitados para no guardar cookies o credenciales. Las capturas verificadas quedan en `.verification`, ignorado por Git/Docker.

Licencias de Manrope y Lucide en `docs/licenses`, también incluidas en la imagen runtime.
