# Contratos contrastados

17/10/2026. Fuentes: YAML, Route Handlers, validadores y Compose locales. No hay repositorio Git inicializado; se identifica cada YAML mediante SHA-256. Los tipos generados proceden de estos archivos.

## users-service

SHA-256: `db852997cee731fde48d1208613b27b2e55d6ba2029052a192fd9a4c97eaa10f`

| Método | Ruta                                      | operationId             |
| ------ | ----------------------------------------- | ----------------------- |
| POST   | `/api/v1/auth/register`                   | registerUser            |
| POST   | `/api/v1/auth/login`                      | loginUser               |
| POST   | `/api/v1/auth/refresh`                    | refreshSession          |
| POST   | `/api/v1/auth/logout`                     | logoutUser              |
| GET    | `/api/v1/users/me`                        | getCurrentUser          |
| PATCH  | `/api/v1/users/me`                        | updateProfile           |
| POST   | `/api/v1/users/me/change-password`        | changePassword          |
| GET    | `/api/v1/users/me/watchlist`              | getWatchlist            |
| POST   | `/api/v1/users/me/watchlist/{tituloId}`   | addToWatchlist          |
| DELETE | `/api/v1/users/me/watchlist/{tituloId}`   | removeFromWatchlist     |
| GET    | `/api/v1/users/me/preferences`            | getContentPreferences   |
| PUT    | `/api/v1/users/me/preferences/{tituloId}` | setContentPreference    |
| DELETE | `/api/v1/users/me/preferences/{tituloId}` | removeContentPreference |
| GET    | `/api/health`                             | health                  |
| GET    | `/.well-known/jwks.json`                  | jwks                    |

## catalog-service

SHA-256: `aa73e94796b38b0be6dd8b1e42145a0c6da62c1572fe782d95232c625a72a8c3`

| Método | Ruta                                            | operationId             |
| ------ | ----------------------------------------------- | ----------------------- |
| GET    | `/api/health`                                   | getHealth               |
| GET    | `/api/v1/catalog`                               | getCatalogTitles        |
| POST   | `/api/v1/catalog/bulk`                          | bulkCreateCatalogTitles |
| GET    | `/api/v1/catalog/{tituloId}`                    | getCatalogTitleById     |
| PATCH  | `/api/v1/catalog/{tituloId}`                    | updateCatalogTitle      |
| PATCH  | `/api/v1/catalog/{tituloId}/publication-status` | changePublicationStatus |

## playback-service

SHA-256: `c5b1fdbc2c93d6a09fde31d2c9e03fbc5d5861a74112d806f6de7b81f2ee9b0a`

| Método | Ruta                                                | operationId        |
| ------ | --------------------------------------------------- | ------------------ |
| GET    | `/api/health`                                       | health             |
| POST   | `/api/v1/media/assets`                              | uploadAsset        |
| GET    | `/api/v1/media/assets/{assetId}`                    | getAsset           |
| DELETE | `/api/v1/media/assets/{assetId}`                    | deleteAsset        |
| POST   | `/api/v1/playback/sessions`                         | startSession       |
| PATCH  | `/api/v1/playback/sessions/{sessionId}/progress`    | updateProgress     |
| POST   | `/api/v1/playback/sessions/{sessionId}/pause`       | pausePlayback      |
| POST   | `/api/v1/playback/sessions/{sessionId}/resume`      | resumePlayback     |
| POST   | `/api/v1/playback/sessions/{sessionId}/complete`    | completePlayback   |
| POST   | `/api/v1/playback/sessions/{sessionId}/refresh-url` | refreshPlaybackUrl |
| GET    | `/api/v1/playback/me/continue-watching`             | continueWatching   |
| GET    | `/api/v1/playback/me/history`                       | history            |

## Decisiones verificadas

- Users usa cookie users_refresh, Path=/api/v1/auth, HttpOnly/SameSite Strict; refresh/logout server-to-server requieren X-CSRF-Protection: 1 sin Origin. El BFF conserva esa cookie solo en servidor.
- Login entrega expiresIn y user; refresh rota cookie y access. GET users/me confirma rol/estado en cada operación BFF.
- Catalog usa type=1/2, status=1/2/3 y códigos numéricos de géneros/idiomas. Consumidor fuerza status=2 y filtra detalle publicado en servidor.
- Catalog PATCH solo ficha; playbackReference se asigna al crear. providerId=1 y manifestKey opaco asset:ast_UUID por compatibilidad.
- Listas Users usan items; Catalog/Playback usan data. Todas tienen pagination. La composición conserva referencias y errores por ficha.
- Playback usa progress.positionSeconds, playback.url y playback.expiresIn. No se calcula duración desde el navegador para persistir.
- Publicación exige ADMIN en BFF y comprobación de asset READY. Catalog queda sin puerto publicado en el arranque integrado.

## Evidencia de ejecución

Los recorridos ejecutados, sus límites y las comprobaciones de navegador están en verification.md. Contrato contrastado no implica que cada error posible de cada operación haya sido inyectado. Health/JWKS permanecen como infraestructura; el frontend no expone claves privadas.
