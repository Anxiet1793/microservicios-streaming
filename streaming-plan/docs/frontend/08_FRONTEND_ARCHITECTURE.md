# Arquitectura frontend

## Stack seleccionado

| Capa | Elección | Motivo / límite |
|---|---|---|
| Framework | Next.js App Router + React + TypeScript strict | Layouts, RSC y BFF en mismo proceso; versiones compatibles a fijar tras leer repo |
| Estilos | CSS Modules + custom properties | Control visual explícito; sin dependencia de apariencia prefabricada |
| Estado remoto | TanStack Query | Cache, invalidación y mutations en islas interactivas |
| Formularios | React Hook Form + Zod | Validación de intención y mensajes; validación backend sigue obligatoria |
| Primitives | Radix selectivo | Dialog, tooltip/menu si necesarios; estilo propio |
| Iconos | Lucide | Una familia, imports individuales |
| Video | HTMLVideoElement MP4 nativo | Sin SDK de streaming/HLS antes de que exista pipeline |
| Tests | Vitest, Testing Library, Playwright | Dominio/contratos y flujos según riesgo |
| Estado global | Sin Zustand/Redux inicialmente | Context reducido para sesión sanitizada; player local |

Tailwind es viable, pero CSS Modules facilita este paquete pequeño con tokens y reglas de ratio/controles muy explícitas. No combinar dos sistemas de styling sin motivo. Versiones exactas, Node compatible y lockfile se deciden contra manifests reales; no afirmar que un «latest» futuro está probado.

## BFF frente a acceso directo

| Aspecto | Directo a tres servicios | BFF Next acotado |
|---|---|---|
| Cookies/CORS | Configurar orígenes, credentials y CSRF cuidadosamente | Navegador mismo origen; upstream sigue necesitando protocolo correcto |
| JWT | Access disponible al JS si se usa Bearer desde navegador | Credenciales retenidas server-side |
| Composición | N llamadas en cliente | Agregar fichas con cache y límite de concurrencia |
| Roles Catalog | UI no protege puertos públicos | BFF valida rol; puertos deben quedar en red privada |
| Upload | Menos saltos de bytes | Hay que transmitir sin buffering excesivo y ajustar límites |
| Operación | Menos estado server | Sesión opaca requiere almacén y locks |

**Recomendación:** BFF delgado por costo de integración de auth, composición y protección de escritura Catalog; sin API Gateway adicional. No es un proxy abierto ni una nueva capa de dominio. Los Route Handlers son endpoints públicos y autorizan cada operación. RSC llama adaptadores server-only directamente; no se hace fetch desde servidor hacia su propio BFF.

Condición de salida de arquitectura: comprobar refresh/CSRF de Users (G02), cookie jar, streaming multipart y expiración. Si ese contrato impide BFF, ADR alternativo antes de codificar: llamadas browser→Users con refresh HttpOnly y access solo en memoria, CORS/cookies probados, access no persiste; se reevalúa render personalizado en servidor y Catalog sigue protegido por BFF/red. No mezclar ambos modelos accidentalmente.

Los bytes de reproducción van **navegador→URL firmada MinIO**, no a través de Next. El host firmante debe ser accesible al navegador y coincidir con firma/headers: no reemplazar `minio:9000` por localhost en una URL ya firmada. En proyector/red local, localhost del espectador puede ser otro dispositivo. Preparar endpoint externo correcto al firmar y comprobar Range/206 y seeking. CORS solo cuando la operación lo requiera, con orígenes explícitos; no comodín con credentials.

## Estructura propuesta, no creada como aplicación

| Directorio | Responsabilidad |
|---|---|
| src/app/(public)/login, register | Acceso |
| src/app/(viewer)/home, explore, search, title/[tituloId] | RSC de catálogo y shell |
| src/app/(viewer)/my-list, history, continue-watching, profile, preferences | Datos personales dinámicos |
| src/app/(player)/watch/[tituloId] | Layout inmersivo separado |
| src/app/(admin)/admin/content, upload | Shell ADMIN |
| src/app/api/... | BFF con rutas allowlist explícitas |
| src/components/ui, media, layout, player | Componentes reutilizables por responsabilidad |
| src/features/auth, catalog, watchlist, preferences, playback, admin | Casos de uso, hooks, schema y adaptadores de vista |
| src/lib/api/client | Cliente browser→BFF sin secretos |
| src/lib/api/server | usersClient/catalogClient/playbackClient, marcados server-only |
| src/lib/auth | Cookie jar, sesión y refresh lock |
| src/lib/config | Entorno validado y brand.ts |
| src/styles | Tokens y globals mínimos |
| src/types/generated | DTO generados tras recibir OpenAPI |
| tests/unit, component, e2e, fixtures | Evidencias por riesgo |

