# Revisión de seguridad y hardening

Fecha: 20 de octubre de 2026 (America/Lima). Alcance: frontend/BFF, Users, Catalog, Playback, manifests/lockfiles, Docker/Compose, configuración, contratos, tests y Git. Se preservó el trabajo anterior del repositorio. No se accedió a infraestructura productiva ni se hizo pentesting externo.

## Hallazgos y decisiones

| ID     | Severidad       | Hallazgo                                                                                                     | Estado                                                                                                                                                                                                                                        |
| ------ | --------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01 | CRITICAL        | URI Atlas con credencial dentro de `catalog-service/.env.atlas.example`, presente también en el commit base  | Archivo retirado y referencias corregidas. **Rotación/revocación externa pendiente**; borrar el archivo no invalida el secreto histórico.                                                                                                     |
| SEC-02 | HIGH            | Catalog permitía importación, edición y cambio de estado sin autenticación propia                            | Corregido: las tres escrituras exigen ADMIN por RS256/JWKS antes de leer body o abrir MongoDB. BFF y fixtures ahora envían el access token.                                                                                                   |
| SEC-03 | CRITICAL / HIGH | Dependencias Next y tooling con avisos vigentes                                                              | Corregidas versiones compatibles y lockfiles. Cero avisos HIGH/CRITICAL en los cuatro árboles auditados; ver auditoría de dependencias.                                                                                                       |
| SEC-04 | MEDIUM          | Verificadores JWT aceptaban claims de rol por coerción a string; iat no tenía antigüedad máxima explícita    | Corregido: rol exacto USER/ADMIN, jti string no vacío, iat numérico, antigüedad máxima 1800 s y tolerancia 5 s. Pruebas con arrays, claims inválidos, fechas futuras y tokens antiguos. No se afirma que antes hubiera escalación demostrada. |
| SEC-05 | MEDIUM          | Headers de navegador inconsistentes en los tres servicios API                                                | Corregido: CSP restrictiva, frame-ancestors none, nosniff, no-referrer, X-Frame-Options DENY, Permissions-Policy; sin X-Powered-By. Frontend conserva su CSP funcional y valida MEDIA_ORIGIN.                                                 |
| SEC-06 | MEDIUM          | Ocho paquetes con avisos moderados transitivos: Drizzle Kit y MinIO                                          | Pendientes; no se forzaron majors/downgrades incompatibles. Exposición y mitigaciones en DEPENDENCY_AUDIT.md.                                                                                                                                 |
| SEC-07 | MEDIUM          | Catalog no limita tráfico directamente, especialmente lecturas públicas y peticiones JWT inválidas           | Pendiente rate limiting en gateway/proxy antes de exposición pública. Loopback en Compose, bytes/lotes/paginación acotados y timeout JWKS no sustituyen un límite de tráfico.                                                                 |
| SEC-08 | MEDIUM          | CSP frontend requiere unsafe-inline para scripts/estilos de Next y estilos actuales                          | Pendiente política con nonce por solicitud y validación de SSR/caché. React escapa texto y no se encontró dangerouslySetInnerHTML en src; no elimina todo riesgo XSS.                                                                         |
| SEC-09 | MEDIUM          | Revocación no instantánea en servicios que verifican JWT sin consultar Users                                 | Trade-off explícito: access TTL predeterminado 900 s, máximo 1800 s. Users comprueba estado/authVersion y BFF consulta Users; Catalog/Playback aceptan un JWT válido hasta vencer. Futuro: invalidación por eventos o TTL menor.              |
| SEC-10 | MEDIUM          | URL presignada puede reutilizarse por quien la conozca mientras dure su firma                                | Trade-off S3: bucket privado y expiración acotada; permisos/sesión se verifican antes de emitirla. Cerrar sesión no revoca una URL ya firmada. Reducir TTL según despliegue, usar TLS y no registrar query strings.                           |
| SEC-12 | MEDIUM          | JWKS publica una sola clave; rotación con solapamiento no automatizada                                       | Pendiente procedimiento de rotación y publicación de claves anteriores durante TTL + caché.                                                                                                                                                   |
| SEC-11 | LOW             | Sin HSTS local, MongoDB/Redis de desarrollo sin autenticación y sin escaneo de imágenes/SBOM en este alcance | Configuración para entorno local aislado, no configuración productiva. TLS/HSTS en ingreso, redes privadas, credenciales por servicio y análisis de imágenes son tareas del despliegue. No exponer puertos de bases de datos.                 |

