Actúa como Arquitecto de Software Senior especializado en:

- Domain-Driven Design (DDD)
- Arquitectura de Microservicios
- Clean Architecture / Hexagonal Architecture
- Node.js
- TypeScript
- Next.js
- MongoDB
- Docker
- APIs REST
- Diseño de bases de datos NoSQL
- Testing automatizado

Quiero que construyas desde cero el primer microservicio de una plataforma de
streaming académica.

==========================================================
CONTEXTO DEL PROYECTO
==========================================================

La plataforma está dividida mediante DDD en los siguientes Bounded Contexts:

- Usuarios
- Catálogo
- Reproducción
- Recomendaciones
- Pagos

En esta fase SOLO implementaremos el Bounded Context:

CATÁLOGO

No implementar Usuarios, Reproducción, Recomendaciones ni Pagos.

Debe respetarse estrictamente la separación de contextos.

Cada microservicio será dueño de su propia base de datos.

Ningún servicio puede acceder directamente a las colecciones o base de datos
de otro servicio.

Las futuras comunicaciones entre servicios deberán hacerse mediante:

- APIs REST
- contratos
- eventos

pero NUNCA compartiendo directamente la base de datos.

==========================================================
RESPONSABILIDAD DEL BOUNDED CONTEXT CATÁLOGO
==========================================================

Catálogo administra y expone la oferta audiovisual.

Es responsable de:

- registrar títulos
- mantener su ficha descriptiva
- actualizar información editorial
- determinar el estado de publicación
- exponer información del título
- proporcionar a Reproducción una referencia técnica del contenido cuando
  corresponda

Catálogo NO debe almacenar:

- progreso de reproducción
- sesiones de reproducción
- puntuaciones de recomendaciones
- perfiles completos de usuarios
- pagos
- transacciones

Los conceptos principales definidos por el dominio son:

TítuloCatalogo
- entidad raíz del agregado
- posee un TituloId estable

FichaContenido
- Value Object perteneciente al TítuloCatalogo
- contiene información descriptiva
- no tiene identidad independiente

EstadoPublicacion
- Value Object
- estados iniciales:

REGISTRADO
PUBLICADO
RETIRADO

Ciclo de vida:

REGISTRADO -> PUBLICADO -> RETIRADO

El estado solo puede ser modificado por Catálogo.

==========================================================
OBJETIVO
==========================================================

Implementar un microservicio profesional llamado:

catalog-service

utilizando:

- Node.js
- TypeScript
- Next.js con App Router
- Route Handlers para API REST
- MongoDB
- MongoDB Node.js Driver oficial
- Zod para validación
- Docker
- Docker Compose
- Jest o Vitest para testing

NO utilizar MongoDB como si fuera una base relacional.

Diseñar las colecciones aprovechando correctamente documentos embebidos,
índices, arrays y estructuras BSON.

Evitar crear una colección por cada Value Object.

==========================================================
ARQUITECTURA
==========================================================

Quiero una arquitectura modular inspirada en:

DDD + Clean Architecture + Hexagonal Architecture.

Separar claramente:

DOMAIN
APPLICATION
INFRASTRUCTURE
INTERFACES / HTTP

Una estructura aproximada podría ser:

src/
  app/
    api/
      v1/
        catalog/
          route.ts
          bulk/
            route.ts
          [tituloId]/
            route.ts
            publication-status/
              route.ts
      health/
        route.ts

  modules/
    catalog/
      domain/
        entities/
        value-objects/
        repositories/
        errors/
        types/

      application/
        use-cases/
        dto/
        mappers/

      infrastructure/
        persistence/
          mongodb/
            collections/
            repositories/
            mappers/
            indexes/
        config/

      interfaces/
        http/
          schemas/
          presenters/

  shared/
    infrastructure/
    errors/
    logging/
    utils/

tests/

scripts/

docs/

No copies exactamente esta estructura si existe una alternativa mejor.

Analiza primero el problema y define una estructura coherente.

El dominio NO debe depender:

- de Next.js
- de MongoDB
- del driver de MongoDB
- de Zod
- de Docker

La infraestructura puede depender del dominio, pero nunca al revés.

==========================================================
MODELO DE MONGODB
==========================================================

Diseña cuidadosamente las colecciones.

La colección principal debería llamarse aproximadamente:

