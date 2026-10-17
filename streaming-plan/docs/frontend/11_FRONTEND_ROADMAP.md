# Roadmap ejecutable

## Prioridad y camino crítico

P0: autenticación, lectura de catálogo, detalle, reproducción y progreso/retomar, seguridad mínima y red de medios. P1: registro, Mi Lista, preferencias, historial, perfil y publicación de video nuevo. P2: edición editorial ampliada, filtros avanzados, gestión de gustos, polish extra. P3: episodios, recomendaciones, pagos, modo claro.

Camino crítico: contratos → conectividad y auth → sesión de video real → catálogo/detalle → player final → retomar → ensayo. Adelantar un spike del player reduce el riesgo de descubrir al final un problema de cookies o MinIO. Las fases de UI siguen el orden siguiente, con pruebas desde cada fase, no solo al final.

Estimación orientativa para una persona con backend estable: 18–27 jornadas de desarrollo/QA para P0+P1 seleccionado. Es una hipótesis de planificación, no compromiso; no incluye resolver backend, assets, episodios o Recommendations. Revisar tras cerrar fase 0.

| Fase | Objetivo y entregables | Dependencias | Criterio de aceptación para avanzar |
|---|---|---|---|
| 0 Brand/UX/arquitectura + auditoría | Aprobar plan; revisar repo/SHA/YAML; cerrar G00/02/05/09; spike HTTP reproductor | Repositorio, cuentas demo y red | Matriz V para recorrido base; URL con seek real y progreso recuperado; incertidumbres registradas |
| 1 Foundation | App Router, TS strict, CSS Modules/tokens, entorno, scripts y shell de errores | F0; diseño aprobado | Build/lint/typecheck, sin secretos públicos, tokens aplicados en ejemplo mínimo |
| 2 Auth | Login/registro/logout/refresh, BFF sesión, guards y cache por usuario | F1 + contratos Users | Refresh concurrente sin invalidar familia; logout limpia cache; rol backend; sesión recuperable |
| 3 Layout/navegación | Navbar/bottom nav/admin shell y focus | F2 | Teclado y 4 anchos sin overflow; Watch sin chrome global |
| 4 Catálogo | Home base, Explorar/Search, imágenes y estados | F3 + C01/C02 | Solo publicado consumidor, queries cancelables, empty != error, no carriles ficticios |
| 5 Detalle | Metadata/acciones/availability | F4 | Ficha incompleta, serie sin episodios y retirado se entienden; Play honesto |
| 6 Mi Lista/gustos | Mutaciones y joins, rollback y lectura de estado completa | F5 + Users | Doble click no duplica ni deja LIKE/DISLIKE simultáneos; fallo rollback y paginación correctos |
| 7 Player | Lifecycle, seek, progreso, URL refresh, fullscreen | Spike F0 + F2/F5 | Video real, pausa/reanuda, guarda en orden, sin sesión duplicada, renovación conserva posición |
| 8 Retomar/historial | Carril y páginas con fichas | F7 + P08/P09 | Retoma tras login a <=2 s de guardado confirmado; historial última reproducción por título |
| 9 Admin upload | Multipart real, metadata, ficha nueva e importación/publicación | F2/F4/F7, G08/G10 | ADMIN sube y USER reproduce título nuevo; sin fingir asociación existente; errores parciales visibles |
| 10 Recommendations | Solo cuando servicio/pipeline real exista | G04 cerrado | Carriles con razón respaldada y fallback omitido; si no hay servicio, fase pospuesta sin bloquear MVP |
| 11 Polish/motion | Imagen, microcopy y movimiento medido | P0 estable | Tokens consistentes, reduced-motion, sin afectar INP/CLS; no introducir rediseño de alcance |
| 12 Validación integral | E2E, a11y manual, rendimiento y fallos | Pruebas incrementales previas | Suite crítica pasa, 0 bloqueantes, desviaciones WCAG documentadas, red demo probada |
| 13 Preparar exposición | Seed controlado, 3 guiones y respaldo | F12 | 5 ensayos base seguidos y al menos 2 admin; plan B disponible sin afirmar ejecución en vivo |

## Reparto operativo sugerido

Un responsable de frontend mantiene tokens/UX y revisiones; responsable Users cierra auth/CSRF; Catalog cierra G01/G08/G10; Playback cierra media/expiración/progreso. Son roles de coordinación, no se asume disponibilidad ni se han asignado tareas a personas.

## Recorte si hay poco tiempo

Mantener P0 y guion de 3 minutos. Reusar componentes de detalle para Mi Lista/gustos si se conserva guion 5 min. El guion 8 min depende de upload/publicación probados: si no, presentar recorrido admin preparado explicando su condición. Quitar antes filtros avanzados, pantalla Preferencias y decoraciones; no quitar flush/recuperación de progreso.

## Definition of Done por entrega

Contrato y evidencia actualizados; estados loading/empty/error completos; desktop/tablet/mobile y teclado; ninguna petición dispersa en primitives; auth/roles en servidor; test del riesgo modificado; build/typecheck/lint; textos y tokens consistentes; instrucciones demo actualizadas. Cualquier desviación se registra con responsable y fecha, no se oculta en TODO anónimo.
