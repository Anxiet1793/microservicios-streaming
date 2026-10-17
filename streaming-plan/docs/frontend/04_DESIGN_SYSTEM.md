# Sistema de diseño

## Reglas comunes de contrato

Todos los componentes: props TypeScript, clase local por CSS Module, tokens semánticos, contenido en español, sin fetch interno en primitives. Estados comunes: idle, hover cuando exista puntero, focus-visible, disabled y pending si hay acción remota. Pending conserva ancho; disabled explica su motivo cuando no es evidente. Área táctil objetivo 44×44 px; no encoger texto para hacer caber una acción.

A11y transversal: nombre accesible, semántica HTML nativa, tabulación natural, foco visible con outline 2 px + offset 3 px. No hover como único acceso. Callbacks expresan intención (`onWatchlistChange`), no la ruta HTTP. Responsive no cambia el significado de la acción. Cada fila siguiente agrega las particularidades y define uso/no uso.

## Primitives

| Componente | Propósito, variantes y props conceptuales | Estados/comportamiento y accesibilidad | Responsive; usar / evitar |
|---|---|---|---|
| Button | Acción; primary/secondary/ghost/danger; size, pending, onClick | button type explícito, texto estable, aria-busy al esperar | 44 px alto; fullWidth en formularios móviles; no para navegación |
| IconButton | Acción compacta; ghost/filled; label, icon, pressed | aria-label obligatorio; tooltip no reemplaza nombre | 44 px; no para CTA cuya intención sea ambigua |
| Input | Texto/email/url; label, value, error, hint | label/id, aria-describedby, autocomplete; error inline | 100% ancho; no placeholder como etiqueta |
| PasswordInput | Clave + revelar; autocomplete, value | toggle con nombre Mostrar/Ocultar, permite pegar | Sin bloquear gestores; no validación secreta solo color |
| SearchInput | Búsqueda; query, onQueryChange, onSubmit | clear con nombre; debounce 300 ms y abort; Enter inmediato | Expandido en búsqueda móvil; no filtrar toda BD local |
| Select | Tipo/género/idioma; options, value | select nativo para opción simple, etiqueta visible | 100% en drawer móvil; no multiselect custom sin necesidad |
| Checkbox | Consentimiento/opción booleana; checked, label | input checkbox nativo; espacio activa; mixed solo si real | Hit area incluye label; no representar LIKE mutuamente exclusivo |
| Avatar | Identidad; src, name, size | Iniciales si falla; imagen decorativa con alt vacío si nombre contiguo | 32–48 px; no asumir soporte upload de avatar |
| Badge | Metadata; neutral/status; label, icon | Texto complementa color; span, no botón | Wrap; no badge que parezca control |
| Tooltip | Ayuda breve; content, trigger | Hover y focus; Escape cierra; no interactivo | En touch información esencial visible; no instrucciones indispensables |
| Spinner | Espera puntual; label, size | role=status solo si necesario; no duplicar live regions | 16–24 px; no página entera |
| Skeleton | Reserva de layout; shape, count | aria-hidden; contenedor aria-busy | Ratio real; sin shimmer con reduced-motion; no falso contenido |
| Divider | Separar regiones; orientation | hr si temático, decorativo aria-hidden | Margen token; no usar para suplir títulos |

## Contenido y streaming