## Secretos: acción externa necesaria

El scanner del árbol actual no encuentra secretos según sus patrones; el escaneo de objetos Git accesibles encuentra una URI con credencial en el blob histórico de `.env.atlas.example`. **Tratar esa credencial como comprometida.** Revocar o rotar el usuario/contraseña en Atlas, actualizar las variables locales o del despliegue que lo utilicen y revisar accesos/privilegios e IP permitidas. No se probó la credencial ni se imprimió su valor en estos informes. No se dispone de acceso administrativo a Atlas para efectuar esa rotación.

No se reescribió ni publicó el historial Git. Si se decide purgarlo, coordinar la reescritura con colaboradores después de revocar el secreto. Los clones, forks y cachés pueden conservarlo.

Se añadió `.gitignore` raíz: `.env`, `.env.*`, claves PEM/KEY y artefactos quedan ignorados; la única excepción de ENV es `.env.example`. Se retiró la excepción específica de Atlas en Catalog. Los `.env` existentes del operador se conservaron sin imprimirlos. El scanner también rechaza archivos ENV versionados distintos de `.env.example`. `.gitignore` nunca elimina archivos ya registrados en Git por sí solo.

```powershell
python scripts/security/scan_secrets.py
python scripts/security/scan_secrets.py --history
python -m unittest discover -s scripts/security -p "test_*.py"
```

El scanner usa biblioteca estándar, muestra solo ruta/línea/tipo y no valores. Reconoce claves privadas, patrones de API keys, URIs con credenciales y ciertos literales. Tiene excepciones acotadas para placeholders y datos sintéticos de pruebas/documentación. No es un detector universal ni demuestra que nunca existió otro secreto. `--history` informa historia sin bloquear por secretos ya retirados; el gate falla por hallazgos del árbol actual. No se añadieron servicios externos de escaneo.

## Revisión por superficie

### Identidad y autorización

- Users firma RS256; la clave privada no se comparte. Catalog y Playback obtienen exclusivamente claves públicas del JWKS configurado por ENV. Nunca usan jku/x5u del token como destino ni consultan Users PostgreSQL.
- Verificación de algoritmo, issuer, audience, expiración, iat, jti, typ, sub público y correspondencia userId/sub. Roles admitidos exactamente USER y ADMIN. JWKS remoto tiene timeout 4 s, caché 10 min y cooldown 30 s. Errores de verificación/disponibilidad rechazan la autenticación.
- Registro no admite role/status; perfil no admite IDs, hashes ni elevación de permisos. Playback verifica ADMIN para assets y propietario para sesiones/progreso. El BFF comprueba ADMIN y Catalog vuelve a comprobarlo: el BFF no es la única barrera.
- Catalog GET lista/detalle continúa público por decisión MVP. Incluye estados editoriales y referencias opacas de assets; no entrega credenciales ni URL firmada ni concede reproducción. Si esos metadatos se vuelven confidenciales, restringir lecturas administrativas y filtrar PUBLICADO como un cambio de contrato separado.
- Claves de firma: la implementación permite kid, pero todavía no hay un procedimiento automático de rotación con publicación simultánea de claves anteriores. Planificar solapamiento de al menos TTL + caché JWKS antes de retirar una clave.

### Passwords, cookies, CORS y CSRF

