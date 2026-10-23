# Evidencias del dossier EP

Evaluación del 21 de octubre de 2026. Informe principal: [EVIDENCIA_EP.md](../../EVIDENCIA_EP.md).

| Archivos                                                                 | Contenido/origen                                                                                                 |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `commands.json`                                                          | Comandos ejecutados, carpeta, inicio/fin UTC, exit code, duración y SHA256 del log saneado                       |
| `*-quality.json`, `*-build.json`, `frontend-e2e.json`, `root-stack.json` | Registros por fase; origen del índice de comandos                                                                |
| `*.log`                                                                  | stdout/stderr del comando, saneados antes de guardar; encabezado con comando, tiempos y código                   |
| `test-summary.json`                                                      | Totales y cobertura extraídos de los nuevos reportes Vitest; hashes de sus originales                            |
| `*-tests.json`                                                           | Cada caso Vitest con nombre, resultado, duración y archivo; grupos unit/component/API/contract/integration       |
| `*-coverage.json`                                                        | Copia del JSON summary V8 real, con métricas totales y por archivo                                               |
| `*-junit.xml`                                                            | Reportes JUnit reales de Vitest, Playwright y Bruno                                                              |
| `junit-verification.json`                                                | Parseo independiente con ElementTree: número de testcase, failure, error y skipped                               |
| `e2e-results.json`                                                       | Stats y casos del reporte real de Playwright; hashes de JSON/JUnit/HTML locales                                  |
| `docker-health.json`                                                     | Estado final de Compose, imagen/puertos por servicio, health HTTP y ausencia de contenedores temporales de tests |
| `demo-results.json`                                                      | Resumen y status/test por petición Bruno; sin cuerpos/headers/tokens                                             |
| `*-audit.json`                                                           | Respuesta de npm audit por proyecto, comando, fechas y exit code                                                 |
| `remote-ci.json`                                                         | Consulta real de runs GitHub; lista vacía en esta consulta, no evidencia de un pipeline remoto aprobado          |
| `secret-scan.json`                                                       | Resultado del scanner de archivos actuales en el momento indicado por la recolección                             |
| `source-manifest.json`                                                   | SHA256 del código/tests/configuración evaluados; HEAD base y nota sobre el working tree                          |
| `source-verification.json`                                               | Comparación posterior de los archivos del manifiesto de fuentes                                                  |
| `checksums.json`                                                         | SHA256 de los artefactos de esta carpeta y del dossier; excluye su propio archivo                                |

Los registros normalizados se derivaron de ejecuciones nuevas. El HTML Playwright y la cobertura HTML/LCOV permanecen en las carpetas locales ignoradas `frontend/playwright-report` y `<proyecto>/coverage`; los JSON/JUnit de este directorio permiten revisar las cifras sin depender de esos HTML. Los logs omiten claves privadas, passwords conocidos, JWT, tokens opacos y URLs firmadas; por ello sus hashes corresponden a los **logs saneados**, no a un stdout crudo con secretos.

El informe distingue los 379 tests Vitest, los 12 E2E y los 227 tests Bruno. No hay que sumarlos para afirmar cobertura, ni confundir peticiones HTTP con casos Vitest. Los grupos de integración ya están incluidos en Vitest. Los thresholds y exclusiones están descritos en el dossier.

Para verificar integridad desde la raíz, con Python estándar:

```sh
python -c "import json,hashlib,pathlib; m=json.loads(pathlib.Path('docs/evidence/ep-20261021/checksums.json').read_text()); bad=[x['path'] for x in m['files'] if hashlib.sha256(pathlib.Path(x['path']).read_bytes()).hexdigest()!=x['sha256']]; print('PASS' if not bad else bad); raise SystemExit(bool(bad))"
```

Los checksums permiten detectar cambios accidentales posteriores. No son una firma criptográfica ni una prueba independiente de autoría. No se incluyen archivos ENV privados, credenciales ni copias de bases.
