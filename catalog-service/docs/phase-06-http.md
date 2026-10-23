# Fase 6 — API REST con Next.js

Estado histórico al cierre de fase 6: implementada y verificada. Las fases posteriores ya se completaron; consultar [README](../README.md) y [verificación final](verification.md) para el estado actual.

## Endpoints implementados

| Método | Ruta                                            | Comportamiento                                                              |
| ------ | ----------------------------------------------- | --------------------------------------------------------------------------- |
| POST   | `/api/v1/catalog/bulk`                          | Carga masiva INSERT con validación individual e idempotencia por importKey. |
| GET    | `/api/v1/catalog`                               | Listado paginado, filtrado y con proyección reducida.                       |
| GET    | `/api/v1/catalog/{tituloId}`                    | Detalle, equivalencias numéricas y referencia técnica cuando corresponda.   |
| PATCH  | `/api/v1/catalog/{tituloId}`                    | Actualización de campos de ficha; admite limpiar opcionales con null.       |
| PATCH  | `/api/v1/catalog/{tituloId}/publication-status` | Transición editorial mediante un ID numérico.                               |
| GET    | `/api/health`                                   | Estado del servicio tras comprobar MongoDB.                                 |

Las rutas usan App Router, runtime Node.js y ejecución dinámica. Los archivos `route.ts` delegan en handlers; la lógica del dominio sigue en sus entidades y casos de uso. Las rutas GET admiten HEAD, y todas las rutas implementan OPTIONS y respuestas JSON 405 con cabecera Allow para métodos no admitidos.

No hay interfaz gráfica ni endpoints de Usuarios, Reproducción, Recomendaciones o Pagos.

## Validación y control del cuerpo

- Zod valida envolturas, registros de importación, ficha, estado, parámetros y filtros.
- Objetos estrictos rechazan campos desconocidos e intentos de escribir nombres derivados, identificadores, fechas o estado desde operaciones incorrectas.
- Los arrays de categorías contienen IDs numéricos existentes, sin repetidos. Los IDs enviados como strings en JSON se rechazan.
- Los parámetros query conservan los nombres solicitados: `page`, `limit`, `type`, `status`, `genre`, `year` y `q`. Sus valores numéricos se convierten de forma explícita; se rechazan parámetros repetidos, desconocidos u operadores suministrados por el cliente.
- El cuerpo exige `application/json` UTF-8 sin compresión. Se comprueba Content-Length cuando existe y, además, se cuentan los bytes reales mientras se consume el stream.
- `REQUEST_MAX_BYTES` y `BULK_MAX_ITEMS` mantienen los límites de configuración definidos anteriormente. La comprobación en bytes precede al parseo JSON.
- Un lote estructuralmente inválido se rechaza completo. Dentro de un lote válido, todos los elementos se validan antes de escribir; los válidos se procesan y los inválidos se reportan por índice original con código y detalles de campos.
- Si no queda ningún registro válido, no se abre una conexión a MongoDB para importar.

## Respuestas HTTP

| Código | Uso                                                                                            |
| ------ | ---------------------------------------------------------------------------------------------- |
| 200    | Consultas, PATCH y carga que solo contiene duplicados equivalentes.                            |
| 201    | Carga confirmada con al menos una inserción y sin fallos.                                      |
| 207    | Carga con éxitos/duplicados y rechazos individuales.                                           |
| 400    | JSON, envoltura, campos, IDs o filtros inválidos; lote sin registros aceptados por validación. |
| 404    | Título inexistente.                                                                            |
| 405    | Método no admitido.                                                                            |
| 409    | Conflicto concurrente o lote rechazado íntegramente por conflictos de identidad/importación.   |
| 413    | Cuerpo demasiado grande.                                                                       |
| 415    | Content-Type o Content-Encoding no admitido.                                                   |
| 422    | Transición de publicación inválida.                                                            |
| 500    | Error interno o fallo de persistencia confirmado sin registros aceptados.                      |
| 503    | Base no disponible o resultado de escritura indeterminado.                                     |

Un bulk con resultados indeterminados devuelve 503 conservando su resumen y resultados conocidos. No se afirma que la escritura no se aplicó. Las claves de importación permiten reintentar sin sobrescribir la ficha existente. Un bulk 207 puede contener errores de persistencia individuales: el cliente debe revisar cada resultado.

