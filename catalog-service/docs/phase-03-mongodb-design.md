# Fase 3 — Diseño de persistencia MongoDB

Estado: diseño; no se han creado colecciones, índices, repositorios ni conexiones.
Este estado corresponde al cierre de la fase 3. La implementación y sus verificaciones posteriores se registran en [fase 4](phase-04-infrastructure.md).
Base de datos prevista: `catalog_service`, propiedad exclusiva de Catálogo.
Este documento concreta la fase 3. La implementación corresponde a las fases posteriores.

Revisión solicitada: categorías con IDs numéricos estables. Las equivalencias comentadas están en [`models.ts`](../src/modules/catalog/domain/models.ts). Se ha creado ese archivo declarativo; la infraestructura sigue pendiente.

## 1. Colecciones y fronteras

| Colección          | Unidad del documento     | Motivo                                                                                  |
| ------------------ | ------------------------ | --------------------------------------------------------------------------------------- |
| `catalog_titles`   | Una película o una serie | Comparten identidad, ficha, publicación y consultas del catálogo.                       |
| `catalog_episodes` | Un episodio              | Tiene identidad y publicación propias; su cantidad no aumenta el documento de la serie. |

`FichaContenido`, `EstadoPublicacion` y `ReferenciaReproduccion` se almacenan dentro del documento de su agregado. No se crean colecciones para estos valores. La temporada se representa mediante `seasonNumber`; no tiene todavía ficha ni ciclo editorial independientes.

Los dos agregados pertenecen al mismo contexto y servicio. Referenciar una serie por su identidad no implica compartir bases de datos entre microservicios ni exige reproducir un modelo relacional.

Los endpoints iniciales operan sobre títulos. Se define también el almacenamiento de episodios, sin añadir endpoints ni casos de uso de episodios en esta fase.

## 2. Documento de película

Ejemplo conceptual BSON; los constructores no son JSON de una petición HTTP:

```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  schemaVersion: 1,
  tituloId: "ttl_550e8400-e29b-41d4-a716-446655440000",
  importKey: "demo:movie:orbita-de-papel",
  importFingerprint: "<sha256-hex-del-contenido-normalizado-inicial>",
  typeId: NumberInt(1), // MOVIE
  ficha: {
    title: "Órbita de papel",
    synopsis: "Una expedición encuentra un archivo que transforma su misión.",
    releaseYear: 2025,
    durationMinutes: 108,
    genres: [NumberInt(1), NumberInt(2)], // SCIENCE_FICTION, DRAMA
    languages: [NumberInt(1)], // es
    ageRatingId: NumberInt(4), // PG-13
    cast: []
  },
  publicationStatusId: NumberInt(1), // REGISTRADO
  playbackReference: {
    providerId: NumberInt(1), // CDN
    assetId: "orbita-de-papel",
    manifestKey: "movies/orbita-de-papel/master.m3u8"
  },
  createdAt: ISODate("2026-09-19T12:00:00.000Z"),
  updatedAt: ISODate("2026-09-19T12:00:00.000Z"),
  version: NumberInt(1)
}
```

El `TituloId` conserva la decisión de la fase 2: prefijo `ttl_` y UUID v4. `_id` no aparece en contratos HTTP. Fechas en BSON Date UTC, números enteros para año y versión; nunca fechas persistidas como texto.

`schemaVersion` identifica la estructura persistida. `version` controla concurrencia: son conceptos diferentes. Los metadatos de importación pertenecen a la persistencia/aplicación y no se añaden a la ficha editorial ni a las respuestas públicas de detalle.

## 3. Series y episodios

Una serie usa la misma envoltura que una película, con estas diferencias:

```javascript
{
  typeId: NumberInt(2), // SERIES
  ficha: {
    title: "Bitácoras del mañana",
    synopsis: "Historias de una estación de investigación.",
    releaseYear: 2026,
    genres: [NumberInt(1)], // SCIENCE_FICTION
    languages: [NumberInt(1)], // es
    cast: []
  },
  playbackReference: null
}
```

