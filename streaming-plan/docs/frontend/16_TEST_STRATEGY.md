# Estrategia de validación frontend

Esta entrega contiene un plan de pruebas, no resultados de una aplicación. No hay tests de UI ejecutados porque el frontend no se implementó. Los checks de archivos/contraste del paquete se registran aparte en 18_VALIDATION.md.

## Pirámide por riesgo

| Nivel | Herramienta | Casos con valor | Evitar |
|---|---|---|---|
| Unit | Vitest | Conversión DTO→view model, clamp/format tiempo, cola ordenada de progreso, refresh single-flight, política de retries y redacción de logs | Snapshot de todas las constantes o getters triviales |
| Component | Testing Library + mocks de red | Formularios con errores, estado unknown de preferencia, toggle/rollback, permisos visibles, fallback imagen y loading/error regional | Testear nombre de hook o estructura interna del componente |
| Contrato | Tipos OpenAPI + validación selectiva | Sesión, expiración/progreso, paginación y errores contra ejemplos reales | Dar por existente un endpoint porque el mock responde |
| E2E | Playwright | Recorridos reales con Users/Catalog/Playback/MinIO | Sustituir toda la integración por mocks y llamarla demo real |
| Visual/a11y | Capturas comparables + axe + manual | Anchos 1440/1100/820/390/320, focus, imágenes claras/rotas | Baselines aceptadas sin inspección |

## Casos E2E críticos y oráculos

| Flujo | Preparación | Aserción principal |
|---|---|---|
| Registro | Email único y seed conocido | Cuenta USER, no ADMIN; login funciona |
| Login/refresh | TTL de prueba corto controlado | Navegación sigue autenticada tras expiración; una sola rotación por sesión bajo concurrencia |
| Home/catálogo | Un publicado y uno registrado | Solo publicado aparece en consumidor; sin etiquetas falsas de popularidad |
| Buscar | Títulos conocidos y latencias cruzadas | Resultado de query reciente prevalece, back conserva query |
| Mi Lista | Estado fuera de lista | Agregar, navegar, re-login, sigue guardado; quitar persiste |
| Rollback | Fallar mutación concreta | Estado previo restaurado y error accionable, sin cache de otra cuenta |
| Gustos | Estado LIKE inicial | Cambiar a DISLIKE y luego neutral; solo un estado activo y backend coincide |
| MP4 real | Archivo pequeño H.264/AAC y URL accesible | loadedmetadata + reproducción real + avance currentTime; seek con respuesta Range adecuada |
| Pausa/retomar | Avance a 25 s, pausa confirmada | Home muestra pendiente y nueva sesión arranca a <=2 s del último guardado confirmado |
| Logout/retomar | Guardado confirmado | Tras login misma cuenta retoma; otra cuenta no hereda progreso/cache |
| Expirar URL | TTL corto en entorno de pruebas | Renovación conserva posición y paused; no loop de solicitudes |
| Sesión sustituida | Dos pestañas mismo título | Primera no sobrescribe última y avisa claramente |
| Complete | Dejar terminar MP4 corto | Historial refleja finalizado y Continuar lo excluye según backend |
| Historial | Varias sesiones del mismo título | Se representa última reproducción por título, no sesiones inventadas |
| Admin upload | ADMIN, MP4 válido | Asset READY, ficha nueva importada/publicada y USER la reproduce |
| Denegación | USER intenta API admin directamente | Upload y escrituras Catalog no quedan abiertas por puerto alternativo |
| Fallos parciales | Playback/Catalog/Users caen de forma controlada | Región afectada ofrece salida, resto funcional según dependencia real |

No todas las fallas se fuerzan contra un servicio compartido: usar entorno de pruebas aislado. Mocks sirven para estados UI y timing; la suite de aceptación usa servicios reales. Interceptar errores concretos no prueba semántica backend, debe etiquetarse.

## Estabilidad de pruebas

Seed idempotente con IDs propios y cleanup por APIs documentadas cuando existan. No borrar volúmenes. UI por roles/labels (`getByRole`) y expectativas basadas en eventos, no sleeps de 10 s. Estado autenticado de tests en archivos temporales ignorados y nunca adjuntos a reportes con cookies. Videos de test y traces revisados/redactados antes de compartir. Si no hay cleanup de títulos en API, usar namespace/importKey de prueba y entorno desechable autorizado, no inventar DELETE.

## Performance y seguridad

Medir LCP/INP/CLS según 08 con red/dispositivo consignados; detectar requests duplicadas y peso de chunks. Confirmar MP4 no se descarga desde Home, queries canceladas y lista paginada. Revisar bundles/NEXT_PUBLIC, logs sin secretos, CSRF, cache entre usuarios, acceso directo a Catalog y role tampering. No escaneo ofensivo de sistemas externos.

## Puertas de salida

PR: typecheck, lint, build y pruebas relevantes al cambio. Integración: E2E de login→reproducir→pausa→retomar, roles y regresión de cache. Exposición: 5 ensayos del recorrido base, 2 de upload si se demuestra, QA manual de teclado/móvil. Sin errores bloqueantes abiertos; brechas de accesibilidad multimedia declaradas. Repetir solo pruebas que un cambio posterior pueda afectar.
