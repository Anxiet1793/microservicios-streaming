# Resultados de colección API

Fecha: **21 de octubre de 2026**. Entorno local Windows, Node **24.21.0**, npm **12.2.0**, Bruno CLI **4.2.1**, Docker Linux y Compose raíz existentes. Evidencia estructurada: [API_COLLECTION_LOCAL_RESULTS.json](API_COLLECTION_LOCAL_RESULTS.json).

## Entrega

[Colección y guía](../../api/bruno/README.md): 59 archivos de petición, once carpetas, dos entornos públicos sin secretos, captura automática en memoria de tokens/cookies/IDs, MP4 sintético versionado y generador de esquemas desde los OpenAPI existentes. Incluye los **33 endpoints documentados**: Users 15, Catalog 6, Playback 12. [Inventario](../../api/bruno/endpoint-coverage.json).

No se modificaron handlers, dominios, bases de datos ni contratos de producción. Las operaciones del demo utilizan HTTP público de cada servicio y crean su propia cuenta, título y asset; no alteran la película seed ni cuentas personales.

## Ejecución real

| Comando desde raíz         | Peticiones | Tests Bruno | Fallos / omitidos | Resultado |
| -------------------------- | ---------: | ----------: | ----------------: | --------- |
| `npm run api:health`       |        4/4 |       16/16 |             0 / 0 | PASS      |
| `npm run api:demo`         |      57/57 |     220/220 |             0 / 0 | PASS      |
| `npm run api:demo:cleanup` |      59/59 |     227/227 |             0 / 0 | PASS      |

Son requests reales contra Users/PostgreSQL, Catalog/MongoDB, Playback/Mongo replica set y MinIO, sin mocks. El modo cleanup pasó dos veces con cuentas y contenidos nuevos; la última ejecución, después de todos los overrides de seguridad, tardó **12,651 s** en Bruno. El demo sin limpieza tardó **11,919 s**. Los campos `totalAssertions=0` de Bruno corresponden a su bloque declarativo `assert`; las comprobaciones implementadas están en `tests`, cuyo total es 220/227. No hay pruebas omitidas.

El flujo verificó upload → importar/publicar → registro/login → detalle → watchlist → LIKE/DISLIKE → Playback → posición 3 s → pausa → Continue Watching → reanudar en 3 s → URL renovada → COMPLETED/100% → exclusión de Continue Watching → historial completed. El modo cleanup retiró el título recién creado y borró su asset después de completar la sesión.

También pasaron los negativos: 400 de validación/progreso negativo/preferencia inválida/rol protegido/operador NoSQL, 401 de credenciales inválidas/refresh revocado/anónimo, 403 de CSRF y permisos USER/ADMIN, 404 de título inexistente, 409 de email/watchlist duplicados y asset en uso, y 415 del archivo falso anunciado como MP4. Se verificaron respuesta JSON Schema, campos requeridos, IDs y ausencia de hashes/campos internos.

La primera ejecución de desarrollo detectó dos problemas de la colección: referencia incorrecta al esquema Health inline de Catalog y modo multipart mal escrito. Se corrigieron en el generador y se repitió el flujo completo. No se relajó ningún control del backend para conseguir el resultado.

## Validaciones auxiliares

- `npm test`: **9/9** tests de herramientas raíz, incluidos saneamiento, rechazo de reportes incompletos, orden del demo y ausencia de secretos en entornos versionados.
- `npm run api:check`: **3/3** tests de compatibilidad de dependencias; parser Bruno y comparación reproducible de **72 archivos generados**, cobertura de los **33 endpoints** y plan de **57 peticiones**.
- `python scripts/security/test_scan_secrets.py`: **5/5**; el scanner reconoce exclusivamente placeholders Bruno completos y sigue detectando literales reales.
- `python scripts/security/scan_secrets.py`: sin hallazgos en archivos actuales. No constituye un borrado de credenciales históricas.
- Auditoría de `api/bruno`: **0 vulnerabilidades** después de ajustes revisados; ver [DEPENDENCY_AUDIT.md](DEPENDENCY_AUDIT.md).
- Formatter de archivos nuevos/ajustados y actionlint de ambos workflows: PASS.

El MP4 se comprobó con ffprobe dentro de Playback: **12 s, H264, 320×180, 350607 bytes**. SHA256: `24b708dfee7d4214dfa4895aca6e194393992e568951aa2626c96a1e2dec9216`. La fixture es sintética y no contiene material de terceros. El fixture falso contiene texto.

## Reportes y alcance

Los reportes reales JSON/JUnit/salida están en `api/bruno/reports/`, ignorados por Git. Los reportes excluyen cuerpos y headers; el wrapper sanea también mensajes antes de guardarlos/imprimirlos y elimina sus temporales crudos. Las variables públicas de entorno se conservaron byte por byte durante la ejecución. El resumen versionado conserva solo métricas, contratos y datos del fixture, sin credenciales ni URLs firmadas.

El demo predeterminado deja su película y asset para inspección. El modo cleanup conserva cuenta, historial y catálogo retirado, al no existir endpoints de borrado para esos registros. No hay limpieza global de bases ni volúmenes locales.

El workflow existente ahora ejecuta check/audit y demo cleanup sobre el Compose raíz, con artifacts saneados. Se verificó estáticamente; **no se afirma que haya pasado GitHub Actions sin un run remoto**. Tampoco se ejecutó la interfaz gráfica de Bruno ni se repitieron builds/tests completos de las cuatro aplicaciones, porque esta entrega cambia exclusivamente colección, herramientas, documentación y CI. La prueba funcional relevante fue el flujo HTTP real sobre sus imágenes existentes.

## Reproducir

```sh
npm run stack:up
npm run api:install
npm run api:check
npm test
npm run api:health
npm run api:demo
# Alternativa que retira el título y elimina el asset creados por esta nueva ejecución:
npm run api:demo:cleanup
```

Para Bruno Desktop: `npm run api:setup`, abrir `api/bruno`, seleccionar **Local** y seguir `demo-plan.json`. No ejecutar toda la colección en orden de carpetas: los tests de estado y negativos necesitan la secuencia del plan.
