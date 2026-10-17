# Visión del producto

## Propósito y propuesta

NÉVARO permite descubrir títulos, guardar lo que interesa y retomar una película sin perder el punto de reproducción. Para el MVP, muestra con claridad cómo identidad, catálogo y reproducción cooperan sin compartir bases de datos.

Audiencia primaria: personas hispanohablantes que navegan desde laptop o móvil y alternan entre explorar y continuar. Audiencia de demostración: docente y compañeros que necesitan ver un recorrido verificable en pocos minutos. Son hipótesis de producto, no resultados de investigación con usuarios.

La personalidad es serena, editorial y precisa. Diferenciación: navegación contenida, progreso visible, señales explícitas de gusto y una identidad cálida sobre tinta azul. No se promete un catálogo comercial completo ni derechos sobre películas ajenas.

## Cinco principios de experiencia

1. **La próxima acción se entiende de un vistazo.** Una sola acción primaria por región; el resto tiene menor jerarquía.
2. **El progreso pertenece a la cuenta.** Retomar conserva contexto entre rutas y sesiones cuando el servicio lo confirme.
3. **Cada promesa tiene respaldo.** Un título sin video se puede explorar y guardar; nunca ofrece un Play que no funcionará.
4. **El espectador decide.** Sin previews automáticos, likes inducidos ni búsqueda invasiva.
5. **Los fallos tienen una salida.** Cada error conserva contexto y ofrece reintentar, volver o iniciar sesión.

## MVP y límites

| Prioridad | Capacidades | Criterio de valor |
|---|---|---|
| P0 | Login/logout/refresh, catálogo y búsqueda básica, detalle, reproducción, pausa, avance, retomar, protección de rutas, recuperación de errores | Recorrido base reproducible sin pérdida de progreso tras confirmación de guardado |
| P1 | Registro, Mi Lista, LIKE/DISLIKE, historial, perfil, upload + importar título nuevo + publicar | Demostrar personalización explícita y operación admin |
| P2 | Filtros avanzados, pantalla central de preferencias, edición editorial, cambio de contraseña, refinamientos de motion | Mejoran uso sin bloquear demo |
| P3 | Recomendaciones reales, episodios, pagos, múltiples perfiles, HLS/DRM, modo claro | Requieren producto/backend adicional |

El flujo admin sube a P0 si la evaluación exige publicación en vivo; no se rebaja el trabajo de reproducción para compensarlo. Recommendations no pasa a P0 por desear una sección atractiva.

## Métricas y validación propuesta

- Usuario encuentra un título y llega al player en <=3 acciones desde Home con título visible.
- Retomar, tras pausa confirmada, comienza a <=2 s del último punto guardado en condiciones nominales.
- 5 de 5 ensayos de demo base completos sin error bloqueante antes de exponer.
- Prueba con tres compañeros: encontrar título, guardarlo y retomarlo sin explicación; registrar tiempo, confusión y errores. No afirmar eficacia estadística.
- Preguntas pendientes: ¿qué campos tiene la importación real?, ¿qué dispositivos se usarán?, ¿en qué red se ejecuta MinIO?, ¿fecha y criterios de evaluación?

Home no necesita landing de marketing en MVP. `/` redirige a Inicio o Login según sesión. Toda decisión técnica posterior debe proteger el recorrido P0.
