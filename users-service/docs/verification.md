# Verificación final — 4 de octubre de 2026

Se completaron las diez fases de Users Service: requisitos/estructura, dominio y modelo PostgreSQL, migración, aplicación, infraestructura, autenticación, Mi Lista/preferencias, Docker, tests y documentación. La estructura final está en el README y las decisiones en architecture.md.

## Comprobaciones ejecutadas

| Comando                                                   | Resultado                                                                                                  |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                       | Correcto, incluyendo tipos de rutas Next, scripts y tests.                                                 |
| `npm run lint`                                            | Correcto, sin errores ni warnings de ESLint.                                                               |
| `npm test`                                                | **31 pruebas unitarias correctas**, en dominio, aplicación y seguridad/HTTP.                               |
| `npm run test:integration`                                | **16 pruebas correctas**, con PostgreSQL 17 temporal y credenciales propias.                               |
| `npm run docs:check`                                      | OpenAPI 3.0.3 válido, **15 operaciones**, patrones de IDs consistentes y cinco ejemplos validados con Zod. |
| `npm run build`                                           | Build Next.js 16.3.5 correcto, 12 rutas dinámicas de API/JWKS.                                             |
| `npm run build:scripts`                                   | Migrador, seed y limpieza compilados correctamente para Node 24.                                           |
| `npm run check`                                           | Cadena completa correcta: tipos, lint, unitarios, OpenAPI y builds.                                        |
| `npm run test:e2e`                                        | **14 grupos correctos** contra la imagen real y PostgreSQL en un proyecto Compose temporal.                |
| Generación de `.env` mediante Node 24 en Docker           | Correcta; la repetición conserva el archivo existente y no imprime secretos.                               |
| `docker compose up --build -d --wait`                     | Entorno local iniciado: API y PostgreSQL healthy; migrador terminó con código 0.                           |
| `docker compose exec -T users-service node dist/seed.mjs` | Cuentas locales admin@streaming.local (ADMIN) y demo@streaming.local (USER), ambas ACTIVE.                 |

Entorno usado: Node.js 24.21.0, TypeScript 6.0.3, Docker Desktop con contenedores Linux y PostgreSQL 17. No se sustituyó el Node global del usuario. Docker realizó `npm ci` con el lockfile y compiló sin `.env`, claves ni conexión a PostgreSQL.

Al terminar quedó disponible `http://127.0.0.1:3001/api/health`, que respondió `{"status":"ok","service":"users-service"}`. JWKS publicó una clave RSA/RS256 con kid `users-dev-1`, sin material privado. La base local registra una migración aplicada. La contraseña de las cuentas demo se conserva exclusivamente en `SEED_PASSWORD` del `.env` local generado; no se imprime ni se incluye en esta documentación.

## Cobertura funcional y de seguridad

- Registro correcto, normalización/duplicados concurrentes de email y rol USER asignado por servidor.
- Creación transaccional de usuario/perfil, incluido rollback por fallo de la segunda inserción.
- Argon2id con sal aleatoria, parámetros definidos y verificación de contraseña; ausencia de hashes en DTO.
- Login correcto, contraseña incorrecta, cuenta ausente/inactiva y consultas parametrizadas.
- JWT RS256, issuer/audience, expiración, firma inválida y verificación mediante JWKS sin clave privada.
- Refresh de un solo uso, expiración absoluta conservada, rechazo por vencimiento y revocación de familia confirmada ante replay.
- Dos refresh simultáneos, logout sobre token anterior a la rotación y revocación idempotente.
- Cambio de contraseña, comparación del hash esperado, revocación de todas las sesiones y rechazo local de authVersion antigua.
- Perfil parcial y rechazo de campos protegidos, roles aportados por cliente, usuarios inactivos y claims incompatibles.
- Mi Lista: alta, duplicado, listado, eliminación e imposibilidad de operar sobre datos ajenos.
- LIKE/DISLIKE, cambio de señal, createdAt conservado y updatedAt estable ante PUT idéntico.
- Paginación limitada, IDs de Catálogo, queries repetidas/desconocidas, cuerpos excesivos y JSON/media type inválidos.
- Cookies HttpOnly/SameSite, flag Secure en configuración de producción, validación de Origin y cabecera CSRF para CLI.
- Rate limiter con contadores compartidos y UPSERT concurrente; respuesta 429 con Retry-After.
- Migración repetida, seed idempotente, rechazo del seed en producción y proceso de aplicación no root.
- Logs correlacionados con requestId y sin contraseñas, claves privadas ni tokens.
- Health responde 503 al detener PostgreSQL.

## Aislamiento de pruebas

Los unitarios no conectan a PostgreSQL. Integración crea un contenedor con URL generada dentro del test; no usa DATABASE_URL ni `.env` del usuario. E2E crea su propio proyecto Compose, secretos, puertos y volúmenes, aplica la migración y ejecuta la API construida en Linux. Los recursos temporales se eliminan en `finally`.

El build anterior se interrumpió durante la descarga de dependencias. Se verificó después una instalación limpia en Linux, incluido el módulo nativo Argon2. El Dockerfile fija el digest de Node 24 y limita los tiempos/reintentos de descarga; el build y la ejecución final pasaron.

## Alcance de la evidencia

Estas pruebas verifican el MVP local. No se ejecutaron pruebas de carga sostenida, auditoría criptográfica externa, despliegue público ni rotación de varias claves JWT. La cookie Secure se comprueba en unitarios; E2E usa HTTP local y APP_ENV=development. No se implementaron frontend, Playback, Recommendations ni cambios de autenticación en Catalog.

Logout revoca refresh, pero los access tokens emitidos pueden vivir hasta expirar. El cambio de contraseña invalida access tokens antiguos dentro de Users por authVersion; un consumidor externo que solo verifique firma necesita respetar el TTL o incorporar revocación distribuida en una fase posterior. Estos comportamientos son decisiones explícitas del contrato, no garantías de revocación instantánea global.
