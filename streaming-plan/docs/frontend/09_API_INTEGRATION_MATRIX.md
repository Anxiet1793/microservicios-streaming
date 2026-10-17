# Matriz de integración UI ↔ backend

**Todas las filas tienen evidencia D (S1 §7); ninguna V.** Son rutas documentadas, no endpoints verificados en código/OpenAPI. Las categorías de error son escenarios de diseño: los códigos exactos, envelopes y cuerpos deben transcribirse desde YAML antes de programar. No asumir 200/201/204/409 porque sean convencionales. En particular los ejemplos de S0 no constituyen evidencia.

Los endpoints BFF propios son propuesta y se definirán después de G02; esta tabla contiene exclusivamente rutas de los servicios descritas en S1. Auth describe servicio upstream. El navegador BFF propuesto usará cookie de sesión, no Bearer visible a JavaScript.

| ID | Pantalla | Componente | Acción | Método | Endpoint documentado | Servicio | Auth | Respuesta documentada / NV | Errores a manejar, status por verificar |
|---|---|---|---|---|---|---|---|---|---|
| U01 | Registro | RegisterForm | Crear cuenta | POST | /api/v1/auth/register | Users | Pública | Usuario y perfil; esquema NV | Validación/duplicado/429 |
| U02 | Login | LoginForm | Entrar | POST | /api/v1/auth/login | Users | Pública | Access JWT + refresh cookie; forma NV | Credenciales/429/5xx |
| U03 | Todas privadas | SessionController | Renovar | POST | /api/v1/auth/refresh | Users | Cookie + CSRF | Access + cookie rotada; nombres NV | Refresh inválido/CSRF/5xx |
| U04 | Perfil/Navbar | LogoutButton | Salir | POST | /api/v1/auth/logout | Users | Cookie opcional + CSRF | Revocación y borrado cookie; status NV | CSRF/red/5xx |
| U05 | Perfil/Layout | ProfileForm | Leer perfil | GET | /api/v1/users/me | Users | Bearer | Usuario/perfil; DTO NV | 401/5xx |
| U06 | Perfil | ProfileForm | Editar perfil | PATCH | /api/v1/users/me | Users | Bearer | Nombre/avatar/idioma; respuesta NV | 401/validación |
| U07 | Perfil | PasswordForm | Cambiar contraseña | POST | /api/v1/users/me/change-password | Users | Bearer | Revoca sesiones; payload NV | 401/validación/clave incorrecta |
| U08 | Mi Lista/Detalle | WatchlistButton | Leer referencias | GET | /api/v1/users/me/watchlist | Users | Bearer | Lista paginada; envelope NV | 401/5xx |
| U09 | Detalle/Home | WatchlistButton | Agregar | POST | /api/v1/users/me/watchlist/{tituloId} | Users | Bearer | Status/cuerpo NV | 401/duplicado/validación |
| U10 | Mi Lista/Detalle | WatchlistButton | Quitar | DELETE | /api/v1/users/me/watchlist/{tituloId} | Users | Bearer | Status/cuerpo NV | 401/ausencia NV |
| U11 | Detalle/Preferencias | PreferenceGroup | Leer señales | GET | /api/v1/users/me/preferences | Users | Bearer | Lista paginada LIKE/DISLIKE; envelope NV | 401/5xx |
| U12 | Detalle | PreferenceGroup | Elegir señal | PUT | /api/v1/users/me/preferences/{tituloId} | Users | Bearer | Valor LIKE/DISLIKE; nombre campo NV | 401/validación |
| U13 | Detalle/Preferencias | PreferenceGroup | Quitar señal | DELETE | /api/v1/users/me/preferences/{tituloId} | Users | Bearer | Status/cuerpo NV | 401/ausencia NV |
| C01 | Home/Explorar/Buscar/Admin | MediaRow/Grid | Listar/filtrar | GET | /api/v1/catalog | Catalog | Sin auth en S1 | Ficha paginada; q/type/status/genre/year | Validación/5xx |
| C02 | Detalle/composición | TitleDetail | Leer ficha | GET | /api/v1/catalog/{tituloId} | Catalog | Sin auth en S1 | Ficha + playbackReference; DTO NV | No encontrado/retirado |
| C03 | Admin nueva ficha | TitleForm | Importar | POST | /api/v1/catalog/bulk | Catalog | Sin auth en S1; BFF ADMIN propuesto | Hasta 500 items por defecto; resultado NV | Validación/conflicto importación/parcial |
| C04 | Admin editar | TitleForm | Editar editorial | PATCH | /api/v1/catalog/{tituloId} | Catalog | Sin auth en S1; BFF ADMIN propuesto | Solo ficha; no playbackReference | Validación/concurrencia/no encontrado |
| C05 | Admin | PublicationDialog | Cambiar estado | PATCH | /api/v1/catalog/{tituloId}/publication-status | Catalog | Sin auth en S1; BFF ADMIN propuesto | Transición editorial; payload NV | Transición inválida/concurrencia |
| P01 | Watch | SessionController | Iniciar sesión | POST | /api/v1/playback/sessions | Playback | Bearer | Request {tituloId}; respuesta URL/sesión, campos NV | 401/403/título no publicado/asset ausente |
| P02 | Watch | ProgressController | Guardar avance | PATCH | /api/v1/playback/sessions/{sessionId}/progress | Playback | Bearer | Request {positionSeconds}; respuesta NV | 401/sesión sustituida/validación |
| P03 | Watch | PlayPauseButton | Pausar | POST | /api/v1/playback/sessions/{sessionId}/pause | Playback | Bearer | Posición opcional; nombre por verificar | 401/estado/sesión sustituida |
| P04 | Watch | PlayPauseButton | Reanudar | POST | /api/v1/playback/sessions/{sessionId}/resume | Playback | Bearer | URL renovada; campos NV | 401/estado/asset ausente |
| P05 | Watch | SessionController | Completar | POST | /api/v1/playback/sessions/{sessionId}/complete | Playback | Bearer | Fija posición final; payload NV | 401/estado/sesión sustituida |
| P06 | Watch | UrlController | Renovar URL | POST | /api/v1/playback/sessions/{sessionId}/refresh-url | Playback | Bearer | URL firmada de sesión abierta; expiración NV | 401/estado/sesión sustituida |
| P08 | Home/Continuar | ContinueWatchingCard | Leer pendientes | GET | /api/v1/playback/me/continue-watching | Playback | Bearer | Progreso paginado, <90% y sin completar | 401/5xx |
| P09 | Historial/Detalle | HistoryList | Leer historial | GET | /api/v1/playback/me/history | Playback | Bearer | Última reproducción por título, paginada | 401/5xx |
| P10 | Admin upload | UploadForm | Subir MP4 | POST | /api/v1/media/assets | Playback | Bearer ADMIN | Multipart, assetId; campo file NV | 401/403/tamaño/codec/429 |
| P11 | Admin upload | AssetSummary | Leer metadata | GET | /api/v1/media/assets/{assetId} | Playback | Bearer ADMIN | Metadata/status; DTO NV | 401/403/no encontrado |
| P12 | Admin recuperación | DeleteAssetDialog | Borrado lógico | DELETE | /api/v1/media/assets/{assetId} | Playback | Bearer ADMIN | Pasa a DELETED, status NV | 401/403/conflicto sesiones abiertas |