- Argon2id con sal aleatoria; usuarios únicos normalizados; errores genéricos de credenciales. Refresh opaco aleatorio guardado como hash, expiración absoluta, rotación de un solo uso, replay revoca familia y logout revoca sesión. Cambio de password revoca sesiones y aumenta authVersion.
- Cookie Users HttpOnly, SameSite Strict, path de auth y Secure con APP_ENV=production. BFF usa cookie de sesión opaca HttpOnly/Strict, almacena tokens cifrados AES-GCM en Redis y no los expone a JavaScript/localStorage. Redis usa locking/CAS para refresh concurrente.
- Mutaciones BFF exigen cabecera propia y origen permitido; se rechaza Sec-Fetch-Site cross-site. Auth por cookie en Users requiere Origin permitido o cabecera CSRF explícita. No hay CORS wildcard con credenciales. Catalog usa Bearer, no cookies; el frontend usa BFF same-origin, sin necesitar CORS público en Catalog.
- Secure está desactivado deliberadamente para HTTP local. Configurar APP_ENV=production/HTTPS y APP_ORIGIN exacto al desplegar; mantener Redis y DB inaccesibles desde Internet.

### Inyección, rutas, uploads y URLs

- SQL: Drizzle parametriza operaciones; filtros/identificadores validados. Mongo: filtros construidos por el adapter, Zod estricto, categorías numéricas y búsquedas de texto, sin aceptar operadores Mongo ni objetos query arbitrarios. Hay regresiones de parámetros tipo genre[$ne].
- El BFF usa destinos y rutas de servicio conocidos, valida IDs, rechaza redirecciones upstream y no funciona como proxy URL libre. Los destinos ENV son configuración confiable del operador, no entrada de usuario.
- Upload solo ADMIN, multipart con límites reales de bytes, un archivo, sin campos extra, deadline y límite de frecuencia. Extensión/MIME no bastan: se inspecciona ftyp y ffprobe valida contenedor MP4, H264 y audio AAC. execFile no usa shell; ffprobe restringe protocolos y recursos con timeout/buffer.
- Nombre recibido se normaliza como basename para metadata. El archivo real se escribe con wx en mkdtemp/asset.mp4; claves de objetos las genera el servidor. No se concatena el nombre del cliente a una ruta de escritura. Limpieza en finally; pruebas incluyen archivos malformados, MIME falso y exceso de tamaño.
- MinIO usa bucket privado y firma expirable; no se copia la clave privada JWT ni se consulta DB ajena. Una URL firmada es una credencial temporal: referrer no-referrer y logs sin URL completa ayudan a limitar exposición. Sigue pendiente aislar ffprobe con límites de CPU/memoria más estrictos y escanear su imagen para producción.

### Límites, logs y errores

- Users tiene límites PostgreSQL para login/register/cambio de password; Playback usa buckets Mongo por identidad para requests/uploads; BFF usa Redis. No confían ciegamente en una IP X-Forwarded-For enviada por cliente. Catalog requiere protección de tráfico adicional (SEC-07).
- HTTP JSON estricto, tipos permitidos, control de bytes del stream y límites de consultas/lotes. Errores de aplicación estandarizados; fallos inesperados responden genéricamente, sin stack ni datos de conexión. Logs estructurados con requestId, acción/endpoint, estado y duración; no registran bodies/passwords/tokens/query strings.
- Reportes Playwright se generan con contraseñas/keys efímeras; el sanitizer existente limpia trazas antes de subir artifacts. Un fallo de sanitización impide subir esos artifacts. No se publican ENV ni logs de Compose completos como artifacts. El arranque integrado ahora reconstruye también los tres backends para evitar reutilizar imágenes anteriores al hardening.

## Análisis estático y regresión

Los cuatro tsconfig mantienen strict, noUncheckedIndexedAccess, noUnusedLocals y noUnusedParameters. ESLint cubre TS y TSX con reglas recomendadas y consistent-type-imports, sin desactivar reglas para ocultar fallos. Prettier 3.9.10 comparte `.prettierrc.json`; `.gitattributes` fija LF para evitar discrepancias Windows/Linux. Los cambios de formato son mecánicos, sin reestructuración del dominio.

