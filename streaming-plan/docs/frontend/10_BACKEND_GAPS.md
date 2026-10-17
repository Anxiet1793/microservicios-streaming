# Brechas backend y puertas de integración

**Alcance:** confirmado por documentación S1 ≠ confirmado por código. No se modifica backend en esta entrega. Las formas de contrato nuevas son **P, propuestas** y nunca deben confundirse con la matriz de APIs documentadas.

| ID | Hallazgo / certeza | Necesidad UI | Prioridad | Responsable | Propuesta y aceptación |
|---|---|---|---|---|---|
| G00 | Repositorio/YAML no accesibles; observado | Integración tipada fiel | P0 | Equipo | Entregar repo/rama/Compose/OpenAPI; registrar SHA y comparar cada operación |
| G01 | S1: PATCH editorial no cambia playbackReference | Asociar/reemplazar video de título existente | P1; P0 si demo exige reemplazo | Catalog con validación Playback | Proponer operación ADMIN PATCH `/api/v1/catalog/{tituloId}/playback-reference` con assetId y versión esperada; verificar READY y concurrencia; esquema final por backend |
| G02 | CSRF/cookie exactos no recibidos | BFF auth/refresh fiable | P0 | Users + frontend | Documentar protocolo real y ejemplo redactado; prueba de rotación concurrente/logout sin desactivar CSRF |
| G03 | S1: colección episodios sin API | Reproducir series | P3 | Catalog/Playback | Proponer listar episodios publicados por serie y sesión por episodeId; contrato nuevo versionado; no convertir episodeId en tituloId |
| G04 | Sin contrato Recommendations; outbox sin worker según S1 | Carriles personalizados | P3 | Recommendation/Playback | Definir consulta y reason, pipeline e idempotencia de consumo; demo solo cuando haya resultados reales |
| G05 | DTO sesión/progreso/expiración no recibido | Retomar y renovar URL | P0 | Playback | Verificar response de P01/P04/P06 con posición autoritativa y vencimiento; extender solo si faltan |
| G06 | No batch o consulta por título en APIs recibidas | Componer listas y estado rápido | P2; P1 con listas grandes | Catalog/Users | Proponer batch acotado de IDs y lectura de preferencia/guardado por título; preservar orden y estados ausentes |
| G07 | Orden temporal/popularidad no especificados | Etiquetas honestas de Home | P2 | Catalog/Analytics | Primero verificar sort real; no llamar «recientes/populares» a orden arbitrario. Popularidad requiere métrica/pipeline |
| G08 | S1: Catalog sin autenticación | Escritura admin protegida | P0 antes de acceso externo | Catalog/infra | Autorizar ADMIN en servicio; mínimo MVP: solo red privada y BFF que valida rol por operación, sin acceso directo que lo eluda |
| G09 | Host firmado/Range/CORS no probado | Video visible desde browser demo | P0 | Playback/infra | Probar URL firmada accesible y seek 206; origen externo de firma correcto, sin editar URL después |
| G10 | No diccionarios/códigos exactos recibidos | Filtros y formularios admin válidos | P1 | Catalog | Leer enums reales y fijarlos con versión o exponer referencias; no adivinar IDs |
| G11 | Upload no lista assets ni upload reanudable según APIs recibidas | Recuperar transferencia/admin | P2 | Playback | Retener assetId confirmado; futura consulta de assets o idempotencia documentada. No auto-retry tras timeout |
| G12 | Cambio de clave revoca sesiones; invalidación interservicio no verificada | Logout/rol/clave coherentes | P1 | Users/Playback | Probar JWT emitido antes/después y qué valida Playback además de firma/TTL; definir ventana de revocación explícita |

## Contrato propuesto G01, sin afirmar existencia

Entrada conceptual: assetId público, manifestKey solo si arquitectura lo exige y `expectedVersion` o If-Match según estándar elegido. Respuesta conceptual: nueva referencia y versión de título. Errores conceptuales: no autorizado, título ausente, asset no READY, conflicto de versión. Status/payload definitivos pertenecen al nuevo OpenAPI, no se fijan por intuición frontend. Auditoría de actor y fecha en servicio. No permitir sustituir asset sin política de sesiones activas.

## Alternativa disponible documentada para G01

Para video de exposición: P10 carga → C03 importa **título nuevo** con importKey y playbackReference → C05 publica → P01 reproduce. No reusar importKey de otro contenido para forzar update: S1 describe fingerprint/idempotencia y no upsert general.

## Qué se puede planear o construir sin resolver todo

Marca, tokens, shell, componentes accesibles y layouts pueden desarrollarse con fixtures etiquetadas al iniciar implementación autorizada. Integración P0 espera G00/G02/G05/G09. No bloquear todo por recomendaciones o episodios. No presentar mocks como backend real en la exposición.
