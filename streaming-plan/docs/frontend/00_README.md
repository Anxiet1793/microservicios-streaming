# NÉVARO — Plan de frontend, UX y marca

**Versión 0.9 · 17 de octubre de 2026 · Planeamiento previo a implementación**

## Dictamen y alcance

La marca y las decisiones de experiencia están listas como propuesta revisable. La integración es **condicional**: no se recibió un repositorio ni los YAML de OpenAPI. No se ejecutó el backend. Por tanto, este paquete no acredita una auditoría de código ni una integración probada.

Se leyó íntegramente `ARQUITECTURA_DATOS_Y_APIS(1).md` (documento técnico del proyecto, 414 líneas, actualizado el 14/10/2026). En adelante, **S1**. Los endpoints que se muestran proceden de S1; no se han inventado como contratos existentes. La instrucción adjunta `Texto pegado(8).txt` se denomina **S0** y define objetivos, no evidencia de implementación.

Evidencia: **D** = documentado en S1, pendiente de código/OpenAPI; **P** = propuesta de diseño o contrato nuevo; **NV** = no verificable con las fuentes disponibles; **V** = contrastado con código, OpenAPI y ejecución. No hay capacidades V en esta entrega.

En el workspace solo estaba S0. Las búsquedas de repositorios conectados por `streaming` y `microservicios` no devolvieron resultados; no demuestran que el repositorio no exista. La búsqueda de documentación sí permitió recuperar S1. No se pidió acceso a cuentas ni se modificó backend.

## Decisiones principales

- Marca provisional: **NÉVARO**, pronunciación NÉ-va-ro. Tagline: «Tu próxima historia empieza aquí». Naming creativo, sin disponibilidad comercial o registral verificada.
- Dirección: sala de cine editorial; fondo tinta, tipografía marfil, señal de reproducción ámbar y apoyo azul. Identidad expresada mediante composición y jerarquía, no con efectos.
- Arquitectura propuesta: Next.js App Router, React, TypeScript, CSS Modules + tokens CSS, TanStack Query, React Hook Form + Zod, Lucide y Radix selectivo. Next actúa como BFF acotado.
- P0: autenticación, catálogo, detalle, player y retomar progreso. Mi Lista y LIKE completan el recorrido de 5 minutos.
- No se incluyen frontend implementado, logo final, algoritmos de recomendación, pago, DRM, transcodificación ni episodios ficticios.

## Cómo leer y usar

| Archivo | Decisión que resuelve |
|---|---|
| CURRENT_BACKEND_CAPABILITIES.md | Capacidades documentadas y validación pendiente |
| 01_PRODUCT_VISION.md | Producto, alcance y prioridades |
| 02_BRAND_GUIDELINES.md | Naming, voz, color, tipografía y logo conceptual |
| 03_DESIGN_TOKENS.md | Valores normativos del diseño |
| 04_DESIGN_SYSTEM.md | Contratos de componentes |
| 05_INFORMATION_ARCHITECTURE.md | Rutas y permisos |
| 06_SCREEN_SPECIFICATIONS.md | Comportamiento de todas las pantallas |
| 07_UX_FLOWS.md | Auth, preferencias, reproducción y publicación |
| 08_FRONTEND_ARCHITECTURE.md | Rendering, estado, seguridad y rendimiento |
| 09_API_INTEGRATION_MATRIX.md | Operaciones documentadas y campos por verificar |
| 10_BACKEND_GAPS.md | Brechas confirmadas por S1 y preguntas abiertas |
| 11_FRONTEND_ROADMAP.md | Secuencia, dependencias y aceptación |
| 12_DEMO_EXPERIENCE.md | Guiones de 3, 5 y 8 minutos |
| 13_IMPLEMENTATION_GUIDE.md | Instrucciones para el agente implementador |
| 14_WIREFRAMES.md | Layouts textuales medidos |
| 15_ACCESSIBILITY.md | Criterios AA y validación manual |
| 16_TEST_STRATEGY.md | Pruebas por riesgo |
| 17_SOURCES_AND_DECISIONS.md | Fuentes, ADR y preguntas de cierre |

Se usa la numeración final solicitada como nombre canónico; no se duplican documentos con los nombres intermedios de S0. `frontend/src/styles/tokens.css` es una especificación conceptual utilizable, no una aplicación.

## Puerta de integración

Antes de implementar conexiones: entregar URL/ZIP del repositorio y rama, revisar AGENTS/README/Compose y los tres OpenAPI, fijar SHA, generar matriz con operationId, DTO, cookie/CSRF, status y ejemplos reales. Resolver G01 (asociación de assets) solo si se quiere reemplazar el video de un título existente. La alternativa documentada es importar un título nuevo con el asset ya cargado. Probar red del navegador hacia MinIO: es una dependencia P0.

## Resumen visual de Home y player

Home: navegación superior → hero moderado con título, sinopsis y acción principal → continuar viendo → películas → series como fichas → Mi Lista. Los carriles de recomendaciones solo aparecen con servicio real habilitado.

Player: barra de regreso/título → video 16:9 centrado → línea de tiempo → reproducción, volumen, tiempo y pantalla completa. Al fallar el guardado, se informa sin interrumpir innecesariamente el video.

Primer paso de Codex tras aprobar diseño: **cerrar la auditoría de contratos y demostrar por HTTP login → sesión → URL reproducible → pausa → nuevo inicio con progreso recuperado**, antes de construir Home. Este paso evita que una interfaz terminada quede bloqueada por integración.