catalog_titles

NO crear:

titulo
ficha_contenido
estado_publicacion

como colecciones separadas.

FichaContenido y EstadoPublicacion pertenecen al agregado TítuloCatalogo y
deben almacenarse dentro del documento cuando tenga sentido.

Propón un documento parecido conceptualmente a:

{
  "_id": ObjectId,

  "tituloId": "ttl_xxxxxxxxx",

  "type": "MOVIE",

  "ficha": {
    "title": "Interstellar",
    "originalTitle": "Interstellar",
    "synopsis": "...",
    "releaseYear": 2014,
    "durationMinutes": 169,
    "genres": [
      "SCIENCE_FICTION",
      "DRAMA"
    ],
    "languages": [
      "es",
      "en"
    ],
    "ageRating": "PG-13",
    "posterUrl": "...",
    "backdropUrl": "...",
    "director": "...",
    "cast": []
  },

  "publicationStatus": "PUBLICADO",

  "playbackReference": {
    "provider": "CDN",
    "assetId": "asset_xxx",
    "manifestKey": "..."
  },

  "createdAt": ISODate(...),
  "updatedAt": ISODate(...)
}

NO copies ciegamente este modelo.

Evalúa:

- películas
- series
- temporadas
- episodios
- límite de 16 MB por documento de MongoDB
- crecimiento futuro
- consultas esperadas
- duplicación controlada
- atomicidad
- cardinalidad

Decide justificadamente si:

1. películas y series pueden convivir en catalog_titles,

y

2. los episodios deben estar embebidos dentro de una serie o vivir en una
colección catalog_episodes relacionada mediante tituloId/seriesId.

Si creas catalog_episodes, sigue perteneciendo exclusivamente al Bounded
Context Catálogo.

No convertir esa colección en otro microservicio.

==========================================================
IDENTIFICADORES
==========================================================

No utilizar el ObjectId de MongoDB como contrato externo.

Crear un TituloId estable independiente del motor de persistencia.

Ejemplo:

ttl_01K...

Puede utilizar:

UUID
ULID

o una alternativa apropiada.

Explica la elección.

MongoDB puede conservar su _id ObjectId internamente.

Crear índice UNIQUE para tituloId.

==========================================================
ENDPOINTS
==========================================================

Implementar como mínimo los siguientes endpoints REST.

----------------------------------------------------------
1. POST /api/v1/catalog/bulk
----------------------------------------------------------

Carga masiva del catálogo mediante JSON.

Debe aceptar un body similar a:

{
  "items": [
    {
      "type": "MOVIE",
      "ficha": {
        "title": "Interstellar",
        "originalTitle": "Interstellar",
        "synopsis": "...",
        "releaseYear": 2014,
        "durationMinutes": 169,
        "genres": [
          "SCIENCE_FICTION",
          "DRAMA"
        ],
        "languages": ["es", "en"],
        "ageRating": "PG-13",
        "posterUrl": "...",
        "backdropUrl": "..."
      },
      "playbackReference": {
        "provider": "CDN",
        "assetId": "interstellar_2014",
        "manifestKey": "movies/interstellar/master.m3u8"
      }
    }
  ]
}

La API debe:

- validar todo el payload con Zod
- tener límite configurable de elementos por petición
- evitar inserts uno por uno
- utilizar bulkWrite de MongoDB
- manejar ordered:false cuando sea adecuado
- evitar duplicados
- devolver información clara por registro
- distinguir insertados, rechazados y duplicados
- soportar idempotencia razonable
- proteger contra payloads excesivamente grandes
- no realizar N operaciones HTTP internas

Definir claramente si el endpoint realiza INSERT o UPSERT.

Justificar la decisión.

Ejemplo de respuesta:

{
  "success": true,
  "summary": {
    "received": 500,
    "inserted": 492,
    "duplicates": 5,
    "failed": 3
  },
  "errors": []
}

No devolver documentos gigantes innecesariamente.

----------------------------------------------------------
2. GET /api/v1/catalog
----------------------------------------------------------

Obtención masiva/paginada del catálogo.

Implementar paginación.

Soportar inicialmente filtros como:

?page=
&limit=
&type=
&status=
&genre=
&year=
&q=

Ejemplo:

GET /api/v1/catalog?page=1&limit=20&type=MOVIE&status=PUBLICADO

