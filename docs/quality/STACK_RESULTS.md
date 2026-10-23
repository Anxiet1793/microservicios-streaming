# Verificación del entorno distribuido raíz

Fecha: 20 de octubre de 2026, America/Lima. Entorno: Windows, Docker Engine Linux, Compose 5.6.0 y Node 24.21.0. Evidencia estructurada: [STACK_LOCAL_RESULTS.json](STACK_LOCAL_RESULTS.json).

## Entrega

- docker-compose.yml raíz reutiliza Dockerfiles de frontend, Users, Catalog, Playback y MinIO.
- Nueve servicios persistentes: cuatro apps, PostgreSQL exclusivo de Users, dos MongoDB, MinIO y Redis (necesario para el BFF).
- Seis procesos init/seed: migraciones Users, cuentas demo, inicialización Catalog, replica set Playback, índices/bucket Playback y seed multimedia mediante APIs.
- Servicio smoke opcional por profile tools; no se ejecuta durante el build de ninguna imagen.
- Seis volúmenes propios y redes internas por contexto. Las bases no publican puertos.
- ENV raíz generado sin sobrescribir credenciales existentes; ningún ENV de los proyectos individuales alimenta esta composición.
- Herramientas raíz sin dependencias npm, README de instalación y pasos CI para comprobar el Compose raíz después de Playwright.

## Ejecución real

| Comando / comprobación                                       | Resultado                                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| node scripts/setup-stack.mjs                                 | Creó `.env` con secretos aleatorios, ignorado por Git                                                   |
| docker compose config --quiet                                | PASS                                                                                                    |
| docker compose up --build --detach --wait --wait-timeout 300 | PASS; construyó/reutilizó las cinco imágenes                                                            |
| Healthchecks                                                 | 9 servidores running/healthy; 6 inicializadores Exited (0)                                              |
| npm test                                                     | 5 tests aprobados; 0 omitidos                                                                           |
| npm run smoke                                                | 10 grupos de comprobaciones aprobados; Playback con MP4 real                                            |
| docker compose run --rm --no-deps smoke                      | 10 grupos aprobados desde DNS interno Docker                                                            |
| npm run stack:seed                                           | PASS; un título, un asset y dos cuentas demo después de repetir                                         |
| npm run stack:down                                           | PASS; conservó volúmenes y no detuvo los Compose individuales                                           |
| npm run stack:up                                             | PASS; reinicio desde volúmenes existentes, init/seed idempotentes y smoke automático aprobado           |
| Generador vía docker run, con ENV existente                  | PASS; conservó el archivo sin cambios                                                                   |
| Compose individuales, config --quiet desde cada carpeta      | PASS en los cuatro proyectos                                                                            |
| actionlint 1.7.9                                             | PASS para ambos workflows; sin shellcheck/pyflakes externos                                             |
| Revisión de logs contra secretos locales generados           | Sin coincidencias de password PostgreSQL/MinIO, SESSION_SECRET, SEED_PASSWORD ni clave privada completa |

Las imágenes conservan sus builds Next.js y comprobación TypeScript existentes; no se modificó código productivo de los cuatro proyectos para esta integración. No se afirma una nueva ejecución de las 379 pruebas de aplicaciones o de los 12 Playwright en este cambio: sus resultados anteriores están en HARDENING_RESULTS.json. Aquí se probaron las nuevas herramientas y el despliegue real con ambos modos de smoke.

## Qué verificó el smoke

1. Users, Catalog y Playback: HTTP 200 y contrato de health correcto.
2. Frontend: login HTML HTTP 200.
3. Cuenta aleatoria propia del smoke: registro 201 y login 200; password incorrecta 401.
4. Identidad actual coincide con la cuenta creada; JWT ausente y firma adulterada rechazados.
5. Las tres escrituras de Catalog rechazan anónimo 401 y USER 403.
6. Listado de catálogo público y consulta autenticada de historial Playback.
7. Inicio de sesión Playback 201 para la película seed.
8. URL firmada: lectura real de 32 bytes con Range y respuesta 206, cabecera MP4 ftyp válida. Desde el host se usa el puerto público; dentro de Docker se conserva el Host firmado al conectar por DNS MinIO.
9. Actualización de progreso y pausa con HTTP 200.
10. Login BFF, cookie opaca, consulta de identidad vía Redis, logout y refresh de Users revocado con HTTP 401.

El test negativo de herramientas invoca el script contra un puerto inaccesible y comprueba **exit code 1**. El helper HTTP se prueba con un servidor local 500 y verifica que no expone el cuerpo, password o bearer en el mensaje. También se comprueba el rechazo de URLs remotas o con credenciales para evitar crear cuentas en producción por variables heredadas del shell. Los otros tests verifican generación de par RSA consistente, secretos independientes, conservación de ENV y resolución de destinos host/Docker.

## Persistencia y estado final

Después de seed repetido y de down/up: **1 título**, **1 asset**, **2 cuentas demo**. Se conservó el mismo tituloId. Las cuentas smoke se añaden intencionadamente y no están incluidas en ese recuento de dos cuentas demo. La película dura 12 segundos, H264, 320×180 y menos de 1 MiB.

Se dejó el proyecto `nevaro` funcionando: frontend en http://localhost:8080; APIs en 8081/8082/8083 y MinIO en 9000/9001. Los siete contenedores previos de los Compose individuales siguen activos. Las credenciales de este nuevo stack están únicamente en el `.env` raíz local, no en este informe.

Evidencia local ignorada: `.verification/stack-up.log`, `stack-smoke-host.log`, `stack-smoke-docker.log`, `stack-reseed.log`, `stack-down.log` y `stack-restart.log`. Los logs no incluyen ENV resueltos ni tokens completos. No se generó ni verificó un run remoto de GitHub Actions; solo se validó el workflow y su equivalente local.

## Límites

Es una composición de desarrollo local: replica set de un nodo, HTTP/loopback, sin HA ni TLS de ingreso. El primer build de MinIO requiere red para descargar sus fuentes/Go y los builds npm usan el registro; una interrupción de red puede detener el primer arranque. COMPOSE_PARALLEL_LIMIT limita llamadas al motor; BuildKit puede ejecutar fases internas en paralelo. Los avisos MEDIUM y la rotación externa de la credencial Atlas histórica descritos en SECURITY_REVIEW.md siguen siendo asuntos separados de esta entrega.
