# Verificación de entrega

Fecha de la tarea: 2026-10-04. Entorno Windows, Node 24.21.0 y Docker Desktop Linux.

| Control ejecutado                   | Resultado                                               |
| ----------------------------------- | ------------------------------------------------------- |
| npm run typecheck                   | Correcto, TypeScript estricto y tipos Next              |
| npm run lint                        | Correcto, cero errores/warnings                         |
| npm test                            | 26 pruebas unitarias correctas                          |
| npm run docs:check                  | OpenAPI 3.0.3 válido, 12 operaciones                    |
| npm run build                       | Build de producción Next correcto                       |
| npm run build:scripts               | Inicializador compilado correctamente                   |
| docker compose up --build -d --wait | Correcto; init termina 0; API, Mongo y MinIO healthy    |
| npm run test:e2e                    | 11 grupos correctos con contenedores aislados           |
| Integración dentro del E2E          | 5 pruebas correctas con MongoDB replica set real        |
| scripts/verify-local-demo.ts        | Correcto con Users/Catalog/Playback reales en localhost |

## Cobertura

Unitarias: transiciones válidas/prohibidas, progreso negativo/no finito/fuera de tolerancia, porcentaje calculado, inicio ACTIVE, falta de asset, título sin publicar, propiedad, pausa/reanudación/completado, idempotencia, milestones, continuación, historial aislado, borrado lógico y bloqueo de recursos en uso. El reemplazo de una sesión pausada conserva PAUSED y registra supersededAt; no inventa una transición a FAILED.

Integración Mongo: inicialización repetible, índice unique, rollback de sesión/progreso ante fallo de outbox, finalización concurrente con un solo evento, explain de Continue Watching sin COLLSCAN.

Los once grupos E2E comprueban:

1. Health y UID no root del contenedor.
2. JWT ausente, issuer incorrecto, expirado y autorización ADMIN.
3. Upload de MP4 H.264 real, ffprobe, MIME/extensión, firma inválida, tamaño, multipart roto y campos adicionales.
4. Contrato HTTP Catalog: publicado/no publicado/404/503 y rechazo de userId cliente.
5. Bucket privado, URL firmada válida, firma vencida, Range HTTP 206 y bytes entregados.
6. Sesiones propias, límites de posición/porcentaje y protección de eliminación.
7. Pause/resume/refresh, progreso a 30 s, sesión nueva que retoma posición y rechazo de peticiones/URLs de sesión reemplazada.
8. Complete concurrente con un solo evento, historial, exclusión de Continuar viendo y borrado lógico.
9. Límite de cargas compartido y conservación del objeto después de borrado lógico.
10. Suite de integración en replica set temporal.
11. Health 503 al detener MinIO.

Cada E2E utiliza red, contenedores, puertos, base, bucket y claves JWT exclusivos de prueba. Limpieza en finally; no hay contenedores E2E activos al finalizar. No consulta Users PostgreSQL ni Catalog MongoDB.

## Integración real y demo disponible

Se generó un MP4 sintético de prueba (65 s, patrón visual), se inició sesión ADMIN por Users, se subió a Playback y se creó/publicó un título por Catalog API. La respuesta JWT de Users fue verificada por Playback mediante su JWKS real. No se utilizaron claves privadas de Users ni accesos directos a sus bases.

Con demo@streaming.local se comprobó Range 206, progreso a 30 s, pausa, sesión nueva desde esa posición, finalización e historial. Se comprobó la presencia del evento PLAYBACK_COMPLETED en el outbox propio. Finalmente se dejó otra sesión pausada a 30 s para exponer Continuar viendo. IDs locales en docs/demo-local.json (ignorado por Git), sin tokens/passwords.

Reproductor disponible en http://localhost:3002/demo.html. Se comprobó su entrega HTTP y sintaxis JavaScript. **No se realizó prueba visual/interactiva del navegador:** no había navegador conectado disponible en las herramientas. La comprobación automatizada valida subida, metadata, streaming HTTP y Range, no toda la experiencia de decodificación/controles en cada navegador. Seguir docs/demo.md para esa comprobación con tu video.

## Límites explícitos

- Catalog actual asigna playbackReference al crear; no permite reasignar títulos existentes. Se respeta su contrato y no se cambió su código.
- Los tests usan clip sintético; no se recibió exposicion.mp4 del usuario. El helper acepta ese archivo cuando esté disponible.
- MinIO se construye desde fuente oficial fija porque las imágenes históricas consultadas no estaban disponibles. Su distribución comunitaria está archivada; revisar alternativas mantenidas antes de producción.
- Outbox queda PENDING; no existe broker, dispatcher o Recommendation Service todavía.
- Progreso/completado son señales del cliente, no prueba antifraude de tiempo visto; watchTimeSeconds es null.
- No hay revocación inmediata de JWT externos/URLs ya firmadas, transcodificación/HLS/DRM ni alta disponibilidad.
- Compose está diseñado para desarrollo local, no para exposición pública sin TLS, IAM y Mongo autenticado.

## Siguiente bounded context: recomendaciones

Definir contrato versionado para señales explícitas de Users y eventos de Playback; implementar dispatcher outbox con reintentos/confirmación y consumidor idempotente por eventId. Crear persistencia y API propias de Recommendations; enriquecer tituloId mediante Catalog API, nunca bases compartidas. Definir significado de completado, retrocesos y tiempo desconocido antes de elegir un algoritmo. Nada de ese servicio se implementó aquí.