Los errores generales tienen la forma:

```json
{
  "error": {
    "code": "INVALID_PUBLICATION_TRANSITION",
    "message": "No se puede cambiar de RETIRADO a PUBLICADO.",
    "requestId": "<uuid>"
  }
}
```

La forma compacta de los resultados bulk de fase 5 se conserva. Los registros que fallan Zod añaden `issues` con path y código, sin copiar el payload original. Los errores inesperados nunca exponen el mensaje interno ni stack traces.

## Observabilidad

Cada solicitud a las rutas implementadas recibe un UUID generado por el servidor en `x-request-id`. Los errores generales incluyen el mismo ID en el body. Las respuestas llevan `Cache-Control: no-store` y `X-Content-Type-Options: nosniff`.

Se escribe un log JSON con `requestId`, `endpoint`, `method`, `statusCode` y `durationMs`. El endpoint utiliza la plantilla de ruta; no incluye query strings ni IDs concretos. No se registran cuerpos, cabeceras, referencias técnicas, credenciales ni MONGODB_URI.

## Ejecución y ejemplos

Desde `catalog-service`, con Node.js 24 y MongoDB disponible:

```powershell
npm ci
# Configurar .env a partir de .env.example si aún no existe.
npm run db:init
npm run dev
```

El servidor de desarrollo escucha en `http://127.0.0.1:3000`. Para ejecutar el build de producción:

```powershell
npm run build
npm start
```

Los scripts escuchan en loopback. La configuración de escucha dentro de contenedores se resolverá en fase 7.

El ejemplo [`examples/catalog.bulk.json`](../examples/catalog.bulk.json) contiene tres películas y dos series ficticias. Sus referencias son ilustrativas, no recursos multimedia desplegados.

Carga masiva, desde PowerShell:

```powershell
curl.exe -X POST "http://127.0.0.1:3000/api/v1/catalog/bulk" -H "Content-Type: application/json" --data-binary "@examples/catalog.bulk.json"
```

Consulta de películas registradas del género ciencia ficción:

```powershell
curl.exe "http://127.0.0.1:3000/api/v1/catalog?page=1&limit=20&type=1&status=1&genre=1"
```

Consulta, edición y publicación usando un TituloId devuelto por la carga:

```powershell
$catalogTitleId = "ttl_REEMPLAZAR_CON_UUID_DEVUELTO"
Invoke-RestMethod "http://127.0.0.1:3000/api/v1/catalog/$catalogTitleId"
Invoke-RestMethod -Method Patch -Uri "http://127.0.0.1:3000/api/v1/catalog/$catalogTitleId" -ContentType "application/json" -Body '{"ficha":{"title":"Título revisado"}}'
Invoke-RestMethod -Method Patch -Uri "http://127.0.0.1:3000/api/v1/catalog/$catalogTitleId/publication-status" -ContentType "application/json" -Body '{"publicationStatusId":2}'
```

## Verificación ejecutada

```powershell
npm run build
npm run typecheck
npm run verify:phase6
npm run verify:phase5
```

- Build de producción correcto: Next.js reconoce las cinco rutas y sus seis operaciones principales.
- Typecheck correcto, incluyendo tipos generados de rutas.
- Fase 6: 14 grupos de comprobaciones correctos, con servidor Next en producción y MongoDB real temporal. Incluyen endpoints, validaciones, tipos numéricos, carga parcial, idempotencia, PATCH, estados, métodos, límites reales de bytes, caída de MongoDB y logs correlacionados.
- Regresión de aplicación: el resumen de bulk se extrajo a un mapper reutilizable por HTTP y aplicación; se verifican nuevamente los casos de uso de fase 5.

`verify:phase6` requiere haber ejecutado el build. Crea su propio contenedor MongoDB, configura una base temporal y abre el servidor en un puerto local disponible; no usa la base configurada por el usuario. Al finalizar detiene el servidor y elimina el contenedor. No se dejan servicios de verificación ejecutándose.

La suite formal de fase 8, lint, OpenAPI y la documentación final continúan pendientes de sus fases. Haber ejecutado el build para verificar HTTP no da por completada la fase 10.

## Referencias

- [Route Handlers de Next.js](https://nextjs.org/docs/app/api-reference/file-conventions/route).
- [Dependencias externas del servidor](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages).
