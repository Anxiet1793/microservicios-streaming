# Exposición de extremo a extremo

Usar un MP4 propio, H.264 con audio AAC opcional, preferiblemente de más de 60 segundos. No se incluye contenido con copyright ni se descarga video externo. El E2E genera un clip sintético azul para comprobar bytes y Range.

## Preparar servicios

En cada carpeta levantar su Compose. En Users ejecutar su setup y seed de desarrollo si aún no existen. El seed crea admin@streaming.local y demo@streaming.local; password aleatorio en la variable local SEED_PASSWORD. No se agrega una contraseña pública a esta guía.

```powershell
cd ..\users-service
docker compose up -d --wait
docker compose exec -T users-service node dist/seed.mjs
cd ..\catalog-service
docker compose up -d --wait
cd ..\playback-service
npm ci
npm run dev:setup
docker compose up --build -d --wait
node --import tsx scripts/prepare-demo.ts "C:\Videos\exposicion.mp4"
```

El helper se limita a localhost y exige APP_ENV=development de Users. Inicia sesión ADMIN mediante HTTP sin imprimir password/token, sube el archivo, obtiene assetId, crea una película de demostración por Catalog API y la publica. Guarda solo IDs y enlace del reproductor en `docs/demo-local.json`. Cada ejecución crea otro recurso/título; usar conscientemente. Si se interrumpe, revisar el asset subido antes de repetir.

**Límite del contrato existente:** Catalog solo asigna playbackReference al crear. No permite cambiarla en un título ya existente. La demo crea un título después de subir el asset; no modifica MongoDB de Catalog. Reasignar películas ya importadas exige ampliar Catalog mediante su API en una tarea propia.

## Flujo manual con CURL (Bash/Git Bash + jq)

```bash
read -rsp 'Password del seed local: ' PASSWORD; echo
ADMIN_TOKEN=$(jq -n --arg p "$PASSWORD" '{email:"admin@streaming.local",password:$p}' |
  curl -sS http://localhost:3001/api/v1/auth/login -H 'Content-Type: application/json' --data-binary @- | jq -r .accessToken)

ASSET_ID=$(curl -sS -X POST http://localhost:3002/api/v1/media/assets \
  -H "Authorization: Bearer $ADMIN_TOKEN" -F 'file=@exposicion.mp4;type=video/mp4' | jq -r .asset.assetId)

TITULO_ID=$(jq -n --arg a "$ASSET_ID" '{items:[{
  importKey:("exposicion-"+$a),typeId:1,
  ficha:{title:"Exposición académica",synopsis:"Video propio para la demostración.",releaseYear:2026,genres:[10],languages:[1],durationMinutes:2},
  playbackReference:{providerId:1,assetId:$a,manifestKey:("asset:"+$a)}
}]}' | curl -sS http://localhost:3000/api/v1/catalog/bulk \
  -H 'Content-Type: application/json' --data-binary @- | jq -r '.results[0].tituloId')

curl -sS -X PATCH "http://localhost:3000/api/v1/catalog/$TITULO_ID/publication-status" \
  -H 'Content-Type: application/json' -d '{"publicationStatusId":2}'

USER_TOKEN=$(jq -n --arg p "$PASSWORD" '{email:"demo@streaming.local",password:$p}' |
  curl -sS http://localhost:3001/api/v1/auth/login -H 'Content-Type: application/json' --data-binary @- | jq -r .accessToken)
unset PASSWORD

START=$(curl -sS -X POST http://localhost:3002/api/v1/playback/sessions \
  -H "Authorization: Bearer $USER_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"tituloId\":\"$TITULO_ID\"}")
SESSION_ID=$(printf '%s' "$START" | jq -r .session.sessionId)
```

Catalog aún conserva su API de administración local sin JWT; este servicio no cambia su seguridad. `durationMinutes` es editorial y debe ajustarse a tu película; la duración de reproducción se obtiene de ffprobe.

Para reproducir visualmente, abrir `http://localhost:3002/demo.html`, introducir un accessToken USER vigente y tituloId. Obtener el token desde la respuesta de login en tu cliente REST; no publicarlo ni guardar capturas que lo muestren. El input del reproductor lo oculta y lo conserva solo en memoria. El helper no lo imprime ni guarda.

## Demostrar continuidad

1. Pulsar Reproducir y dejar avanzar 30 segundos.
2. Pausar con los controles del video. Comprobar que el request pause termina antes de cerrar.
3. Cerrar la página y volver a abrir demo.html.
4. Introducir otra vez el accessToken (o hacer login si venció), pulsar Continuar viendo / Historial.
5. El título aparece con aproximadamente 30 s; pulsar Abrir.
6. Se crea nueva sesión y currentTime se restaura después de loadedmetadata.
7. Terminar el video. El evento ended llama complete y se excluye de Continuar viendo.
8. Historial muestra Completado. Si se reproduce nuevamente, empieza en cero.

La posición enviada cada 10 s y en pause reduce pérdida. pagehide con fetch keepalive es un último intento, no una garantía ante cierre abrupto/red caída. Puede perderse el intervalo aún no confirmado.

Los nueve CURL de [README](../README.md#curl) permiten hacer progreso/pause/resume/complete/continue/history sin UI. Para verificar búsqueda del video, usar Range sobre playback.url (no guardar esa URL en logs): se espera 206, Content-Range y bytes MP4.

## Mostrar el outbox

Solo consultar la base **propia de Playback** en la exposición:

```powershell
docker compose exec -T mongodb mongosh playback_service --quiet --eval 'db.outbox_events.find({eventType:"PLAYBACK_COMPLETED"},{_id:0,eventId:1,eventType:1,version:1,occurredAt:1,userId:1,tituloId:1,data:1,deliveryStatus:1}).sort({occurredAt:-1}).limit(5).toArray()'
```

La repetición de complete no crea otro evento. PENDING significa almacenado para despacho futuro; no afirmar que Recommendations ya lo recibió. watchTimeSeconds=null expresa que no medimos tiempo visto fiable.

## Si algo falla

- 401: renovar login; JWT de Users debe tener issuer/audience configurados.
- 403: usuario ajeno, falta ADMIN o Origin distinto de APP_ORIGIN.
- 409 TITLE_NOT_PUBLISHED: publicar mediante Catalog API.
- 404 MEDIA_ASSET_NOT_FOUND: comprobar assetId/READY y asociación; no usar antiguos IDs de otro proveedor.
- 415: contenedor/codec no admitido o multipart incorrecto; convertir tu archivo a MP4 H.264/AAC fuera del servicio.
- 503 Catalog: comprobar Catalog 3000 y acceso host.docker.internal desde Docker.
- URL que apunta al equipo equivocado: ajustar MINIO_PUBLIC_URL antes de generar nuevas firmas.

No copiar bases ni resolver asociaciones escribiendo directamente en Catalog/Users.