RecommendationClient se especifica como puerto futuro; no crear requests a una ruta inventada. No barrels que importen código server-only en bundles cliente.

## Estado y rendering

| Pantalla/dato | Estrategia | Client islands | Cache |
|---|---|---|---|
| Login/register | Shell Server Component | Formulario | Sin cache de respuesta auth |
| Home | Shell y catálogo RSC; datos personales dinámicos | Carril continuar, Mi Lista, toggles | Catálogo compartido solo si filtrado y sanitizado; privado no-store |
| Explorar/search | RSC inicial desde searchParams | Filtros y transición | Por query normalizada; aborto en búsquedas posteriores |
| Detalle | RSC ficha | Estado personal y acciones | Ficha pública/published separada de datos privados |
| Watch | Shell RSC autenticado | Player completo | Sesión/URL no-store, nunca cache persistente |
| Mi Lista/history | Shell RSC + datos bajo demanda | Query de composición | Key incluye userId; se limpia al salir |
| Perfil | Shell RSC y datos sanitizados | Formulario | No-store server; query privada corta |
| Admin | RSC comprueba rol | Upload/editor | No-store; nunca cache común |

No usar `use client` global. Evitar doble fetch: si se prehidrata una query desde servidor, compartir queryKey y timestamp; si no, RSC renderiza shell y la isla consulta una vez. No crear QueryClient global server que comparta cuentas.

Server state: usuario/perfil, catálogo, Mi Lista, preferencias, avance e historial. Client state: apertura de overlays, valores de formulario, volumen, controles y buffering. Filtros persistentes viven en URL; borrador de filtro en drawer local. Auth state: sesión server, UI solo `{userId, displayName, role}` sanitizada; rol cliente no autoriza.

## Cache y concurrencia propuestas

Catálogo staleTime 60 s, gcTime 5 min; Mi Lista/preferencias 30 s con invalidación al mutar; continuar/historial 10 s y revalidar al volver del player. Ajustar tras medir. Deshabilitar refetch por foco mientras reproduce si puede afectar sesión; recuperar auth fuera del estado media. Default de Query considera stale los datos y puede reintentar: configurar explícitamente para evitar ráfagas.

Keys: `['catalog', filtros]`, `['title', tituloId]`, `['watchlist', userId, page]`, `['preference', userId, tituloId]`, `['continue', userId, page]`. No persistir cache privada en disco. Join por tituloId con concurrencia 4, cache por ID y errores por ficha; listas del servidor se mantienen paginadas, no «fetch all» ilimitado.

## API client

Una interfaz por servicio, DTO separados de view models. Error normalizado propuesto: `{kind, status?, code?, message, requestId?, retryAfter?}` sin volcar payload completo. Capturar AbortError separado. Timeout inicial: GET 8 s, auth 10 s, escritura 15 s; upload usa presupuesto hasta 120 s configurable tras ensayo. Cancelar en cliente no revierte servidor.

Retry automático máximo 1 para GET en fallo de red/502/503/504 con backoff y jitter; respetar Retry-After. Ningún retry genérico para login, upload, creación de sesión, importación o mutaciones con resultado incierto. Refresh single-flight separado. No aplicar un segundo retry desde Query si cliente ya reintenta. AbortSignal llega a fetch upstream; no reutilizar señal abortada. Generar tipos desde cada YAML, no generar modelos desde tablas Mongo/SQL. Validación runtime selectiva para URLs/progreso/respuestas críticas.

## Modelos de vista TypeScript conceptuales

No son DTO verificados. Normalización de enums/optional fields queda en adaptador después de inspeccionar YAML.