Cada proyecto ofrece `format`, `format:check`, `lint`, `typecheck`, `test:coverage` y `build`. CI incorpora formato, scanner y `npm audit --audit-level=high` como gates, además de las comprobaciones existentes. Los cambios de configuración y scanner disparan push CI. Las pruebas nuevas verifican firmas RSA reales/JWKS HTTP, fallos cerrados, algoritmos alternativos, tokens antiguos, claims malformados, rol USER y acceso anónimo a las tres escrituras.

Resultados reales, sin tests omitidos ni reintentos:

| Proyecto         | format:check / lint / typecheck / build | Tests Vitest aprobados | Coverage líneas / ramas |
| ---------------- | --------------------------------------- | ---------------------- | ----------------------- |
| frontend         | PASS                                    | 65                     | 81.22 % / 72.16 %       |
| users-service    | PASS                                    | 96                     | 95.28 % / 91.05 %       |
| catalog-service  | PASS                                    | 103                    | 88.14 % / 82.80 %       |
| playback-service | PASS                                    | 115                    | 86.89 % / 78.22 %       |

Total: **379 tests Vitest**, incluidos componentes, API, contratos e integración según proyecto, y **12 E2E Playwright aprobados**. Todos los umbrales de coverage existentes pasan, sin reducirlos. El formato cambia el número de líneas instrumentadas; los porcentajes no deben compararse con el snapshot previo como si el denominador fuera idéntico.

También pasaron OpenAPI (Users 15 / Catalog 6 / Playback 12 operaciones), bundling de migración/seed/inicializadores, 14 comprobaciones smoke HTTP de Catalog y su smoke Docker (10 comprobaciones). El stack E2E reconstruyó las cuatro imágenes desde los lockfiles actuales y verificó directamente seis rechazos de Catalog (401 anónimo / 403 USER en cada escritura) y los headers de las cuatro apps. ADMIN creó, publicó y editó contenido en el navegador. Los recursos efímeros propios se eliminaron; no se reiniciaron contenedores existentes del operador.

Scanner: 4 tests aprobados, cero hallazgos actuales según patrones y un blob histórico con credencial. Sanitizer: 3 tests aprobados. actionlint 1.7.9 validó ambos workflows (sin ejecutables externos shellcheck/pyflakes disponibles). `npm audit --audit-level=high` terminó con código 0 en los cuatro proyectos. En producción (`--omit=dev`), frontend/Users/Catalog tienen cero avisos y Playback conserva cuatro MEDIUM.

Evidencia versionable: [HARDENING_RESULTS.json](HARDENING_RESULTS.json). Artefactos locales ignorados: `coverage/` de cada proyecto, `frontend/playwright-report/index.html`, `frontend/test-results/results.json` y logs `*/.verification/hardening-*.log`. No existe un run remoto de GitHub Actions verificado para estos cambios.

Para reproducir, ejecutar en cada proyecto `npm ci`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:coverage` y `npm run build`; en backend añadir `npm run docs:check`. Después ejecutar `npm run test:e2e` desde frontend con Docker activo. Para reconstruir el stack integrado local: `powershell -ExecutionPolicy Bypass -File frontend/scripts/start.ps1` desde la raíz; usa los ENV locales ya configurados. Este último comando reconstruye/reinicia los servicios persistentes del operador, por lo que no se utilizó para la auditoría aislada.

## Orden de seguimiento

1. **P0:** revocar/rotar credencial Atlas y revisar accesos. Reconstruir y desplegar imágenes nuevas para aplicar parches; editar el checkout no actualiza contenedores existentes.
2. **P1:** rate limiting de Catalog en el ingreso, TLS/secret manager/redes de producción y rotación documentada de claves JWT.
3. **P1:** reevaluar MinIO y Drizzle Kit al publicar sus árboles corregidos; probar cualquier cambio incompatible antes de migrar.
4. **P2:** CSP con nonce, invalidación de JWT por eventos, TTL de URLs firmado acorde al riesgo, aislamiento de ffprobe y escaneo de imágenes/SBOM.

Este documento distingue correcciones verificables en código de decisiones MVP y operaciones externas pendientes. No certifica el sistema como seguro para producción.