El fragmento anterior no es un documento completo. Conserva los identificadores, metadatos, fechas, versión y estado del esquema común. No incluye `durationMinutes`, arrays de episodios, arrays de identificadores de episodios ni contadores duplicados.

Documento completo conceptual de episodio:

```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439012"),
  schemaVersion: 1,
  episodeId: "ep_6ba7b810-9dad-41d1-80b4-00c04fd430c8",
  seriesId: "ttl_6ba7b811-9dad-41d1-80b4-00c04fd430c8",
  seasonNumber: NumberInt(1),
  episodeNumber: NumberInt(1),
  ficha: {
    title: "La primera señal",
    synopsis: "La estación recibe un mensaje inesperado.",
    durationMinutes: 42
  },
  playbackReference: {
    providerId: NumberInt(1), // CDN
    assetId: "bitacoras-s01e01",
    manifestKey: "series/bitacoras/s01/e01/master.m3u8"
  },
  publicationStatusId: NumberInt(1), // REGISTRADO
  createdAt: ISODate("2026-09-19T12:00:00.000Z"),
  updatedAt: ISODate("2026-09-19T12:00:00.000Z"),
  version: NumberInt(1)
}
```

No se duplica el nombre ni el estado de la serie en cada episodio. Retirar una serie no requiere actualizar todos sus episodios. La disponibilidad editorial de un episodio depende de que ambos estén publicados.

