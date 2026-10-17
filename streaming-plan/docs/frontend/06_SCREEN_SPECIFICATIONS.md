# Especificaciones de pantallas

**Dependencia documental:** todas las llamadas de servicio se indican mediante operaciones de 09. Los DTO exactos aún no se conocen. La política común es carga regional con skeleton, error regional con reintento y nunca convertir un fallo en lista vacía.

## Rejilla responsive normativa

| Elemento | Desktop >=1280 | Laptop 1024–1279 | Tablet 768–1023 | Móvil <768 |
|---|---|---|---|---|
| Márgenes | 64; max 1600 | 40 | 32 | 16 |
| Navegación | Superior 72 | Superior 72 | Superior 64, menos links | Header 56 + bottom 64/safe-area |
| Posters explorar | 6 columnas | 5 | 4 | 2; 3 solo si ancho/legibilidad lo permiten |
| Landscape en carril | 4 visibles aprox. | 3 | 2 | 1 + fracción siguiente |
| Hero | 480 alto; texto <=560 | 420 | 360 | Imagen 16:9 y texto debajo; sin alto fijo total |
| Detalle | Ficha en dos zonas | Dos zonas | Poster reducido | Columna única |
| Modal | <=640 | <=640 | 80vw máx 640 | Drawer ancho completo |
| Admin | Sidebar 224 + contenido | Sidebar 200 | Menú desplegable | Steps verticales y cards |
| Player | Video con letterbox, controles completos | Igual | Botones 44 | playsInline, controles visibles al tocar |

Counts son objetivos para anchos representativos; a 320 px mantener 2 posters solo si ancho >=128 tras gaps, en otro caso una columna. No overflow horizontal de página; carriles son los únicos contenedores con desplazamiento horizontal intencional.

## 1. Login — /login

Objetivo: recuperar sesión y contexto. Contenido: marca, «Vuelve a tus historias», email, clave, mostrar clave, botón Entrar, link Crear cuenta. Componentes Input/PasswordInput/Button/ErrorState. API U02; U03 para restauración solo si corresponde.

Loading: botón Entrando…, no borrar campos. Empty: formulario inicial sin error. Error: credenciales genéricas sin revelar si existe correo; caída Users permite reintento. Desktop formulario <=440 centrado con fondo editorial discreto; tablet mantiene ancho; mobile márgenes 16 y sin bottom nav. Interacción: Enter envía una sola vez. Edges: pegar contraseña, gestor de contraseñas, 429 con espera orientativa, retorno local validado, cookie bloqueada y sesión ya activa. No «Olvidé mi contraseña» si no hay flujo backend.

## 2. Registro — /register

Objetivo: cuenta USER. Nombre visible, email, contraseña y ayuda de reglas solo cuando se verifiquen. API U01. No selector de rol. Loading submit bloqueado; empty es formulario inicial. Errores por campo si contrato los ofrece y resumen accesible al enviar. Confirmación remite a login, salvo autenticación automática verificada. Desktop/tablet <=440, mobile una columna. Edges: email duplicado, password inválida, timeout con resultado desconocido: sugerir intentar login antes de reenviar sin control.

## 3. Home — /home

Objetivo: elegir o retomar en segundos. Navbar, HeroBanner, MediaRow, ContinueWatchingCard, PosterCard, WatchlistButton. API C01/C02, P08, U08; componer fichas sin N+1 ilimitado.

Orden inicial: hero editorial documentado en configuración por tituloId → Continuar viendo si hay datos → Películas → Series como fichas → Mi Lista si hay datos. Sin referencias válidas para hero: escoger una ficha publicada de la respuesta actual sin atribuir popularidad; no inventar un ranking. Si no hay contenido reproducible, CTA Ver detalles y aviso correspondiente.

Loading: HeroSkeleton + MediaRowSkeleton con alturas reservadas. Empty: catálogo realmente vacío muestra Explorar y explicación; continuar vacío se omite y se ofrece enlace desde Perfil. Error: Catalog deja shell y aviso; Playback caído afecta solo continuar; Users caído deshabilita acciones personales temporalmente sin borrar estado. Desktop hero moderado y primer carril visible a 900 px de alto; laptop reduce padding; tablet dos landscape; mobile hero imagen seguida por texto y botones apilados. Edges: título retirado, imagen faltante, referencias huérfanas, ficha de serie destacada, logout concurrente.

