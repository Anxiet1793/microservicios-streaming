# Auditoría de dependencias

Fecha: 20 de octubre de 2026 (America/Lima). Alcance: los cuatro `package.json` y sus lockfiles; npm 12.2.0, Node 24.21.0. Se auditó el árbol completo, incluidas herramientas de desarrollo. `moderate` de npm se presenta como **MEDIUM**. Son recuentos de paquetes afectados, no de CVE distintos ni de ataques demostrados.

## Resultado

| Proyecto         | Antes CRITICAL / HIGH / MEDIUM | Después CRITICAL / HIGH / MEDIUM |
| ---------------- | ------------------------------ | -------------------------------- |
| frontend         | 1 / 0 / 0                      | 0 / 0 / 0                        |
| users-service    | 1 / 1 / 4                      | 0 / 0 / 4                        |
| catalog-service  | 1 / 3 / 0                      | 0 / 0 / 0                        |
| playback-service | 1 / 1 / 4                      | 0 / 0 / 4                        |

No se ejecutó `npm audit fix --force`. Los cuatro `npm audit --audit-level=high` deben terminar con código 0; Users y Playback siguen mostrando MEDIUM. Esto no significa ausencia de riesgos.

## Actualizaciones aplicadas

| Dependencia                  | Cambio          | Motivo                                                                                                                                   |
| ---------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js, cuatro aplicaciones | 16.3.5 → 16.4.2 | Avisos CRITICAL/HIGH de Next, incluida ejecución de código en ImageResponse, además de bypass y disponibilidad. Misma versión major.     |
| Vite, tres backends          | 8.3.2 → 8.3.4   | Actualización compatible de dependencia de Vitest; avisos del servidor de desarrollo y lanzamiento de editores. Frontend ya tenía 8.3.4. |
| sharp, Catalog               | 0.35.4 → 0.35.5 | Bibliotecas de imagen vulnerables; dependencia opcional transitiva de Next.                                                              |
| source-map-js, Catalog       | 1.2.1 → 1.2.2   | Denegación de servicio al consumir source maps indexados.                                                                                |

Además se fijó Prettier 3.9.10 como herramienta común y jose 6.2.12 como dependencia directa de Catalog para verificar RS256/JWKS. No se cambió el major de ningún paquete existente. Los lockfiles se actualizaron mediante npm, sin editar sus resoluciones manualmente ni forzar overrides incompatibles.

La severidad reportada por npm no prueba que una ruta sea explotable. Por ejemplo, este repositorio no usa `ImageResponse`; aun así, se actualizó Next para retirar la dependencia vulnerable. Vite es tooling de pruebas, no un servidor expuesto en las imágenes finales.