```ts
type TitleId = string;
type PreferenceValue = 'LIKE' | 'DISLIKE' | null;
interface Profile {
  displayName: string;
  avatarUrl?: string;
  preferredLanguage: string;
}
interface User {
  userId: string;
  email: string;
  role: 'USER' | 'ADMIN';
  profile: Profile;
}
interface CatalogTitle {
  tituloId: TitleId;
  kind: 'movie' | 'series';
  title: string;
  synopsis?: string;
  year?: number;
  durationSeconds?: number;
  genres: string[];
  languages: string[];
  cast: string[];
  director?: string;
  ageRatingLabel?: string;
  posterUrl?: string;
  backdropUrl?: string;
  publication: 'registered' | 'published' | 'withdrawn';
  availability: 'unknown' | 'playable' | 'unavailable' | 'episodes-pending';
}
interface PlaybackProgress {
  tituloId: TitleId;
  positionSeconds: number;
  durationSeconds?: number;
  updatedAt?: string;
  completed: boolean;
}
interface PlaybackSession {
  sessionId: string;
  tituloId: TitleId;
  playbackUrl: string; // solo memoria efímera del player
  expiresAt?: string; // verificar nombre y presencia en respuesta real
  progress: PlaybackProgress;
  state: 'active' | 'paused' | 'completed' | 'failed';
}
interface WatchlistItem {
  tituloId: TitleId;
  addedAt?: string;
  title?: CatalogTitle;
  resolution: 'resolved' | 'unavailable' | 'failed';
}
interface ContentPreference {
  tituloId: TitleId;
  value: PreferenceValue;
  updatedAt?: string;
}
```

No derivar `playable` solamente de tener assetId: el asset puede estar eliminado/inaccesible. Antes de sesión es una expectativa; el inicio de Playback es autoridad final.

## Seguridad

Cookies HttpOnly, Secure en HTTPS, no refresh/access en localStorage. CSRF del BFF con comprobación Origin/Host/Fetch Metadata según despliegue y token si protocolo exige; SameSite es defensa adicional. Users mantiene su protección upstream. No reenviar Origin arbitrario del cliente como validación confiable. Aislar puertos de servicios si se confía en BFF para autorizar Catalog; preferir auth en Catalog también.

CSP con media-src al origen autorizado de objetos e img-src limitado a proveedores reales; no dangerouslySetInnerHTML para sinopsis. Validar URL de imágenes/avatar (http/https y allowlist apropiada); proxy de imagen no puede convertirse en SSRF. Same-origin BFF no es proxy hacia URLs suministradas. Sanitizar errores y logs; límites tamaño/timeout y rate limit por sesión. Evitar caches compartidas de contenido personalizado.

Entorno server-only propuesto: USERS_SERVICE_URL, CATALOG_SERVICE_URL, PLAYBACK_SERVICE_URL, APP_ORIGIN y SESSION_SECRET si se usa mecanismo que lo necesita. `NEXT_PUBLIC_*` solo nombre/flags públicos realmente necesarios; jamás passwords, claves RSA, credenciales MinIO o JWT. Nombres de variables del frontend son propuestas; no afirmar que ya existen en backend. Validar entorno al arrancar sin imprimir valores secretos.

## Performance, SEO y observabilidad

Poster con Next/Image y `sizes` ajustado a rejilla; imágenes bajo fold lazy, solo hero LCP prioritario. Reservar ratios para CLS. No precargar el MP4 ni URLs de sesión desde Home. Prefetch de detalle limitado, nunca iniciar sesión por hover. Player y admin upload en chunks propios; no arrastrarlos a navbar. Paginación explícita antes de virtualización. Memoización solo ante profiler, sin useMemo de cada string.

Objetivos p75 en tráfico real: LCP <=2.5 s, INP <=200 ms, CLS <=0.1. En demo medir laboratorio con dispositivo/red fijados y reportarlo como laboratorio, no p75 real. Presupuesto inicial JS del shell <200 KiB gzip como objetivo de ingeniería a revisar, no garantía. First frame MP4 <=3 s en red local ensayada, medido aparte de LCP.

SEO mínimo: título `{pantalla} · NÉVARO`, description pública genérica, favicon futuro, noindex en zonas privadas/admin; no OpenGraph con datos privados ni URLs firmadas. No landing promocional en fase P0.

Logs estructurados: service/operation/status/durationMs/requestId, sin cuerpos por defecto. Propagar requestId solo si contrato lo permite; si no, correlación local explícita. No tokens, cookies, password, email sin necesidad, URL completa firmada, bucket/objectKey ni payload multipart. ErrorBoundary regional y global con opción de volver. Player registra códigos media sanitizados y tiempo de inicio/renovación; no telemetría adicional que simule historial backend.

Fuentes primarias consultadas: Next BFF https://nextjs.org/docs/app/guides/backend-for-frontend ; auth https://nextjs.org/docs/app/guides/authentication ; Query https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults ; métricas https://web.dev/articles/vitals . Las configuraciones concretas anteriores son decisiones del proyecto.