MongoDB limita el tamaño de un documento BSON a 16 MiB. Separar episodios evita crecimiento proporcional al total de episodios, pero también se acotan las listas y textos de cada ficha. Véase [límites de MongoDB](https://www.mongodb.com/docs/manual/reference/limits/).

## 4. Consultas e índices

Orden estable para el listado inicial: `{ updatedAt: -1, tituloId: 1 }`. El segundo campo desempata fechas iguales. Este orden es determinista para los datos consultados, pero no congela el catálogo entre peticiones.

Índices propuestos para `catalog_titles`, además del índice automático de `_id`:

| Nombre                                  | Claves                                                              | Opciones                   | Consulta o garantía                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `uq_catalog_titles_titulo_id`           | `{ tituloId: 1 }`                                                   | `unique: true`             | Detalle y actualizaciones por identidad.                                                             |
| `uq_catalog_titles_import_key`          | `{ importKey: 1 }`                                                  | `unique: true`             | Impedir registros repetidos de una misma clave de importación.                                       |
| `ix_catalog_titles_updated`             | `{ updatedAt: -1, tituloId: 1 }`                                    | —                          | Listado general ordenado.                                                                            |
| `ix_catalog_titles_status_type_updated` | `{ publicationStatusId: 1, typeId: 1, updatedAt: -1, tituloId: 1 }` | —                          | Listado por estado y tipo, por ejemplo películas publicadas (`publicationStatusId: 2`, `typeId: 1`). |
| `ix_catalog_titles_year`                | `{ "ficha.releaseYear": 1 }`                                        | —                          | Filtro por año.                                                                                      |
| `ix_catalog_titles_genre`               | `{ "ficha.genres": 1 }`                                             | —                          | Filtro por pertenencia a un género.                                                                  |
| `tx_catalog_titles_title`               | `{ "ficha.title": "text", "ficha.originalTitle": "text" }`          | `default_language: "none"` | Búsqueda por palabras en títulos sin depender de Atlas Search.                                       |

No se promete que todos los filtros y ordenaciones se resuelvan exclusivamente desde índices. Año y género pueden requerir ordenación adicional. Un filtro solo por tipo no aprovecha el prefijo del índice estado/tipo; se evaluará con datos representativos antes de añadir otro índice. Tampoco se presupone intersección de índices.

El índice compuesto propuesto para estado y tipo no proporciona necesariamente el orden completo cuando se omite tipo. Se medirá esa variante con `explain("executionStats")` durante la implementación/integración. No se crean índices para cada combinación posible.

Géneros produce un índice multikey. No se combinará en un mismo índice compuesto con otro array como idiomas. Véanse las [restricciones multikey](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/).

`q` realizará búsqueda de palabras mediante `$text`, no búsqueda arbitraria por subcadenas ni autocompletado. La capa HTTP limitará y normalizará la entrada; no expondrá objetos de consulta del cliente. Se conserva el orden por actualización, con posible ordenación adicional: un índice de texto no acelera esa ordenación. Véanse las [restricciones de índices de texto](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/text-index-restrictions/).

Índices propuestos para `catalog_episodes`, además de `_id`:

| Nombre                           | Claves                                               | Opciones       | Consulta o garantía                                                   |
| -------------------------------- | ---------------------------------------------------- | -------------- | --------------------------------------------------------------------- |
| `uq_catalog_episodes_episode_id` | `{ episodeId: 1 }`                                   | `unique: true` | Identidad estable de episodio.                                        |
| `uq_catalog_episodes_position`   | `{ seriesId: 1, seasonNumber: 1, episodeNumber: 1 }` | `unique: true` | Evitar posiciones duplicadas y listar una serie o temporada en orden. |

No hace falta otro índice únicamente sobre `seriesId`: ya es el prefijo del índice de posición. Las consultas que motivan estos índices quedan diseñadas para la extensión de episodios, no implementadas como endpoints nuevos.

## 5. Duplicados e idempotencia de carga

Decisión: INSERT con `collection.bulkWrite(operaciones, { ordered: false })`; sin UPSERT. Una importación repetida no debe sobrescribir una ficha corregida ni cambiar su publicación.

Se añade `importKey` obligatoria al DTO de cada elemento. Ejemplo: `demo:movie:orbita-de-papel`. Es una cadena opaca, inmutable, sensible a mayúsculas, sin espacios exteriores, de 1 a 160 caracteres; el origen debe conservarla en los reintentos. El prefijo de origen es una convención de quien importa, no una autorización. Esto amplía el JSON conceptual del prompt; los ejemplos y OpenAPI posteriores deberán incluirla.

No se impone unicidad por título/año ni por `assetId`: podrían existir obras distintas con esos mismos datos. Tampoco se asegura detectar que dos claves de importación distintas describen la misma obra.

Se persiste un SHA-256 de la representación canónica del contenido inicial validado: `typeId`, ficha con categorías numéricas y referencia técnica con `providerId`. Se ordenan claves de objetos, se normalizan opcionales ausentes/nulos según contrato y se ordenan numéricamente conjuntos como géneros e idiomas; se conserva el orden de listas significativas como reparto. Se excluyen nombres derivados, ID generado, fechas, estado, versión y clave de importación. El fingerprint original no se recalcula al editar la ficha.

- Clave nueva y contenido válido: insertado, con `TituloId` generado por el servidor.
- Misma clave y mismo fingerprint: duplicado; devolver el `TituloId` ya existente.
- Misma clave y diferente fingerprint: rechazado con `IMPORT_KEY_CONFLICT`; no sobrescribir.
- Mismo lote con claves repetidas: conservar índices de entrada; si los contenidos son iguales, procesar un candidato y mapear duplicados solo si existe una inserción confirmada o registro previo. Si difieren, rechazar todo el grupo de esa clave.

Se puede consultar el conjunto de claves con `$in` antes de escribir. El índice UNIQUE es la garantía final frente a carreras. Tras errores de clave duplicada se reconcilian en conjunto los registros correspondientes; no se hacen N consultas ni N peticiones HTTP.

Un conflicto en `tituloId` no debe clasificarse automáticamente como duplicado de importación: se debe identificar la restricción afectada. Los resultados mantienen el índice original del elemento.

`ordered: false` permite continuar ante errores individuales; no convierte el lote en una transacción. Véase [bulk operations del driver oficial](https://www.mongodb.com/docs/drivers/node/current/crud/bulk-write/).

Las caídas de conexión o errores de confirmación pueden dejar resultados indeterminados. No se marcarán como fallidos todos los elementos sin evidencia ni se afirmará que no hubo escrituras. La respuesta operativa indicará resultado indeterminado y permitirá reintentar con las mismas claves.

## 6. Atomicidad, PATCH y concurrencia

Cada agregado se actualiza en un documento. Tras recuperar la entidad y validar el cambio en dominio, el repositorio ejecutará conceptualmente:

```javascript
collection.updateOne(
  { tituloId, version: expectedVersion },
  {
    $set: { "ficha.title": nuevoTitulo, updatedAt: ahora },
    $inc: { version: 1 },
  },
);
```

Los paths se construyen desde una lista permitida, nunca desde operadores recibidos del cliente. Para limpiar campos opcionales se usa `$unset`. Se validará la ficha resultante completa antes de persistir. No se reemplaza el documento entero.

Las transiciones incluirán también `publicationStatusId` esperado en el filtro. La secuencia válida es `1 (REGISTRADO) -> 2 (PUBLICADO) -> 3 (RETIRADO)`; se validan transiciones explícitas, no operaciones aritméticas sobre IDs. Si no coincide ningún documento, se distinguirá inexistencia de conflicto concurrente; este último se mapeará a `409 CONCURRENT_MODIFICATION`. Un PATCH sin cambio efectivo no actualiza fecha ni versión. Esta protección cubre la carrera entre lectura y escritura del caso de uso; no detecta por sí sola una edición basada en una pantalla antigua sin un contrato adicional de versión del cliente.

Esta estrategia utiliza la atomicidad de escritura por documento y filtros de valores esperados documentados por MongoDB: [atomicidad y transacciones](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/).

No hay borrado físico ni cambio de tipo en los casos de uso iniciales. Al incorporar creación de episodios, aplicación comprobará que `seriesId` existe y es `SERIES`; al conservar identidad y tipo, la relación no puede quedar huérfana por las operaciones admitidas. MongoDB no crea una clave foránea por guardar este campo.

Para garantizar estrictamente que un episodio se publique mientras su serie siga publicada, la futura operación necesitará una transacción que escriba condicionalmente la serie (incrementando su versión) e inserte/actualice el episodio. Una mera lectura de la serie dentro de una transacción no basta para evitar la carrera con un retiro. Esa extensión requerirá replica set y se probará entonces. Los endpoints iniciales de títulos no requieren transacciones multidocumento.

La disponibilidad consultada no equivale a autorización perpetua para reproducir: el estado puede cambiar después de responder.

## 7. Validación y límites

Capas complementarias: Zod valida entrada HTTP, dominio valida invariantes, MongoDB valida la estructura persistida. Se prevé `$jsonSchema`, `validationLevel: "strict"` y `validationAction: "error"`. Véase [validación de esquemas](https://www.mongodb.com/docs/manual/core/schema-validation/).

El esquema tendrá campos explícitos, `additionalProperties: false` incluyendo `_id`, identificadores con patrón, fechas BSON y versión entera positiva. Todas las categorías usarán `bsonType: "int"` y `enum` obtenido de las claves de su diccionario en `models.ts`; los arrays de géneros e idiomas tendrán elementos enteros admitidos y `uniqueItems: true`. La infraestructura convertirá explícitamente los IDs a BSON Int32; dominio y HTTP utilizarán números ordinarios. Las variantes se discriminan mediante `typeId`: `1` requiere duración y referencia; `2` excluye duración y requiere referencia nula. Episodios requieren numeración positiva y referencia técnica. El validador no permitirá campos de nombres derivados en documentos persistidos.

La validación de base de datos no sustituye transiciones del dominio, inmutabilidad de campos, comprobación de relaciones ni control de concurrencia.

Límites iniciales del contrato que se implementará:

| Elemento                            | Límite                                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| Lote                                | 1 a 500 elementos por defecto, configurable con techo operativo de 1000                   |
| Body HTTP                           | 5 MiB por defecto, configurable con techo operativo de 10 MiB; contar bytes reales leídos |
| Documento serializado               | 100 KiB como presupuesto de aplicación                                                    |
| Título / título original / director | 300 caracteres por campo                                                                  |
| Sinopsis                            | 10 000 caracteres                                                                         |
| Géneros / idiomas                   | Hasta 20 IDs distintos por lista, todos presentes en su diccionario                       |
| Reparto                             | 100 nombres, 200 caracteres cada uno                                                      |
| Clasificación por edad              | `ageRatingId` opcional, entero presente en el diccionario                                 |
| URL de imagen / manifestKey         | 2048 caracteres                                                                           |
| Provider / assetId                  | `providerId` entero admitido / `assetId` de hasta 256 caracteres                          |
| Año                                 | Entero de 1888 a 9999                                                                     |
| Duración                            | Entero de 1 a 100 000 minutos                                                             |
| Página / tamaño                     | Página positiva; tamaño por defecto 20, máximo 100                                        |
| Offset                              | Máximo 10 000 registros, rechazar solicitudes que lo excedan                              |
| Búsqueda q                          | 100 caracteres                                                                            |

JSON malformado, envoltura inválida, lote vacío/excesivo o body excesivo rechazan la petición completa sin escrituras. Se validan todos los elementos antes de persistir; elementos individuales inválidos se reportan como rechazados, permitiendo procesar los válidos. Ningún elemento omite la validación.

## 8. Proyecciones y paginación

El listado leerá una proyección explícita: `tituloId`, `typeId`, `publicationStatusId`, `ficha.title`, `ficha.releaseYear`, `ficha.genres`, `ficha.posterUrl` cuando exista y `updatedAt`. El presenter agregará `typeName`, `publicationStatusName` y `ficha.genresName` consultando los diccionarios en memoria. No incluirá sinopsis, reparto, referencia técnica ni metadatos internos.

El detalle permitirá la ficha completa y `playbackReference`, siempre mediante un mapper/presenter que excluya `_id`, `importKey`, fingerprint y versiones internas.

Se usará paginación page/limit con `skip`, `limit` y conteo filtrado. El límite de offset evita recorrer páginas arbitrariamente profundas. Una futura paginación por cursor requerirá una extensión explícita del contrato.

Conteo y página serán lecturas separadas: bajo escrituras concurrentes puede variar el total respecto de los elementos obtenidos. No se promete una instantánea consistente entre páginas. No se agrega una transacción solo para el listado inicial.

## 9. Inicialización que se implementará en fase 4

`scripts/init-mongo.ts` deberá:

1. Conectar usando configuración externa, sin registrar credenciales.
2. Crear las dos colecciones con sus validadores si no existen.
3. Aplicar el validador definido mediante `collMod` cuando corresponda; una modificación incompatible necesitará migración explícita.
4. Crear los índices con nombres, claves y opciones estables.
5. Fallar con diagnóstico si existen índices incompatibles o datos duplicados; no borrar datos ni reconstruir índices silenciosamente.
6. Cerrar la conexión de este script. La conexión reutilizable de la aplicación tendrá otro ciclo de vida.

Repetir la misma inicialización no debe cambiar datos ni fallar por recursos ya existentes. Actualizar un validador no valida retroactivamente todos los documentos; las migraciones deberán inspeccionar datos existentes.

## 10. Estado de verificación

Se consultó documentación oficial para las capacidades descritas. No se ha conectado a MongoDB, ejecutado `explain`, creado índices ni probado repositorios. El rendimiento de las consultas y la idempotencia del script se verificarán cuando exista la implementación. La fase 4 permanece pendiente de indicación del usuario.

## 11. Equivalencias numéricas y contrato revisado

Se codifican categorías discretas: tipo, estado, género, idioma, clasificación por edad y proveedor. Títulos, sinopsis, URLs, claves técnicas e identidades UUID conservan su representación: no son categorías enumeradas. No se crean colecciones de equivalencias ni joins para traducir estos vocabularios pequeños y controlados.

La fuente única de equivalencias es `src/modules/catalog/domain/models.ts`, con IDs explícitos y comentarios. Los diccionarios de géneros, idiomas y clasificaciones definen el vocabulario inicial admitido; no pretenden cubrir todos los valores posibles. Ampliarlos requiere IDs nuevos y actualización coordinada de validadores y contratos. La clasificación por edad conserva el vocabulario editorial indicado en el archivo; no se considera universal entre países.

| Campo persistido               | Equivalencia inicial                            | Campo derivado de salida         |
| ------------------------------ | ----------------------------------------------- | -------------------------------- |
| `typeId`                       | 1 = MOVIE, 2 = SERIES                           | `typeName`                       |
| `publicationStatusId`          | 1 = REGISTRADO, 2 = PUBLICADO, 3 = RETIRADO     | `publicationStatusName`          |
| `ficha.genres`                 | 1 = SCIENCE_FICTION, 2 = DRAMA; resto en models | `ficha.genresName`               |
| `ficha.languages`              | 1 = es, 2 = en; resto en models                 | `ficha.languagesName`            |
| `ficha.ageRatingId`            | 4 = PG-13; resto en models                      | `ficha.ageRatingName`            |
| `playbackReference.providerId` | 1 = CDN                                         | `playbackReference.providerName` |

Se usa `typeId` con camelCase consistente. `publicationStatusId` sustituye el antiguo campo `publicationStatus`; `typeId` sustituye `type`. La nueva convención prevalece sobre ejemplos anteriores del prompt y de las fases 1 y 2. Como todavía no hay datos ni API desplegados, no hace falta migración ahora. Una base previamente poblada necesitaría una migración explícita antes de activar el nuevo esquema.

Ejemplo parcial de respuesta HTTP; IDs y nombres aparecen juntos como solicitó el usuario:

```json
{
  "typeId": 1,
  "typeName": "MOVIE",
  "publicationStatusId": 2,
  "publicationStatusName": "PUBLICADO",
  "ficha": {
    "genres": [1, 2],
    "genresName": ["SCIENCE_FICTION", "DRAMA"],
    "languages": [1, 2],
    "languagesName": ["es", "en"],
    "ageRatingId": 4,
    "ageRatingName": "PG-13"
  }
}
```

MongoDB guarda únicamente los IDs de categorías. Los nombres de salida se derivan por posición desde esos IDs para que nunca se desalineen los arrays ni se acepte una pareja contradictoria. No son campos editables. Un ID desconocido se rechaza; no se convierte silenciosamente a otra categoría ni se inventa una etiqueta. Los tipos TypeScript por sí solos no validan JSON externo.

La carga masiva recibirá `typeId`, géneros e idiomas numéricos y referencia con `providerId`; el servidor asignará `publicationStatusId: 1`. El PATCH editorial podrá cambiar `ficha.genres`, `ficha.languages` y `ficha.ageRatingId`, pero no `typeId` ni el estado. El PATCH de publicación recibirá `{ "publicationStatusId": 2 }`. Los filtros existentes conservarán sus nombres, con valores numéricos: `?type=1&status=2&genre=1`; se validarán antes de construir `{ typeId: 1, publicationStatusId: 2, "ficha.genres": 1 }`. Esta sintaxis es un contrato previsto, todavía sin endpoints implementados.

Los IDs son estables, no se renumeran ni se reutilizan. Recomendaciones podrá consumirlos mediante API o eventos documentados, sin importar el código interno del servicio ni leer MongoDB. Un ID de género no representa orden ni distancia: una futura recomendación podrá tratarlo como categoría, conjunto o característica codificada, nunca inferir similitud por la diferencia numérica entre IDs.

La codificación numérica uniformiza filtros y contratos. No garantiza por sí sola consultas más rápidas: se medirá con datos representativos, selectividad e índices mediante `explain("executionStats")`. MongoDB recomienda diseñar índices según las consultas: [índices para patrones de acceso](https://www.mongodb.com/docs/manual/data-modeling/schema-design-process/create-indexes/).