Respuesta:

{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 340,
    "totalPages": 17
  }
}

Establecer un límite máximo razonable.

Nunca devolver todo el catálogo completo sin control.

Optimizar projections para evitar enviar información innecesaria.

----------------------------------------------------------
3. GET /api/v1/catalog/:tituloId
----------------------------------------------------------

Devuelve la información detallada de un título.

Este endpoint será importante posteriormente para el Bounded Context
Reproducción.

Debe poder proporcionar, mediante un contrato estable:

- tituloId
- tipo
- estadoPublicacion
- información mínima necesaria
- playbackReference

Reproducción en el futuro consumirá este contrato.

Reproducción NO debe acceder directamente a MongoDB.

El diseño debe permitir que Catálogo cambie internamente sin romper el
contrato público.

----------------------------------------------------------
4. PATCH /api/v1/catalog/:tituloId
----------------------------------------------------------

Permite actualizar la FichaContenido.

Debe:

- validar los campos modificables
- impedir modificación directa de tituloId
- impedir modificación directa de _id
- impedir modificar publicationStatus mediante este endpoint
- impedir manipular createdAt
- actualizar updatedAt
- retornar 404 si no existe

Aplicar PATCH real, no reemplazar indiscriminadamente todo el documento.

----------------------------------------------------------
5. PATCH /api/v1/catalog/:tituloId/publication-status
----------------------------------------------------------

Controla explícitamente EstadoPublicacion.

Body:

{
  "status": "PUBLICADO"
}

Implementar reglas del dominio.

Ejemplo:

REGISTRADO -> PUBLICADO
PUBLICADO -> RETIRADO

No permitir transiciones inválidas sin una regla explícita.

La validación de las transiciones debe vivir en DOMAIN y no en el controller.

Ejemplo de respuesta de error:

{
  "error": {
    "code": "INVALID_PUBLICATION_TRANSITION",
    "message": "No se puede cambiar de RETIRADO a REGISTRADO"
  }
}

==========================================================
ENDPOINT EXTRA DE INFRAESTRUCTURA
==========================================================

Crear:

GET /api/health

Respuesta mínima:

{
  "status": "ok",
  "service": "catalog-service"
}

Si es razonable, comprobar conexión a MongoDB.

No mezclar este endpoint con el dominio.

==========================================================
ÍNDICES MONGODB
==========================================================

Analiza las consultas anteriores y crea exclusivamente índices justificados.

Como mínimo evaluar:

UNIQUE:
tituloId

Filtros:
publicationStatus
type
ficha.releaseYear
ficha.genres

Búsqueda:
ficha.title

Evaluar índices compuestos como:

{
  publicationStatus: 1,
  type: 1,
  updatedAt: -1
}

No crear índices indiscriminadamente.

Crear un script idempotente:

scripts/init-mongo.ts

o equivalente que:

- cree las colecciones necesarias
- cree índices
- pueda ejecutarse repetidamente sin romper el entorno

Considerar MongoDB JSON Schema validation si aporta valor.

==========================================================
SEGURIDAD Y VALIDACIÓN
==========================================================

Implementar:

- validación con Zod
- sanitización de inputs
- control de tamaño de requests
- límites para paginación
- manejo centralizado de errores
- códigos HTTP correctos
- impedir operadores MongoDB suministrados por el cliente
- evitar NoSQL Injection
- no devolver stack traces en producción

Utilizar respuestas coherentes.

Ejemplos:

400 VALIDATION_ERROR
404 CATALOG_TITLE_NOT_FOUND
409 CATALOG_TITLE_ALREADY_EXISTS
422 INVALID_PUBLICATION_TRANSITION
500 INTERNAL_SERVER_ERROR

==========================================================
REPOSITORY PATTERN
==========================================================

El dominio debe definir una interfaz aproximadamente:

CatalogRepository

con operaciones necesarias para los casos de uso.

La implementación concreta:

MongoCatalogRepository

debe encontrarse en Infrastructure.

Los casos de uso NO deben importar directamente MongoClient.

Ejemplo conceptual:

Domain
  CatalogRepository

Infrastructure
  MongoCatalogRepository implements CatalogRepository

Application
  GetCatalog
  GetCatalogTitle
  BulkCreateCatalog
  UpdateCatalogTitle
  ChangePublicationStatus