| Componente | Propósito, variantes y props | Estados/comportamiento y accesibilidad | Responsive; usar / evitar |
|---|---|---|---|
| MediaCard | Base visual; title, image, variant, availability | Un enlace principal al detalle y botones hermanos, nunca anidados | Hover/focus equivalentes; no click global con botones dentro |
| PosterCard | Explorar cine; 2:3; title, metadata | Título visible bajo imagen, sin truncar su nombre accesible | Ancho min 128; dos columnas móvil; no progreso sobre póster |
| LandscapeCard | Carril compacto; 16:9; title, info | Detalle primario; imagen y nombre sin doble tab innecesario | Min 240 desktop/260 mobile; no mosaico genérico en todas las secciones |
| MediaRow | Sección horizontal; heading, items, moreHref | Lista semántica, flechas nombradas, scroll-snap proximity; sin roving tab obligatorio | Móvil muestra parte de siguiente card; no autoavance ni atrapamiento de teclado |
| HeroBanner | Destacado editorial; title, backdrop, actions | Sin autoplay; un solo h1; fallback a fondo liso si imagen falla | Moderado 480 px desktop; texto fuera de imagen móvil; no claim «popular» sin datos |
| ContinueWatchingCard | Retomar; title, position, duration, onResume | Imagen 16:9, barra + texto «12:34 de 30:00»; Play accesible | Prioridad primera fila; no porcentaje calculado si duración desconocida |
| ProgressBar | Progreso informativo; value, max, label | progress nativo o role=progressbar, valores finitos/clamp | 4 px visual + descripción; no timeline interactiva |
| RatingBadge | Clasificación por edad; label | «Clasificación por edad: ...»; desconocida se omite | No score comunitario inventado; no confundir con LIKE |
| LikeButton | Señal positiva; value, pending, onChange | aria-pressed; estado neutral/LIKE/DISLIKE compartido; bloqueo por título | En detalle, texto móvil; no rellenar en cada póster |
| DislikeButton | Señal negativa; value, pending, onChange | Misma máquina; click activo borra; cambia desde LIKE por un PUT | Pareja de Like; no dos estados activos |
| WatchlistButton | Guardar; inList, pending, onChange | + Mi Lista / En Mi Lista; optimistic solo con rollback y serialización | En hero/detalle; icon-only en card con label; no mensaje de éxito antes de confirmación remota |
| PlayButton | Entrar o retomar; availability, position, href | Acción semántica: link si ruta, button si reanuda video local; razón cuando no hay video | Primaria de región; no habilitar para serie sin episodios |

Featured = composición de HeroBanner o LandscapeCard grande; Compact = MediaCard horizontal de lista. No crear cinco APIs distintas para la misma ficha.

## Navegación y overlays

| Componente | Propósito y props | Estados y accesibilidad | Responsive; usar / evitar |
|---|---|---|---|
| Navbar | Logo, links, user; currentPath | nav con nombre Principal, aria-current, skip link | 72 px desktop/64 tablet; no sidebar de consumidor |
| MobileBottomNavigation | Inicio/Explorar/Mi Lista/Perfil | nav nombrada, icono + texto, aria-current | 64 px + safe-area; oculta en Watch y auth; no cinco destinos extra |
| ProfileMenu | Perfil/historial/admin/logout; role | Escape, foco devuelto; menú con Radix si usa semántica menu | En mobile destinos en Perfil; rol no es autorización suficiente |
| AdminSidebar | Navegación operativa admin | nav separada y encabezada Administración | Drawer móvil; no sidebar en pantalla de contenido |
| Breadcrumb | Contexto admin anidado | nav etiquetada, último elemento aria-current | Solo si >2 niveles; no Home > título > ver en player |
| Modal | Información breve; open, onClose, title | dialog modal, focus trap, Escape, devolver foco | Máx 640; drawer móvil; no detalle de película como modal en MVP |
| Drawer | Filtros móviles; side, open | Dialog con título; no ocultar botón cerrar | Bottom/fullheight según contenido; no drawer y modal encadenados |
| Dialog | Confirmar retirada/cambio crítico; confirmLabel | Acción descriptiva, foco inicial no destructivo, pending/error inline | Acciones apiladas móvil; no confirmar cada LIKE |
| Toast | Feedback breve; message, action, tone | role=status por defecto, no mover foco; alert solo urgente | Encima de bottom nav; 5 s informativo; error accionable persiste; no única evidencia de fallo de formulario |

## Player

