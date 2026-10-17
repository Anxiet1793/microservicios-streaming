# Guía de implementación para Codex

## Contrato de esta entrega

Este paquete es planificación, no autorización para implementar todo ahora. No contiene un frontend ejecutable. Una vez aprobado el diseño y recibida la instrucción de implementar, seguir esta secuencia y las fuentes de verdad del repositorio.

## Orden obligatorio de lectura

00_README → CURRENT_BACKEND_CAPABILITIES → 09_API_INTEGRATION_MATRIX → 10_BACKEND_GAPS → 08_FRONTEND_ARCHITECTURE → 03_DESIGN_TOKENS y tokens.css → 04_DESIGN_SYSTEM → 06_SCREEN_SPECIFICATIONS/07_UX_FLOWS → 11_ROADMAP/16_TEST_STRATEGY. Brand y wireframes definen criterios visuales, no sustituyen contratos.

## Primer trabajo concreto

Obtener repo y rama; leer AGENTS antes de editar. Inspeccionar los tres `docs/openapi.yaml`, README, Compose y entorno de ejemplo, comparar controladores. Añadir SHA y evidencia por fila de 09. Ejecutar un spike de transporte que haga login, cree una sesión, reproduzca MP4 con seek, pause y recupere posición con nueva sesión. No construir Home antes de resolver que ese recorrido es viable.

Puertas: G02 cookie/CSRF, G05 DTO y expiración, G09 red de firma, G08 seguridad Catalog. Registrar decisión BFF final y almacén de sesión. No crear endpoints supuestos para pasar el spike.

## Foundation y convenciones

Next App Router/React/TS strict con versiones compatibles al repo y lockfile. CSS Modules, tokens CSS globales y fuente Manrope local con OFL. Lucide por import individual. Radix solo para semántica compleja. RHF/Zod para formularios; TanStack Query para estado remoto en cliente. No Redux/Zustand de inicio. No generar proyectos duplicados si ya hay frontend.

- Rutas de 05; route groups public/viewer/player/admin, sin duplicar prefijos en URL.
- Feature owns sus queries, schemas y adaptadores; ui/ no hace red.
- Nombres PascalCase componentes, camelCase funciones y DTO con sufijo Dto cuando convenga, archivos según convención del repo.
- Props expresan intención; no pasar tokens Bearer por árboles React.
- Tipos generados por servicio a partir de OpenAPI. View models de 08 son conceptuales; adaptar, no copiar esquemas internos.
- Imports server-only explícitos, variables privadas fuera de NEXT_PUBLIC. Publicar solo datos sanitizados hacia componentes cliente.
- Auth y rol se validan por operación en servidor, nunca solo en middleware/menú. BFF allowlist, no proxy dinámico de URL arbitraria.
- Errores normalizados en capa API; todo estado sensible se particiona por userId y se borra al cambiar cuenta.

## Reglas que no se improvisan

La marca provisional es NÉVARO; cambiar nombre en brand.ts y colores semánticos en tokens, no con find/replace de cada componente. Fondo tinta/ámbar, sin exceso de efectos. Primary para Play y CTA principal, no toda navegación. Home moderado, detalle dedicado, buscar en página, no previews autoplay ni modo claro MVP. Series informativas sin Play mientras no haya episodios.

Separar filtros por URL, estado remoto en Query, UI del player local, credenciales en sesión server. Usar un controlador de player con escrituras ordenadas y single-flight de sesión/renovación. No listeners duplicados ni setInterval que sobreviva al unmount. Pause no depende de respuesta para pausar media; guardado confirmado sí depende de backend.

## API y BFF

Tres adaptadores server-only usersClient/catalogClient/playbackClient; recommendationClient no se activa sin contrato. Browser client solo rutas BFF del mismo origen. Cerrar protocolo refresh/CSRF antes de implementarlo, según 07. No cache privada compartida, no interceptor que adjunte JWT a MinIO.

Para upload, comprobar runtime/proxy body limit y streaming multipart con archivo del tamaño previsto; progreso de bytes y posterior validación son estados distintos. Si no se consigue streaming seguro, decidir arquitectura explícita con backend; no inventar presigned upload API. Asset→título nuevo se crea vía bulk, asociar existente requiere G01.

## Criterios visuales verificables

Usar layouts de 14: Home sin hero de pantalla completa, carril continuar de alta prioridad, información esencial sin hover, acciones con nombre visible en touch. Probar 1440/1100/820/390 y 320 px, textos largos, image error, zoom y teclado. No título de director/idioma vacío ni ratings numéricos inventados. Las imágenes ausentes mantienen ratio y texto legible.

## Propuesta de cortes de trabajo

1. Auditoría/spike y ADR de auth/BFF.
2. Foundation y login con pruebas de seguridad/cookies.
3. Shell + catálogo + detalle sin acciones personales.
4. Player real + avance + retomar, pruebas E2E.
5. Mi Lista/gustos/historial con paginación y rollback.
6. Admin título nuevo + upload/publicar.
7. QA visual/a11y/performance y ensayo.

Cada corte incluye test de riesgo, build, typecheck y lint; no esperar a fase final. Si un contrato falta, abrir gap y dejar UX explícita, no mock silencioso en camino de producción.

## Acceptance final

Recorrido 3 minutos completo y real; guardado confirmado tras pause; re-login retoma; url refresh conserva currentTime; USER no publica ni sube; ADMIN publica nuevo título; cuenta nueva no ve cache ajena; teclado y móvil operables; logs sin credenciales; API matrix con evidencia actual; scripts de arranque y preparación de demo reproducibles sin destrucción de datos.
