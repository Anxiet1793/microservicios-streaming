# Capacidades actuales: auditoría documental

**Estado D, no V. Fuente S1 §§1–9.** No se inspeccionaron repositorio, YAML ni servicios ejecutándose. «Documentado» no significa probado ni vigente respecto a una rama desconocida.

## Inventario

| Servicio | Persistencia descrita | Acceso local descrito | Responsabilidad |
|---|---|---|---|
| Catalog | MongoDB 8 | 3000 | Ficha, búsqueda, importación y estado editorial |
| Users | PostgreSQL 17 + Drizzle | 3001 | Identidad, refresh rotatorio, Mi Lista y preferencias |
| Playback | MongoDB 8 con replica set + MinIO | 3002; objetos 9000 | Assets MP4, sesiones y progreso consolidado |
| Recommendation | No documentado como implementado | NV | Futuro consumidor de señales |
| Payment | Fuera de MVP | NV | Sin contrato recibido |

Users es **SQL** según S1; no se aplica una suposición anterior de usuarios en MongoDB. Los identificadores públicos son `usr_`, `ttl_`, `ast_` y `ses_` + UUID; no usar `_id` ni PK internas.

| Funcionalidad UI | API necesaria documentada | Servicio | Existe | Pendiente |
|---|---|---|---|---|
| Registro/login | POST auth/register, auth/login | Users | D | DTO, errores, cookies reales |
| Refresh/logout | POST auth/refresh, auth/logout | Users | D | Nombre/path cookie, CSRF y rotación |
| Perfil/clave | GET/PATCH users/me; POST change-password | Users | D | DTO y efectos de revocación |
| Explorar/buscar | GET catalog con q/type/status/genre/year | Catalog | D | Valores enum, paginación y orden |
| Detalle | GET catalog/{tituloId} | Catalog | D | Campos opcionales y estados visibles |
| Mi Lista | GET/POST/DELETE users/me/watchlist | Users | D | Componer referencias con fichas |
| LIKE/DISLIKE | GET/PUT/DELETE users/me/preferences | Users | D | Leer estado por título sin descargar todo |
| Upload MP4 | POST media/assets, ADMIN | Playback | D | Campo multipart y respuesta exacta |
| Sesión y URL | POST playback/sessions | Playback | D | Forma de progreso/URL y vencimiento |
| Pausa/reanudar | POST sessions/{id}/pause y resume | Playback | D | Concurrencia, posición y errores |
| Guardar avance | PATCH sessions/{id}/progress | Playback | D | Límites, orden y tolerancia |
| Renovar/completar | POST refresh-url y complete | Playback | D | Caducidad y semántica exacta |
| Retomar/historial | GET playback/me/continue-watching y history | Playback | D | Persistencia tras logout y paginación |
| Crear título nuevo con asset | POST catalog/bulk | Catalog | D | DTO y llave importKey |
| Asociar asset a título existente | No hay operación según S1 §6 | Catalog | No según S1 | G01 |
| Publicar/retirar | PATCH catalog/{id}/publication-status | Catalog | D | Autorización server-side ausente según S1 |
| Episodios | Colección preparada; sin API según S1 | Catalog/Playback | No según S1 | G03 |
| Recomendaciones | Sin API documentada | Recommendation | Futuro | G04 |
| Popularidad/novedades ordenadas | Orden no especificado en contrato recibido | Catalog | NV | G07; no usar etiquetas engañosas |

Todas las rutas abreviadas de esta tabla llevan `/api/v1/`; las rutas completas están en 09.

## Hallazgos que condicionan UX

1. Películas necesitan duración y playbackReference; series llevan playbackReference=null. No mostrar «Reproducir serie» sin episodios.
2. Catalog PATCH solo toca ficha editorial. No puede resolver la asociación posterior del asset.
3. Estados: REGISTRADO → PUBLICADO → RETIRADO. No hay despublicación reversible documentada; retirar requiere confirmación clara.
4. Mi Lista/preferencias son referencias sin FK distribuida. No eliminar referencias por una caída temporal de Catalog.
5. Playback reemplaza sesiones previas del mismo usuario/título. El player anterior debe detener escrituras si fue sustituido.
6. Continuar viendo excluye finalizados y progreso >=90 % según S1; no reinterpretar el umbral en frontend.
7. JWT RS256, TTL access 900 s y refresh HttpOnly/SameSite Strict descritos. Falta contrato exacto de CSRF.
8. Outbox existe pero sin publicador: no implica recomendaciones funcionando.
9. MP4 H.264/AAC y límite upload de 256 MiB son valores documentados por defecto, deben confirmarse con configuración.
10. Compose separados: no afirmar arranque con un único comando raíz. Playback depende de Catalog, JWKS, replica set y object storage.

## Checklist para convertir D en V

Registrar rama/SHA y leer README raíz/servicios, AGENTS, package manifests, lockfiles, Compose, `.env.example` (sin secretos), routers/controladores, validadores, modelos y YAML completos. Comparar rutas implementadas con OpenAPI. Confirmar CORS, cookie, CSRF, JWT/role, publicationStatus, referencias y paginación. Levantar sin borrar volúmenes y ejecutar flujos con cuentas de prueba. Guardar evidencia redactada con fecha, operación y resultado; nunca JWT ni URLs firmadas. Cada fila cambia de D a V por operación, no por una revisión global.
