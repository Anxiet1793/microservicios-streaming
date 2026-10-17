# Experiencia de exposición

## Condiciones reales de demostración

Los guiones siguientes son objetivos de producto, no una demo ya implementada. Requieren verificación de contratos y UI futura. No mostrar recomendaciones que cambian si no existe servicio. No ejecutar subida larga como paso obligado del guion corto.

## Preparación de datos y cuentas

- Crear cuenta USER y ADMIN por procedimiento autorizado del backend; el registro público no otorga ADMIN. Credenciales en gestor local de presentación, no documentación/repositorio ni pantalla.
- Demo USER sin estado previo del título principal; preparar otro título con progreso 35–60% y uno finalizado para enseñar diferencias. No usar 89–91%, porque el umbral de continuar puede confundir.
- Catálogo propuesto: 12 películas y 4 series con metadata/posters permitidos; 3 películas con MP4 propios o libres verificadas. Series como fichas explícitamente sin episodios. Incluir un título sin imagen y otro sin disponibilidad solo para QA, no hero de exposición.
- Hero por tituloId en configuración, con video real. Título de exposición: «Detrás de NÉVARO — Equipo de Arquitectura», clip propio corto de 30–60 s, H.264/AAC y preferiblemente <15 MiB. Metadatos coherentes con duración obtenida.
- Cuenta demo USER y perfil admin separados; usar dos perfiles de navegador o sesión aislada para evitar mezclar cache. Reloj del host correcto para firmas. Autocompletar sin proyectar credenciales.
- Health de servicios, JWKS, replica set, MinIO y bucket verificados; acceder desde la misma máquina/red que el día de clase. Tener backup local del MP4 y guion. No mostrar consola MinIO con secretos.

## Guion de 3 minutos — núcleo P0

| Tiempo | Acción en pantalla | Lo que demuestra |
|---|---|---|
| 0:00–0:20 | Login USER | Identidad y sesión |
| 0:20–0:45 | Home y búsqueda de título principal | Catálogo y navegación |
| 0:45–1:00 | Ficha y metadata | Contrato editorial |
| 1:00–1:35 | Reproducir, avanzar a 00:25 y pausar | Sesión y avance real; esperar guardado |
| 1:35–2:00 | Volver Home y carril Continuar | Estado recuperado de Playback |
| 2:00–2:35 | Retomar desde ~00:25 | Persistencia entre pantallas |
| 2:35–3:00 | Salir del player, mostrar historial si listo y cerrar sesión | Historial P1 opcional; cierre seguro |

No depender de una frase hablada durante video para rellenar latencia; el presentador explica mientras carga la ficha. Si Historial no entra en alcance P0, reservar últimos 25 s para explicar separación de servicios.

## Guion de 5 minutos — experiencia completa del espectador

| Tiempo | Acción | Evidencia |
|---|---|---|
| 0:00–0:25 | Login | Cuenta real |
| 0:25–1:00 | Home, Explorar, ficha | Identidad visual y catálogo |
| 1:00–1:35 | Agregar Mi Lista y LIKE; abrir Mi Lista | Estado persistente, no solo feedback local |
| 1:35–2:25 | Reproducir, seek a 00:35, pausa confirmada | Media y guardado |
| 2:25–3:00 | Home → Continuar | Consolidación de progreso |
| 3:00–3:35 | Retomar y pausar | Mismo punto aproximado |
| 3:35–4:15 | Logout y login de la misma cuenta | Progreso asociado a cuenta, no estado React |
| 4:15–4:40 | Continuar e Historial | Persistencia de backend |
| 4:40–5:00 | Explicar señales de gustos y futuro Recommendation | Alcance honesto, sin carril fingido |

## Guion de 8 minutos — espectador + administración

| Tiempo | Acción | Evidencia |
|---|---|---|
| 0:00–0:30 | Login y Home | Presentación producto |
| 0:30–1:10 | Detalle, Mi Lista y LIKE | APIs Users/Catalog |
| 1:10–2:10 | Reproducir, seek y pausa | Sesión Playback/MinIO |
| 2:10–2:50 | Home, retomar y salir | Progreso consolidado |
| 2:50–3:20 | Historial | Última reproducción por título |
| 3:20–3:45 | Cambiar a sesión ADMIN aislada | RBAC |
| 3:45–4:45 | Upload del clip corto preparado | Transferencia y metadata reales |
| 4:45–5:35 | Completar ficha nueva con assetId devuelto | Asociación por importación soportada |
| 5:35–6:00 | Publicar y verificar estado | Ciclo editorial |
| 6:00–6:35 | Volver USER, refrescar catálogo | Visibilidad nueva |
| 6:35–7:20 | Reproducir video del equipo | Flujo vertical completo |
| 7:20–8:00 | Explicar microservicios y limitaciones actuales | Evidencia técnica sin pantallas sensibles |

Si Recommendation real existe y fue ensayado, sustituir los últimos 40 s por carril con razón. No afirmar que un LIKE modifica sugerencias instantáneamente sin latencia/pipeline comprobado.

## Riesgos y plan B

| Riesgo | Preparación | Recuperación durante demo |
|---|---|---|
| Upload tarda más de 60 s | Archivo pequeño y 2 ensayos en red real | Usar asset precargado identificado como tal, continuar publicación |
| URL inaccesible | Probar hostname firmado y seek desde proyector | Regresar al título de respaldo ya probado; no modificar firma manualmente |
| Users/refresh falla | Ensayar cookie y vida sesión | Re-login; no alternar 10 veces ni exponer tokens |
| Estado contaminado por ensayo | Seed/limpieza por APIs antes de comenzar | Usar cuenta limpia de respaldo, sin borrar BD en vivo |
| No aparece continuar | Progreso muy por debajo 90%, pausa confirmada | Abrir Historial y explicar estado; no insertar datos desde consola |
| Publicación falla | Ficha/importKey y asset READY preparados | Mostrar título nuevo de respaldo y explicar que fue precargado |

No hacer en vivo: cargar el video completo de la exposición aún en curso, generar claves JWT, migrar bases, reiniciar todos los contenedores, borrar volúmenes, añadir episodios sin API, depender de póster externo sin fallback ni abrir `.env`.

## Ensayo y evidencia

Checklist de salida: login correcto, ficha publicada, video con audio, seek real, pause confirmada, retomar tras logout, historial, ADMIN autorizado y USER rechazado, publicación visible, archivo de respaldo y cronómetro. Registrar duración real de cada segmento; si el ensayo supera presupuesto, recortar narración/filtros antes que saltar la confirmación de guardado.
