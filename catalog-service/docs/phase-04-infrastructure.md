# Fase 4 — Infrastructure y Repository

Estado: implementada y verificada el 19 de septiembre de 2026. La fase 5 no ha comenzado.
Este estado corresponde al cierre de la fase 4. La entrega posterior se registra en [fase 5](phase-05-application.md).

## Alcance entregado

- Proyecto TypeScript con dependencias fijadas y `package-lock.json`.
- Configuración validada con Zod, carga diferida y `.env.example` sin credenciales.
- MongoClient con pool reutilizable y promesa compartida por proceso, compatible con recarga de módulos. Un fallo inicial libera la conexión y permite reintentar; no se cierra por request.
- Puerto `CatalogRepository` sin tipos del driver y adaptación `MongoCatalogRepository`.
- Consulta por identidad, listado paginado con filtros y proyección, carga masiva y persistencia de cambios por versión.
- Mapeadores que convierten categorías numéricas a BSON Int32 y reconstruyen el agregado. Los nombres siguen derivados de `models.ts`; no se duplican en documentos.
- Validadores JSON Schema para títulos y episodios; siete índices propios de títulos y dos de episodios.
- Inicializador repetible que informa conflictos sin borrar datos ni reemplazar índices silenciosamente.
- Composición diferida en `src/bootstrap/catalog-container.ts`.

Las fases anteriores definieron el dominio como diseño. Para implementar el puerto y los mapeadores se materializaron los elementos necesarios: `TituloCatalogo`, `TituloId`, `FichaContenido`, `EstadoPublicacion`, `ReferenciaReproduccion`, errores y límites. El dominio no importa MongoDB, Next.js ni Zod.

No se implementaron casos de uso, rutas HTTP, Dockerfile, Compose ni documentación OpenAPI. El uso de Docker en esta fase es exclusivamente para verificar MongoDB en un contenedor temporal. No existe todavía una aplicación HTTP que ejecutar o compilar con Next.js.

`catalog_episodes` tiene esquema e índices inicializables. La creación/publicación de episodios y sus reglas entre agregados siguen fuera de los endpoints iniciales; por ello no se ha incorporado un repositorio de episodios ni una transacción de publicación. La validación de MongoDB no constituye una clave foránea para `seriesId`.

## Comportamiento del repositorio

`insertMany` recibe títulos ya validados, índices originales y claves de importación. Agrupa claves repetidas, rechaza grupos contradictorios y ejecuta un `bulkWrite` unordered de los candidatos válidos. Reconciliar duplicados utiliza una consulta por conjunto de claves; no se ejecutan inserciones individuales ni peticiones HTTP internas.

Cada resultado contiene el índice original y uno de estos estados:

| Estado | Significado |
| --- | --- |
| `inserted` | Inserción confirmada; incluye TituloId. |
| `duplicate` | Misma clave y contenido inicial; incluye el TituloId existente. |
| `rejected` | Conflicto conocido, documento demasiado grande u otro error individual confirmado. |
| `indeterminate` | No se puede confirmar el resultado; debe reintentarse con las mismas claves. |

El agregado normaliza espacios, ordena géneros/idiomas y representa reparto ausente como lista vacía. La huella de importación ignora identidad generada, fechas y estado. Editar el título no cambia esa huella original.

`saveChanges` compara dos estados válidos del mismo agregado y solo emite cambios explícitos en la ficha y el estado. Usa `$set`, `$unset` y `$inc` con versión/estado esperados. Las identidades, tipo, referencia técnica y fecha de creación permanecen inmutables. Una operación sin cambios no escribe. La excepción de conflicto se distingue de título inexistente.

El presupuesto máximo de documento es 100 KiB. En actualizaciones se reserva conservadoramente el máximo espacio UTF-8 de la clave de importación para comprobarlo sin una lectura adicional. Esto puede rechazar un documento muy próximo al límite aunque su clave real sea más corta.

El filtro HTTP se implementará después. El repositorio ya permite únicamente filtros escalares conocidos, limita paginación y convierte `q` a palabras para que comillas/guiones externos no activen operadores de búsqueda textual.