**No mostrar hoy sin respaldo:** «Porque viste», «Recomendados», «Populares» o «Agregados recientemente» con orden asumido. Futuro: descriptor de carril `{kind, heading, items, reason}`; source real desde Recommendation, sin algoritmo local.

## 4. Explorar — /explore

Objetivo: navegar catálogo. Heading, tabs Todos/Películas/Series, filtros y poster grid, paginación explícita. API C01 con status publicado en espacio consumidor. El BFF impide usar query para revelar borradores.

Loading conserva altura; empty «No encontramos títulos con esos filtros», Limpiar filtros. Error conserva filtros. Desktop filtros en fila, tablet wrap, mobile drawer con Aplicar/Limpiar y conteo de filtros; URL es estado canónico. Edges: página fuera de rango, query inválida normalizada, filtros sin diccionario de géneros (solo opciones documentadas), respuesta anterior llega tarde. No descargar catálogo completo para buscar.

## 5. Buscar — /search?q=

Objetivo: encontrar por título. SearchInput, contador si total real, grid y paginación C01 con q. Debounce 300 ms; Enter fuerza búsqueda. Loading mantiene resultados previos con etiqueta Actualizando, no flash vacío. Empty sin query: «Busca una película o serie»; query sin resultados: citar término escapado y cambiar búsqueda. Error conserva término. Desktop campo <=720, tablet amplio, mobile foco solo al abrir desde búsqueda explícita. Edges: texto con acentos, espacios, back/forward, abort, queries largas: límite de contrato, no inventado.

## 6. Detalle — /title/[tituloId]

Objetivo: decidir ver/guardar/opinar. Backdrop + título, año, tipo, edad, duración si película, géneros, sinopsis, reparto, director e idiomas solo si presentes. APIs C02, U08/U11 paginadas para estado personal, P09/P08 si hace falta progreso disponible.

Acciones: Reproducir o Continuar desde mm:ss; Mi Lista; Me gusta/No me gusta. Estado de preferencia desconocido muestra controles pendientes, no neutral falso. Ficha no necesita esperar preferencias para renderizar. Loading DetailSkeleton. Empty no aplica como ficha: 404 es NotFound; serie sin episodios presenta texto específico. Error Catalog con Volver/Reintentar. Desktop backdrop y texto alineados al gutter, metadata secundaria abajo; tablet reduce poster; mobile stack y botones táctiles. Edges: withdrawn impide Play; asset eliminado se comunica tras verificación; sin imagen fallback; sin video no CTA activo; ausencia de director no deja label vacío. No exponer manifestKey/bucket en UI.

## 7. Reproductor — /watch/[tituloId]

Objetivo: reproducción y progreso fiables. Shell mínimo, back a detalle, título, video, controles, indicador discreto de sincronización. APIs P01–P06; consulta detalle C02 si aún no está cargado.

Loading: rectángulo negro 16:9 + texto Preparando video. Buffering solo spinner local pequeño después de espera perceptible; no recrear sesión. Empty: no existe video reproducible → detalle. Error URL expirada: renovar una vez conservando currentTime y estado pausado; fallo definitivo ofrece Reintentar/Volver. No silenciar error de progreso: «No pudimos guardar tu avance», separado del media error.

Desktop admite fullscreen por gesto; tablet toca controles; mobile playsInline, safe-area y fullscreen nativo cuando corresponda. No forzar autoplay; si play() es rechazado, mostrar Reproducir. Edges: metadata tardía, duration NaN, seek antes de ready, desconexión, rango HTTP 206, pestaña duplicada/superseded, 401 vs error del storage, expiración durante pausa, cambio de asset, ended y logout. Máquina completa en 07.

## 8. Mi Lista — /my-list

Objetivo: guardar para después y retirar. U08/U09/U10 + C02 por IDs con concurrencia máxima 4 y cache; sin batch documentado no inventarlo. Grid posters o CompactCard si faltan imágenes. Orden de referencia se conserva.