## Notas operativas

- S1 especifica `page=1`, `limit=20`, máximo 100 para listas Users; no trasladar esos parámetros a Catalog/Playback sin YAML.
- C01 admite los nombres de filtro indicados; enums exactos y orden no recibidos. El consumidor debe limitar a publicado en servidor.
- No P07 faltante: identificadores reservados para evolución del plan; no se asigna operación inventada para completar una secuencia.
- Operaciones de infraestructura: GET `/api/health` en los tres servicios, GET `/.well-known/jwks.json` en Users. No son funcionalidades de usuario ni se exponen con claves privadas.
- MP4 GET a URL firmada no utiliza Bearer de Users: la propia firma autoriza temporalmente el objeto. No enviar JWT al host de imágenes/MinIO por un interceptor global.

## Registro requerido por operación antes de integrar

`operationId`, archivo YAML y líneas, router/controlador y líneas, SHA, request headers/body/params, success status/body/headers, errores, esquema de paginación, autorización y evidencia de ejecución redactada. Para auth, documentar `Set-Cookie`, Path, SameSite, Secure y CSRF sin copiar valores de tokens.

## Composición sin endpoints ficticios

Mi Lista: U08 → referencias → C02 para cada ID (máximo 4 en paralelo y cache compartida por ID). Historial y continuar igual desde P09/P08. Si falta batch de fichas se considera mejora G06, no se manda GET con ids no documentado. Preferencia por título usa paginación completa acotada en demo o espera G06. No usar solo primera página como estado definitivo.