Fuentes: [Next/ImageResponse](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j), [launch-editor](https://github.com/advisories/GHSA-r825-w8mm-5pxw), [sharp/librsvg](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).

## MEDIUM pendientes

### Users: herramienta de desarrollo Drizzle Kit

Cadena: `drizzle-kit@0.31.11` → `@esbuild-kit/esm-loader@2.6.5` → `@esbuild-kit/core-utils@3.3.2` → `esbuild@0.18.20`. npm cuenta cuatro paquetes por un aviso base de esbuild: [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99).

El aviso afecta al servidor de desarrollo de esbuild y sus permisos CORS. El servicio usa `next start`; las migraciones usan un script propio de Drizzle ORM y no ese servidor. `db:generate` es la herramienta de desarrollo que trae el árbol afectado. No ejecutar `drizzle-kit studio` ni servidores esbuild accesibles desde redes no confiables.

La versión estable consultada de Drizzle Kit sigue siendo 0.31.11. npm propone volver a 0.18.1, un cambio incompatible que no se aplicó. Forzar esbuild 0.28 sobre el requisito `~0.18.20` tampoco es un parche compatible. Pendiente: actualizar Drizzle Kit cuando migre el loader y validar generación de una migración en una base desechable. La auditoría con `--omit=dev` permite distinguir este riesgo del runtime.

### Playback: MinIO SDK

Cadena: `minio@8.0.7` → `query-string@7.1.3` → `decode-uri-component@0.2.2`, y `minio` → `stream-json@1.9.1`. npm cuenta cuatro paquetes; tres avisos afectan a stream-json y uno a decode-uri-component.

Referencias: [decodificación URI / DoS](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), [filtros JSON / DoS](https://github.com/advisories/GHSA-528h-pc64-c93x), [comentarios JSON / DoS](https://github.com/advisories/GHSA-hqr4-qq8f-hg3x), [Assembler / prototype pollution](https://github.com/advisories/GHSA-mjw6-4jj6-33hc).

Estas dependencias sí pertenecen al runtime. El adapter usa bucket privado, claves UUID generadas por servidor y un endpoint MinIO configurado por el operador. No expone notificaciones de MinIO, SelectObjectContent ni parsers JSON arbitrarios a clientes; stream-json entra por el módulo de notificaciones del SDK. El riesgo no se declara eliminado: una entrada o servidor de almacenamiento malicioso cambia el análisis de exposición.

La versión estable consultada de MinIO sigue siendo 8.0.7. npm propone bajar a 7.1.3; las versiones corregidas de stream-json y decode-uri-component quedan fuera de los rangos de sus padres. No se forzaron cambios incompatibles en el SDK de almacenamiento. Pendiente: parche upstream o migración revisada del SDK, seguida de tests reales de upload, firma, lectura, borrado y streaming. Mantener MinIO en red privada y no ampliar las funciones del SDK sin reevaluar estos avisos.

## Reproducción y seguimiento

Dentro de cada proyecto:

```powershell
npm ci
npm audit --json
npm audit --omit=dev --json
npm audit --audit-level=high
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
npm run build
```

Los JSON originales antes/después están en cada `.verification/dependency-before.json` y `dependency-after.json` (ignorados, evidencia local). Los avisos dependen del registro a la fecha de ejecución. CI ejecuta la auditoría completa con umbral HIGH: no se omiten dependencias de desarrollo ni se convierte un fallo en éxito. Los pendientes MEDIUM se revisan en cada actualización; no hay excepciones permanentes que oculten un nuevo HIGH/CRITICAL.

Resultados de pruebas, builds y límites del análisis: [SECURITY_REVIEW.md](SECURITY_REVIEW.md).

## Adición: CLI de colección API, 21 de octubre de 2026

La nueva herramienta está aislada en `api/bruno` y no se incorpora a las imágenes runtime de los cuatro proyectos. Se fijaron `@usebruno/cli@4.2.1` y `yaml@2.9.1`. Su instalación inicial reportó 12 paquetes afectados: 0 CRITICAL, 8 HIGH y 4 MODERATE.

Se fijaron overrides exclusivamente en este tooling: axios 1.20.0, form-data 4.0.6, js-yaml 4.3.2 y yaml 2.9.1. Se revisaron además tres cambios mayores transitivos: Faker 9 → 10.6.0, csv-parse 6 → 7.0.2 y uuid 10 → 11.1.1. No se aplicó `audit fix --force` ni se cambiaron dependencias de producción. Faker 10 permite require desde Node 24, versión exigida por esta colección; csv-parse y uuid conservan exports CommonJS y las APIs consumidas por Bruno.

La compatibilidad se verifica con tres tests que ejecutan las APIs Faker usadas por Bruno, el adapter CSV real de su CLI y las funciones UUID expuestas por su sandbox; también se repitió el demo real con 59 peticiones/227 tests después de todos los overrides. Las versiones quedan bloqueadas en el lockfile y se revisarán al actualizar Bruno. La comprobación cubre esta colección REST y esas APIs auxiliares; no certifica todas las funciones del producto Bruno.

Resultado final de `npm audit --prefix api/bruno --audit-level=moderate`: **0 vulnerabilidades, exit code 0**. Esto no modifica los pendientes MEDIUM de Users/Playback descritos arriba. CI audita también este lockfile sin omitir devDependencies.

Referencias: [Faker: aviso](https://github.com/advisories/GHSA-qxc2-j82w-r537), [migración oficial a Faker 10](https://fakerjs.dev/guide/upgrading), [csv-parse](https://github.com/advisories/GHSA-8cw4-87c7-c6xx), [uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq), [form-data](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx), [js-yaml](https://github.com/advisories/GHSA-2883-xcg3-v3hh).