Loading skeleton; empty «Guarda algo para después» + Explorar. Error Users conserva lo conocido e impide mutaciones sin certeza; Catalog parcial deja referencia identificable con acción quitar si Users funciona. Desktop 6/5 posters, tablet 4, mobile 2 o lista compacta. Interacción quitar optimista conserva espacio hasta resultado, rollback si falla. Edges: retirar último de página, título eliminado, duplicados, respuesta vieja, fallo de hidratación de fichas y dos clicks rápidos.

## 9. Continuar viendo — /continue-watching

Objetivo: retomar pendientes. API P08 + C02. Cards landscape, posición textual y progreso. Loading placeholders 16:9; empty «Todavía no tienes historias pendientes» + Explorar; error Playback Reintentar sin inferir finalización. Desktop/laptop 3 columnas, tablet 2, mobile 1. Click crea nueva sesión y usa posición autoritativa devuelta, no query editable. Edges: >=90% ya no aparece por semántica S1, duración desconocida oculta %, item retirado desactiva Play, avance cambió en otra pestaña revalidar.

## 10. Historial — /history

Objetivo: revisar último consumo por título. P09 + C02; CompactCard, fecha local del usuario, estado y acción detalle/retomar. No describir como registro de todas las sesiones: S1 expone última reproducción por título. Loading filas; empty «Tu historial empieza con tu primera reproducción»; error conserva lista cacheada etiquetada. Desktop tabla/lista editorial, tablet filas compactas, mobile cards. Edges: timestamps ausentes se omiten; título huérfano; no botón Borrar historial, sin endpoint.

## 11. Perfil — /profile

Objetivo: identidad e idioma. U05/U06 y U07 si fase habilitada. Avatar por URL o iniciales; nombre, correo solo lectura si no editable, idioma según valores reales. Guardar explícito; sin avatar upload fingido. Loading ProfileSkeleton; empty perfil inválido deriva a error y no crea otro en cliente. Error inline conserva cambios. Desktop formulario <=640 y panel sesión; tablet misma lógica; mobile una columna y links a Historial/Continuar/Preferencias. Edges: cambios sin guardar avisan al navegar; password revoca sesión, volver a login; idioma no promete audio alternativo.

## 12. Preferencias — /preferences (P2)

Objetivo: revisar/retirar señales. U11/U12/U13 + fichas Catalog. Tabs Me gusta/No me gusta; acciones cambiar o quitar. Loading filas; empty «Cuéntanos qué te gusta desde la ficha de un título»; error no convierte en neutral. Desktop lista en dos zonas, tablet/mobile una columna. Edges: paginación necesaria para encontrar estado por título, referencias eliminadas, sin Recommendation activo: explicar que las señales quedan guardadas, sin prometer cambios automáticos visibles.

## 13. Administración de contenido — /admin/content

Objetivo: ver catálogo y estado, acceso Subir video. Dashboard simple integrado: no inventar métricas de reproducciones/ingresos. C01 admin con filtros reales, C03/C04/C05 donde corresponda. Tabla título/tipo/estado/acciones; conteo solo si total real. Loading filas; empty catálogo inicial con importar/cargar; error protegido evita mostrar datos antiguos como recién publicados.

Desktop sidebar + tabla, tablet columnas esenciales, mobile cards de contenido. Editar ficha y publicar solo con ADMIN validado en servidor. Edges: estado irreversible, conflicto versionado, título retirado, APIs Catalog sin auth, error intermedio no interpreta como publicado. No Delete title sin API documentada.

## 14. Subir video — /admin/upload

Objetivo: MP4 → asset READY → nueva ficha REGISTRADO → PUBLICADO. Stepper de cuatro pasos; P10/P11, C03/C05. Archivo + tamaño, progreso real de bytes si canal lo permite, luego «Validando video» sin porcentaje ficticio, resumen metadata y ficha. AssetId en panel técnico de admin copiable tras éxito; no en consumidor.