==========================================================
CASOS DE USO
==========================================================

Crear casos de uso separados:

BulkCreateCatalogTitles
GetCatalogTitles
GetCatalogTitleById
UpdateCatalogTitle
ChangePublicationStatus

Los Route Handlers deben ser delgados.

NO quiero lógica de negocio gigante dentro de:

route.ts

El route handler debe principalmente:

1. recibir HTTP
2. validar DTO
3. llamar al caso de uso
4. transformar la respuesta
5. devolver HTTP

==========================================================
MONGODB CONNECTION
==========================================================

Implementar correctamente el manejo de MongoClient.

Evitar crear una conexión nueva por cada request.

Crear un singleton/pool reutilizable compatible con Next.js.

Variables:

MONGODB_URI=
MONGODB_DATABASE=catalog_service

Preparar:

.env.example

Nunca incluir credenciales reales.

==========================================================
MONGODB ATLAS Y DESARROLLO LOCAL
==========================================================

El entorno principal puede utilizar MongoDB Atlas Free Tier.

Por eso Docker NO debe asumir obligatoriamente que MongoDB vive en el mismo
contenedor.

La aplicación debe funcionar con:

MONGODB_URI=mongodb+srv://...

Adicionalmente quiero un docker-compose para desarrollo local que pueda
levantar:

catalog-service
mongo

para pruebas locales.

Separar ambas configuraciones correctamente.

==========================================================
DOCKER
==========================================================

Crear un Dockerfile optimizado.

Utilizar:

- multi-stage build
- imagen Node LTS apropiada
- instalación reproducible
- NODE_ENV=production
- usuario no root si es posible
- .dockerignore

Preparar docker-compose.yml.

La aplicación debe poder ejecutarse aproximadamente mediante:

docker compose up --build

==========================================================
OBSERVABILIDAD
==========================================================

Agregar logging estructurado.

Registrar:

- requestId
- endpoint
- method
- statusCode
- duration

No registrar:

- credenciales
- MONGODB_URI
- información sensible completa

==========================================================
OPENAPI
==========================================================

Crear:

docs/openapi.yaml

Documentar:

POST /api/v1/catalog/bulk
GET /api/v1/catalog
GET /api/v1/catalog/{tituloId}
PATCH /api/v1/catalog/{tituloId}
PATCH /api/v1/catalog/{tituloId}/publication-status
GET /api/health

Incluir:

- parámetros
- request bodies
- response schemas
- status codes
- ejemplos

==========================================================
TESTING
==========================================================

Crear pruebas unitarias para DOMAIN y APPLICATION.

Como mínimo:

- creación de TítuloCatalogo
- cambio válido de EstadoPublicacion
- cambio inválido de EstadoPublicacion
- validación de FichaContenido
- búsqueda por TituloId
- actualización de ficha
- bulk insert
- detección de duplicados

Agregar pruebas de integración para MongoCatalogRepository cuando sea
razonable.

No conectar los tests automáticamente contra una BD productiva.

==========================================================
REPRODUCCIÓN FUTURA
==========================================================

NO implementar Reproduction Service todavía.

Sin embargo, preparar el contrato de Catálogo para que en el futuro
Reproducción pueda consultar:

GET /api/v1/catalog/:tituloId

y determinar:

- si el título existe
- si está PUBLICADO
- qué TituloId posee
- qué referencia técnica debe emplearse para localizar el recurso multimedia

IMPORTANTE:

playbackReference NO significa que Catálogo controle una sesión.

Catálogo solamente describe/referencia el recurso.

Reproducción será responsable posteriormente de:

- iniciar sesión
- pausar
- reanudar
- finalizar
- registrar progreso
- estado de reproducción
- integración operativa con CDN

No contaminar Catalog con esas responsabilidades.

==========================================================
SERIES Y EPISODIOS
==========================================================

Quiero que prestes atención especial a series.

Determina una estrategia profesional para:

MOVIE
SERIES

No quiero un diseño ingenuo donde una serie con cientos o miles de episodios
haga crecer indefinidamente un único documento MongoDB.

Puedes proponer:

catalog_titles
catalog_episodes

si técnicamente está justificado.

Ejemplo conceptual:

catalog_titles
{
  tituloId,
  type: "SERIES",
  ficha,
  publicationStatus
}