| Componente | Propósito y props | Estados/comportamiento y accesibilidad | Responsive; usar / evitar |
|---|---|---|---|
| VideoPlayer | Media y lifecycle; session, onProgress, onError | Loading/ready/buffering/paused/ended/failed; video playsInline, sin autoplay con sonido | Native controls como fallback; no dependencias pesadas en Home |
| PlayerControls | Agrupar acciones; visible, locked | Persisten con focus, hover o paused; autoocultar tras 3 s solo si playing sin foco | Touch tap muestra; no esconder controles enfocados |
| VolumeControl | mute + rango; volume, muted | Slider nativo con nombre Volumen; teclas; respetar límites iOS | En iOS usar volumen sistema si no permite programático; no control que no tenga efecto |
| Timeline | Seek; current, duration, buffered | input range, aria-valuetext «12 minutos de 30»; actualizar seek al soltar; feedback local durante arrastre | Hit area 44; paso 1 s; no seek antes de metadata |
| FullscreenButton | Pantalla completa; supported, onToggle | label alterna Entrar/Salir; promesa puede fallar y vuelve a inline | Detectar API; fallback native; no bloqueo de orientación obligado |
| PlayPauseButton | Play local; isPlaying, pending | Estado desde eventos reales video; Space con foco local; aria-label | 44–48 px; no disparar resume repetido por buffering |
| ProgressIndicator | Tiempo transcurrido/total; seconds, duration | Cifras tabulares; no live-region cada segundo | Ocultar solo total si estrecho; no ocultar acción esencial |

## Estados de producto

| Componente | Uso y props | Comportamiento/a11y/responsive | Evitar |
|---|---|---|---|
| EmptyState | Colección realmente vacía; title, body, action | Heading contextual + link a Explorar; bloque de ancho moderado | Mostrar vacío si API falló |
| ErrorState | Fallo recuperable; message, retry, requestId | Mensaje humano + reintentar; foco solo ante transición solicitada | Stack traces o secretos |
| LoadingState | Carga regional; kind | Skeleton específico con aria-busy; timeout deriva a error | Spinner global permanente |
| OfflineState | Red desconectada; onRetry | Conserva contenido cacheado, aviso persistente; volver online revalida | Reintentar mutaciones a ciegas |
| UnauthorizedState | Sesión perdida o permiso insuficiente; reason | 401 inicia flujo auth; 403 ofrece volver | Tratar 403 con refresh infinito |
| NotFoundState | Título/ruta inexistente | H1 claro + volver a Explorar; sin bucles | Borrar Mi Lista por un 404 no confirmado |

## Microinteracciones

| Evento | Feedback inmediato | Confirmación y fallo | Tiempo visual |
|---|---|---|---|
| Card hover/focus | Borde y leve elevación | Acciones siguen accesibles sin hover | 160 ms |
| Guardar/quitar | Estado optimista si estado previo completo | Confirmar cache; rollback con reintentar si falla | 120 ms |
| LIKE/DISLIKE | Icono + pressed + texto | Mutaciones por título serializadas, rollback | 120 ms |
| Play | CTA pending y player skeleton | No fingir reproducción antes de loadedmetadata/playing | 180 ms |
| Pause | Video se pausa al instante | Guardado aparte; error no reanuda video | 120 ms |
| Progreso | Timeline local fluida | Sin animación de cada segundo para AT | Lineal local |
| Search | Conserva resultados previos + indicador pequeño | Abort y descartar respuestas antiguas | 300 ms debounce |
| Modal | Entrada por opacidad | Foco al título/primer control y retorno | 220 ms |
| Toast | Opacidad, sin salto de layout | No bloquear click de otras acciones | 180 ms |

## Criterio de aceptación visual

Revisar a 1440, 1100, 820 y 390 px, además de 320 px con texto largo. Todos los estados anteriores deben tener especificación y ejemplo durante implementación. Capturas son evidencia visual, no sustituyen navegación por teclado. No se implementa Storybook antes del recorrido P0; una ruta de catálogo de componentes en desarrollo basta si se necesita.
