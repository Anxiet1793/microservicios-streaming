# Fuentes, decisiones y pendientes

## Trazabilidad de evidencia

| ID | Fuente consultada | Uso | Límite |
|---|---|---|---|
| S0 | Texto pegado(8).txt, adjunto de esta solicitud | Requisitos de entregables y restricciones | No acredita implementación |
| S1 | ARQUITECTURA_DATOS_Y_APIS(1).md, 414 líneas, actualizado 14/10/2026; libfile_e645f11c697081918719dbb61c071311 | Rutas y semántica descritas del backend | Fuente secundaria respecto a repo/YAML; no ejecutada |
| S2 | https://nextjs.org/docs/app/guides/backend-for-frontend | Capacidad BFF y responsabilidades de seguridad | Recomendación de proyecto condicional, no código probado |
| S3 | https://nextjs.org/docs/app/guides/authentication | Autorización cerca de acceso a datos | Detalles finales dependen de Users |
| S4 | https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults | Necesidad de configurar staleTime/retries explícitos | Tiempos elegidos son presupuesto del proyecto |
| S5 | https://www.w3.org/TR/WCAG22/ | Objetivo WCAG 2.2 AA | No conformidad certificada |
| S6 | https://github.com/google/fonts/blob/main/ofl/manrope/OFL.txt | Licencia de tipografía Manrope | Conservar licencia en futura distribución |
| S7 | https://lucide.dev/ | Familia iconográfica y licencia ISC | Logo propio todavía conceptual |
| S8 | https://web.dev/articles/vitals | Objetivos LCP/INP/CLS | Medidas reales aún no disponibles |

Consultas web realizadas 17/10/2026, únicamente fuentes primarias para decisiones técnicas. No se copian artículos ni se derivan endpoints del proyecto desde fuentes web. Colores/medidas/naming son propuesta original del plan.

## Registro abreviado ADR

| ADR | Decisión propuesta | Causa | Reconsiderar cuando |
|---|---|---|---|
| 01 | BFF Next delgado + sesión opaca | Cookies, composición y autorización | G02 impida protocolo correcto o se requiera escalado sin store |
| 02 | Dark first, sin light MVP | Foco cinematográfico y QA acotado | Uso frecuente diurno y requerimientos reales |
| 03 | CSS Modules + tokens | Identidad propia con dependencias mínimas | Repo ya tenga sistema consistente distinto |
| 04 | MP4 nativo | Playback documenta MP4 firmado | Backend entregue manifiestos HLS/DASH reales |
| 05 | Página de detalle, no modal | Deep link/back y móvil | Investigación revele coste de navegación relevante |
| 06 | Series como fichas | No hay API episodios en S1 | G03 cerrado |
| 07 | Sin rankings/recomendaciones simuladas | Datos no disponibles | Contrato y pipeline reales |
| 08 | Admin crea título nuevo para clip | Falta asociación de asset a existente | G01 resuelto |

## Preguntas para cerrar integración, sin bloquear diseño

1. URL del repo o ZIP completo y rama/commit a auditar.
2. ¿El despliegue de demo será solo laptop o accesible por red a otros dispositivos?
3. Nombre/path y mecanismo CSRF de refresh/logout; DTO real de sesión/URL/progreso.
4. ¿El curso exige reemplazar video de un título existente o basta publicar uno nuevo?
5. ¿Fecha de exposición y si upload/recomendaciones son obligatorios en rúbrica?

La aprobación creativa puede ajustar marca/tono sin rehacer contratos. La aprobación de diseño no equivale a validación backend. Una vez recibido repo, actualizar los documentos que cambien con evidencia por operación, preservando la distinción entre documentado y probado.