catalog_episodes
{
  episodeId,
  seriesId,
  seasonNumber,
  episodeNumber,
  title,
  durationMinutes,
  playbackReference,
  publicationStatus
}

Si utilizas esta alternativa:

- crear índices adecuados
- garantizar que seriesId corresponda al TituloId
- mantenerlo dentro del mismo Bounded Context
- explicar por qué no viola DDD
- no convertir Episodes en otro microservicio

==========================================================
DECISIONES QUE QUIERO DOCUMENTADAS
==========================================================

Crear:

docs/architecture.md

Explicar:

1. por qué existe este microservicio
2. Bounded Context
3. Aggregate Root
4. Value Objects
5. Repository Pattern
6. estructura de carpetas
7. diseño MongoDB
8. por qué FichaContenido está embebida
9. estrategia películas/series/episodios
10. estrategia de índices
11. contrato Catálogo -> Reproducción
12. por qué Reproducción no accede directamente a MongoDB
13. bulkWrite
14. paginación
15. Docker
16. decisiones y trade-offs

Agregar un pequeño Mermaid:

Cliente
   |
   v
Catalog API
   |
   v
Application
   |
   v
Domain
   |
   v
Repository Port
   |
   v
MongoCatalogRepository
   |
   v
MongoDB

Y otro diagrama:

Reproduction Service
        |
        | GET /api/v1/catalog/:tituloId
        v
Catalog Service
        |
        v
Catalog DB

Aclarar:

Reproduction Service --> Catalog API

CORRECTO

Reproduction Service --> Catalog MongoDB

PROHIBIDO

==========================================================
README
==========================================================

Crear un README.md profesional incluyendo:

- descripción
- arquitectura
- requisitos
- variables de entorno
- cómo instalar
- cómo ejecutar local
- cómo ejecutar Docker
- cómo usar MongoDB Atlas
- cómo crear índices
- cómo ejecutar tests
- endpoints
- ejemplos curl
- estructura de carpetas

==========================================================
DATOS DE PRUEBA
==========================================================

Crear un archivo:

examples/catalog.bulk.json

con aproximadamente:

- 3 películas
- 2 series

Utilizar títulos ficticios o genéricos para no depender de datos externos.

Debe ser válido para:

POST /api/v1/catalog/bulk

==========================================================
CRITERIOS DE CALIDAD
==========================================================

No quiero un proyecto generado únicamente para "funcionar".

Quiero que pueda defender arquitectónicamente el código ante un profesor de
Arquitectura de Microservicios.

Por cada decisión importante pregúntate:

¿Esto pertenece realmente al Bounded Context Catálogo?

¿Estoy filtrando conceptos de Reproducción hacia Catálogo?

¿Estoy exponiendo detalles internos de MongoDB?

¿El dominio depende de infraestructura?

¿La colección fue diseñada pensando en los patrones de consulta?

¿Este índice tiene una consulta que lo justifique?

¿Esta abstracción aporta valor o es sobreingeniería?

Priorizar:

claridad
cohesión
bajo acoplamiento
contratos explícitos
DDD
testabilidad
escalabilidad

sobre cantidad de código.

==========================================================
FORMA DE TRABAJO
==========================================================

Trabaja por fases.

FASE 1
Analiza el dominio y muestra el árbol final de carpetas.

FASE 2
Diseña el modelo de dominio y explica Aggregate Root y Value Objects.

FASE 3
Diseña las colecciones MongoDB y los índices.

FASE 4
Implementa Infrastructure y Repository.

FASE 5
Implementa casos de uso.

FASE 6
Implementa los endpoints.

FASE 7
Implementa Docker.

FASE 8
Implementa tests.

FASE 9
Genera OpenAPI, README y documentación arquitectónica.

FASE 10
Ejecuta:

- typecheck
- lint
- tests
- build

Corrige cualquier error encontrado.

No declares que algo funciona sin haber ejecutado las verificaciones
disponibles.

Al terminar muestra:

1. árbol final del proyecto
2. endpoints implementados
3. colecciones creadas
4. índices creados
5. pruebas ejecutadas
6. resultado del build
7. decisiones arquitectónicas principales
8. comandos exactos para levantar el proyecto
9. ejemplo para realizar el POST masivo
10. ejemplo para consultar un título por TituloId