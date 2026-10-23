# Fase 5 — Casos de uso

Estado: implementada y verificada. La fase 6 (endpoints HTTP) no ha comenzado.
Este estado corresponde al cierre de la fase 5. La entrega posterior se registra en [fase 6](phase-06-http.md).

## Casos de uso implementados

| Clase                     | Entrada                               | Resultado y responsabilidad                                                               |
| ------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `BulkCreateCatalogTitles` | `{ items: [...] }`                    | Valida el lote, crea agregados registrados y coordina una llamada de persistencia masiva. |
| `GetCatalogTitles`        | Filtros y paginación opcionales       | Devuelve DTO de listado con nombres derivados y paginación.                               |
| `GetCatalogTitleById`     | `{ tituloId }`                        | Devuelve detalle o `CATALOG_TITLE_NOT_FOUND`.                                             |
| `UpdateCatalogTitle`      | `{ tituloId, ficha: { ...cambios } }` | Aplica PATCH editorial mediante el agregado y guarda con versión esperada.                |
| `ChangePublicationStatus` | `{ tituloId, publicationStatusId }`   | Delega las transiciones al dominio y persiste un cambio efectivo.                         |

Los archivos están en `src/modules/catalog/application/use-cases/`. `load-catalog-title.ts` es un colaborador interno para búsqueda y error de inexistencia, no un sexto caso de uso.

## Separación de responsabilidades

Aplicación depende de `CatalogRepository`, `Clock` y `TitleIdGenerator`. No importa MongoClient, Next.js, Zod, variables de entorno ni implementaciones de infraestructura.

`SystemClock` y `UuidTitleIdGenerator` son adaptadores en infraestructura. Los casos de uso reciben estas dependencias por constructor. `composeCatalogUseCases` permite componerlos con dependencias controladas; `createCatalogUseCases` conecta las implementaciones reales usando la configuración y el pool de la fase 4. Importar el módulo de composición no abre conexiones.

La validación de filtros y límites se centralizó en `domain/repositories/catalog-query.ts`, junto al contrato del puerto. Aplicación la utiliza antes de llamar al repositorio y la infraestructura la conserva como defensa de su frontera. La traducción a operadores MongoDB sigue exclusivamente en infraestructura.

Los DTO de aplicación definen un contrato independiente de HTTP. Incluyen IDs numéricos y nombres derivados de `models.ts`. Fechas salen como cadenas ISO UTC. Los mapeadores enumeran campos permitidos y no exponen `_id`, versiones internas, claves de importación ni fingerprints.

El detalle incluye nombres de tipo, publicación, géneros, idiomas, clasificación por edad y proveedor cuando corresponde. Una serie devuelve `playbackReference: null`. El listado conserva su proyección reducida y no agrega la ficha completa ni referencias de reproducción.

## Carga masiva

- El límite recibido por configuración se verifica antes de procesar elementos; el techo sigue siendo 1000 y el valor predeterminado 500.
- Un lote vacío, excesivo o con envoltura desconocida rechaza la operación completa.
- Cada elemento se valida de forma independiente antes de cualquier escritura. Los errores de dominio y forma se reportan por índice original.
- Solo el servidor genera `TituloId`, fechas y estado inicial `1 = REGISTRADO`. Campos como `publicationStatusId`, `typeName` o `_id` en la entrada de creación se rechazan.
- Una serie puede omitir `playbackReference`; se normaliza a `null`. Una película necesita una referencia válida.
- Si todos los elementos son inválidos, no se llama al repositorio ni se generan IDs.
- Los elementos válidos llegan al repositorio en una sola llamada. La detección atómica de duplicados y reconciliación siguen en el adaptador implementado en fase 4.
- El resultado del repositorio debe contener exactamente una respuesta por índice enviado; una respuesta incompleta o con índices repetidos no se presenta como éxito.
- Errores técnicos del reloj o generador se propagan sin atribuirlos a datos del usuario y antes de escribir el lote.

Ejemplo de resumen para un lote parcial:

```json
{
  "success": false,
  "summary": {
    "received": 4,
    "inserted": 1,
    "duplicates": 1,
    "failed": 1,
    "indeterminate": 1
  },
  "results": [
    { "index": 0, "status": "inserted", "tituloId": "ttl_00000000-0000-4000-8000-000000000001" },
    { "index": 1, "status": "duplicate", "tituloId": "ttl_00000000-0000-4000-8000-000000000002" },
    { "index": 2, "status": "rejected", "code": "INVALID_CONTENT_SHEET" },
    { "index": 3, "status": "indeterminate", "code": "PERSISTENCE_OUTCOME_UNKNOWN" }
  ],
  "errors": [
    { "index": 2, "code": "INVALID_CONTENT_SHEET" },
    { "index": 3, "code": "PERSISTENCE_OUTCOME_UNKNOWN" }
  ]
}
```

Los índices son base cero. `received = inserted + duplicates + failed + indeterminate`. Los duplicados equivalentes no hacen fallar `success`; los rechazados o indeterminados sí. No se devuelven documentos completos en resultados de importación.

## Consultas y modificaciones

El listado asume `page: 1` y `limit: 20` si se omiten. Los parámetros del caso de uso son números: `typeId`, `publicationStatusId`, `genreId`, `year`; la conversión desde query strings HTTP se implementará en fase 6.

Un PATCH editorial vacío se rechaza. Los campos desconocidos o inmutables se rechazan, incluidos nombres derivados. El agregado vuelve a validar la ficha resultante: limpiar un campo opcional mediante `null` es posible; eliminar título o duración obligatoria de película no lo es.

Una edición que no cambia la ficha o una solicitud del estado actual devuelve el DTO vigente sin llamar a `saveChanges`. Una modificación efectiva entrega los estados anterior y siguiente al repositorio, conservando la comprobación de versión.

Los errores de concurrencia se propagan: el caso de uso no reintenta automáticamente sobre una versión distinta ni devuelve una respuesta de éxito antes de confirmar la persistencia.

No hay estados HTTP ni objetos Request/Response en estos casos de uso. La validación Zod del transporte, tamaño del body, presenters HTTP y traducción de errores quedan para fase 6.

## Verificaciones ejecutadas

Desde `catalog-service`:

```powershell
npm run typecheck
npm run verify:phase5
npm run verify:phase4
```

- Typecheck: correcto.
- Fase 5: 14 grupos de comprobaciones correctos con repositorio controlado, sin conexiones ni datos externos. Cubren validación previa, resultados parciales, errores técnicos, DTO, paginación, PATCH, ciclo de publicación y propagación de conflictos.
- Regresión fase 4: 15 grupos correctos contra MongoDB real en un contenedor temporal. Se ejecutó porque la validación compartida de consultas cambió; el contenedor fue eliminado al terminar.
- Revisión de dependencias: dominio y aplicación no importan infraestructura, MongoDB, Zod ni Next.js.

Los casos de uso se verificaron con un adaptador controlado; la persistencia se verificó por separado contra MongoDB. Todavía no hay pruebas HTTP ni una suite formal Vitest/Jest. Esas entregas mantienen sus fases originales.