`promoteValues: false` se aplica solo a lecturas de documentos. Aplicarlo a toda la colección también envolvería los códigos de error del driver en Int32 e impediría interpretar correctamente un error de duplicado; la comprobación contra MongoDB detectó y permitió corregir ese caso.

## Archivos de entrada

| Archivo | Responsabilidad |
| --- | --- |
| `src/modules/catalog/domain/models.ts` | Equivalencias numéricas comentadas. |
| `src/modules/catalog/domain/repositories/catalog-repository.ts` | Contrato de persistencia. |
| `src/modules/catalog/infrastructure/persistence/mongodb/repositories/mongo-catalog-repository.ts` | Implementación MongoDB. |
| `src/shared/infrastructure/mongodb/connection.ts` | Pool, conexión compartida y ping. |
| `src/shared/infrastructure/config/environment.ts` | Configuración validada. |
| `scripts/init-mongo.ts` | Creación de colecciones, validadores e índices. |
| `scripts/verify-phase4.ts` | Verificación reproducible contra MongoDB temporal. |

## Comandos

Desde `catalog-service`, usando Node.js 24:

```powershell
npm ci
npm run typecheck
```

Para inicializar una base local o Atlas elegida por el usuario:

```powershell
Copy-Item .env.example .env
# Configurar MONGODB_URI y MONGODB_DATABASE en .env.
npm run db:init
```

El inicializador usa su propio cliente y lo cierra al terminar. Se debe ejecutar antes de utilizar el repositorio contra una base nueva. Necesita permisos para crear colecciones, índices y aplicar `collMod`. Los mensajes JSON contienen solo evento, código seguro y, en errores de inicialización, colección y motivo; nunca URI ni documentos.

Un cambio incompatible de esquema o índice necesita migración deliberada. Actualizar un validador no inspecciona retroactivamente todos los documentos existentes.

Para reproducir la verificación de esta fase, con Docker disponible:

```powershell
npm run verify:phase4
```

Este comando crea un contenedor `mongo:8.0` con nombre aleatorio, puerto de loopback y sin volúmenes. No carga `.env` ni utiliza una base indicada por `MONGODB_URI`; configura su propia conexión temporal. El contenedor se detiene y elimina al finalizar. La imagen descargada puede permanecer en la caché local de Docker.

## Verificación ejecutada

`npm run typecheck`: correcto.

`npm run verify:phase4`: 15 grupos de comprobaciones correctos contra MongoDB real:

1. Inicialización repetida, ejecución del script CLI y recuento de índices.
2. Diagnóstico de índice incompatible sin reconstrucción destructiva.
3. Configuración sin filtrado de secretos y conexión compartida.
4. Serialización BSON Int32 y reconstrucción del agregado.
5. Inserción de películas/series y consulta por identidad.
6. Idempotencia canónica y conflicto de importación.
7. Claves equivalentes y contradictorias dentro del mismo lote.
8. Carrera entre importaciones y éxito parcial de bulk unordered.
9. Filtros, búsqueda textual, proyecciones y límites de consulta.
10. PATCH parcial, eliminación de opcionales y conflicto concurrente.
11. Publicación, transición inválida, no-op e inexistencia.
12. Rechazo de documentos inválidos mediante JSON Schema.
13. Validación y unicidad de posición de episodios.
14. Consulta con `explain("executionStats")`.
15. Desconexión y resultado indeterminado.

La consulta por estado y tipo devolvió 3 documentos y examinó 3 claves y 3 documentos. Es una comprobación funcional con datos pequeños, no una medición representativa de rendimiento.

Imagen utilizada en esta ejecución: `mongo:8.0`, digest `sha256:4968f22d0c6c10ef29952f3e807f62872ba22b3312f25803564fbfc08255efc2`.

La suite formal de pruebas de la fase 8, lint y build de Next.js siguen pendientes de sus fases. No se han creado colecciones en una base permanente ni se ha probado Atlas.

## Referencias consultadas

- [Operaciones masivas del driver oficial](https://www.mongodb.com/docs/drivers/node/current/crud/bulk-write/).
- [Pool de conexiones del driver](https://www.mongodb.com/docs/drivers/node/current/connect/connection-options/connection-pools/).
- [Validación con JSON Schema](https://www.mongodb.com/docs/manual/reference/operator/query/jsonschema/).
