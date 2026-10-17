# Demo de NÉVARO

## Preparación

1. Habilitar WSL y abrir Docker Desktop. No borrar volúmenes.
2. Ejecutar `frontend/scripts/start.ps1` desde PowerShell. Abrir http://localhost:3003.
3. Tener la contraseña del seed local de Users para admin@streaming.local y demo@streaming.local, o registrar una cuenta de espectador.
4. Tener un MP4 propio H.264/AAC de más de 30 s para el ensayo de publicación. Las pruebas automáticas usan un clip sintético del proyecto.
5. Comprobar que MinIO 9000 es alcanzable desde el mismo navegador. Si se usa otro dispositivo, configurar su dirección pública en Playback antes de generar URLs y reconstruir frontend con MEDIA_ORIGIN correspondiente.

## Recorrido de tres minutos

1. Iniciar sesión como espectador. Inicio muestra títulos realmente publicados.
2. Abrir una ficha desde Explorar o Buscar; revisar sinopsis, género y disponibilidad.
3. Agregar a Mi Lista. Marcar Me gusta y cambiar a No me gusta; solo uno permanece activo.
4. Abrir Reproducir, pulsar Preparar reproducción y luego Reproducir. El video no empieza automáticamente con sonido.
5. Avanzar o dejar reproducir hasta 25–30 s. Pausar y esperar «Pausa y avance guardados».
6. Volver a la ficha y a Inicio. Abrir Continuar desde el punto guardado; preparar el video y comprobar el tiempo recuperado.
7. Cerrar sesión desde Perfil y volver a entrar con la misma cuenta; Mi Lista y el progreso siguen asociados a ella.

## Publicar un video en cinco minutos

1. Iniciar sesión como ADMIN y abrir Perfil → Administrar contenido → Subir video.
2. Seleccionar MP4 y pulsar Subir video. La barra indica bytes enviados; después aparece validación real.
3. Esperar metadata confirmada; revisar duración, codec y resolución.
4. Completar título, sinopsis, año, géneros, idiomas y duración editorial. Las imágenes son opcionales.
5. Crear ficha; se conserva importKey por intento para no duplicar ante un retry.
6. Publicar título. La comprobación server-side exige asset READY para películas.
7. Abrir Ver la ficha y reproducir. Repetir desde una cuenta USER para demostrar que el contenido quedó disponible.

El flujo crea un título nuevo. La API de Catalog no permite reemplazar la referencia de un título existente. Si falla la creación de ficha, conservar el assetId confirmado y retomar en la misma pestaña; no repetir upload a ciegas.

## Cierre y estados a explicar

- Terminar el video confirma complete; Historial refleja la última reproducción por título y Continuar viendo lo excluye.
- Abrir el mismo título en dos reproductores reemplaza la sesión anterior; el primer player detiene escrituras cuando lo detecta.
- Series tienen ficha, pero no botón de reproducción sin episodios.
- Los gustos quedan almacenados; Recommendations no está implementado y no se muestran carriles ficticios.
- Las URLs firmadas vencen independientemente del JWT. Se renuevan preservando tiempo/pausa.
- Cerrar una pestaña abruptamente puede perder el último intervalo no confirmado; el guardado en pause es la evidencia para la exposición.

No mostrar contraseñas, cookies, JWT ni URLs firmadas en capturas/reportes. El reproductor no requiere pegarlas manualmente.
