# Integración del frontend

Ejemplo ejecutable: [public/demo.html](../public/demo.html), servido en http://localhost:3002/demo.html. No es una plataforma frontend completa: permite validar un MP4 real, pausa/reanudación, continuidad e historial sin agregar otro microservicio.

## Secuencia mínima HTML5

```html
<video id="player" controls playsinline preload="metadata"></video>
```

```javascript
const response = await fetch('/api/v1/playback/sessions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ tituloId })
});
if (!response.ok) throw new Error('No se pudo iniciar');
const { session, playback } = await response.json();
const video = document.querySelector('#player');
video.src = playback.url;
video.addEventListener('loadedmetadata', () => {
  video.currentTime = session.progress.positionSeconds;
}, { once: true });
// Iniciar play mediante interacción del usuario para respetar políticas de autoplay.
```

Access token de Users en memoria. Refresh de autenticación pertenece a Users y debe conservar su cookie HttpOnly y protección CSRF; Playback no emite ni renueva JWT. Ante 401 renovar por Users o iniciar sesión y repetir lo seguro. El demo pide pegar otro token, no almacena credenciales en localStorage.

Guardar `{positionSeconds: video.currentTime}` cada 10–15 s mientras reproduce, y al pausar. No enviar durationSeconds, percentage ni userId. Porcentaje/duración son del servidor. Serializar peticiones para evitar que una posición antigua llegue después de una nueva; no usar máximos porque retroceder es válido. Reintentos del mismo PATCH son idempotentes.

Pause con posición actual; resume devuelve URL nueva. La demo renueva la URL periódicamente antes de vencer mediante refresh-url; restaura currentTime y estado play/pause cuando cambia src. Suspende handlers durante ese cambio para evitar pausas artificiales. No registrar playback.url ni enviarla a analytics.

En ended llamar complete y refrescar listas; idempotencia impide eventos repetidos. Usar pagehide + fetch keepalive para último progreso: sendBeacon no permite el header Bearer y no se usa. El envío al cerrar es best effort; sin conexión no se garantiza el último intervalo.

Continuar viendo e historial devuelven tituloId/progreso/estado; el frontend final compone esas referencias con Catalog API para título/poster. La demo muestra IDs para no inventar metadata ni duplicarla en Playback. Nuevas sesiones reemplazan la anterior del mismo usuario/título: ante SESSION_SUPERSEDED detener ese reproductor y ofrecer abrir una sesión nueva.

## Video y CORS

El elemento video accede directamente a MinIO con URL firmada y soporta solicitudes Range; no proxy de bytes por Next. No necesita header Authorization en ese request S3. La demo no pone atributo crossorigin ni procesa video en canvas. Para fetch/canvas cross-origin u otro frontend, configurar CORS del bucket y APP_ORIGIN deliberadamente. API permite preflight Authorization/Content-Type solo al origen configurado.

El perfil admitido es MP4 H.264 con AAC opcional; preparar archivos con faststart facilita arranque progresivo (el servidor no reorganiza MP4). ffprobe valida metadata, no decodifica cada frame ni garantiza ausencia de corrupción en todo el archivo. No hay streaming adaptativo, HLS ni DRM. La URL dura 900 s por defecto; el JWT tiene su propio vencimiento.