Loading en subida con cancelar local y aviso de resultado incierto; empty dropzone + seleccionar con input accesible. Error codec/tamaño muestra regla confirmada; timeout no reintenta POST automáticamente. Desktop archivo/ficha y resumen 2 columnas; tablet ancho completo; mobile pasos verticales, botón pegajoso sin tapar campos. Edges: MP4 contenedor no garantiza códec; ffprobe determina, desconexión después de upload, asset huérfano, import parcial, doble publicar, pérdida de archivo al recargar y 429. Cancelar transferencia no garantiza borrar asset remoto.

No selector «asociar a título existente» habilitado mientras G01 no se resuelva. Camino MVP: título nuevo con importKey nueva; la idempotencia no implica update del asset.

## 15. Crear/editar ficha — dentro de upload o /admin/content/[id]

Objetivo: datos editoriales completos. C03 para nueva ficha con playbackReference; C04 solo ficha existente. Título, sinopsis, año, duración cuando película, tipo, géneros/idiomas IDs válidos, imágenes opcionales. Los campos se ajustan a DTO real, sin inventar catálogo de códigos.

Loading metadata o ficha; empty nueva ficha; errores por campo y resumen. Desktop 2 columnas y preview no interactivo, tablet/mobile 1. Interacción guardar borrador solo si la creación real lo admite; no autosave inventado. Edges: cambiar MOVIE a SERIES no soportado por PATCH editorial, versión concurrente, importKey reutilizada con payload diferente, IDs inexistentes.

## 16. Estado de publicación — diálogo en administración

Objetivo: REGISTRADO → PUBLICADO o PUBLICADO → RETIRADO. C05. Estado actual y destino nombrados; «Publicar título» o «Retirar título». Loading bloquea una mutación; empty no aplica; error conserva diálogo y estado servidor anterior. Dialog desktop/tablet, fullwidth mobile. Edges: repetir mismo estado documentado idempotente; retirar no promete vuelta a PUBLICADO; no ofrecer transición inválida. Verificar existencia del asset como parte del flujo admin antes de publicar aunque Catalog no lo valide.

## Skeletons específicos

HeroSkeleton: bloque 480/420/360 y texto adaptable móvil. MediaRowSkeleton: heading + cards ratio real. MediaCardSkeleton: imagen + dos líneas. DetailSkeleton: backdrop + acciones + metadata. ProfileSkeleton: avatar/campos con alturas fijas. Todos aria-hidden y un único status textual por región; reducir movimiento. Un error regional sustituye solo su skeleton.

## Recuperación común de errores

| Caso | Mensaje | Acción | Fallback |
|---|---|---|---|
| Catalog caído | No pudimos cargar el catálogo. | Reintentar | Shell y contenido cacheado claramente identificado |
| Playback caído | El video no está disponible en este momento. | Reintentar / Volver | Detalle y Mi Lista si servicios responden |
| Users caído | No podemos comprobar tu sesión ahora. | Reintentar | No borrar sesión por un 5xx |
| Video ausente | Este título todavía no tiene video. | Ver otros títulos | Ficha guardable |
| Sesión expirada/401 | Tu sesión venció. Inicia sesión para continuar. | Login con retorno local | Pausar y flush best-effort sin secreto en URL |
| URL expirada | Estamos renovando el acceso al video. | Reintento acotado | Mantener posición y pausa |
| Offline | Parece que estás sin conexión. | Reintentar al volver | Cache de fichas; no fingir sincronización |
| Retirado | Este título ya no está disponible para reproducir. | Explorar | Ficha informativa si política lo permite |
| Asset eliminado | Este video ya no está disponible. | Volver a la ficha | No retry infinito |
| 403 | Tu cuenta no tiene acceso a esta acción. | Volver a Inicio | No refresh repetido |
| 404 | No encontramos ese contenido. | Explorar | No inferir caída global |
| 429 | Hay demasiados intentos. Espera un momento. | Respetar Retry-After si existe | Mantener formulario |
| 500 | Algo no salió como esperábamos. | Reintentar | requestId redactado para soporte |

Los status concretos por operación se verifican con OpenAPI; esta tabla es política de UI, no declaración de respuestas implementadas.
