# Wireframes textuales medidos

Los siguientes layouts especifican orden, espacio, jerarquía y comportamiento. Se usan tablas por región en lugar de arte ASCII. No son un prototipo funcional ni un diseño final de píxel. Referencia desktop 1440×900, móvil 390×844; gutter y escala son los tokens de 03.

## Login

| Región de arriba abajo | Desktop | Móvil | Interacción/estado |
|---|---|---|---|
| Marca | Arriba izquierda del formulario; ancho 112 | Mismo bloque, margen superior 48 | Logo enlaza acceso |
| Introducción | H1 36, párrafo 16; gap 12 | H1 28, ancho 100% | «Vuelve a tus historias» |
| Formulario | 440 ancho; campos 48 alto; gap 24 | 358 útil; campos >=48 | Email, clave, mostrar; labels permanentes |
| Error | Entre campos y CTA; sin altura fija arbitraria | Ajusta contenido | Resumen tras submit, errores junto al campo |
| CTA | Entrar, 48 alto full width | Igual | Pending conserva ancho |
| Alternativa | Crear cuenta, margen 24 | Igual | Navegación accesible |

No login ilustrado con texto sobre imagen de bajo contraste ni campos a dos columnas. Empty inicial no muestra alertas; loading no bloquea el gestor de contraseñas.

## Home

| Región | Desktop 1440 | Móvil 390 | Información/acción |
|---|---|---|---|
| Navbar/header | Alto 72, gutter 64; logo, Inicio/Explorar/Mi Lista, buscar, avatar | Alto 56, logo, buscar/avatar | Bottom nav móvil contiene 4 destinos |
| Hero | Alto 480; backdrop a la derecha; texto 560 máximo a la izquierda; padding y lectura tinta | Backdrop 16:9 en ancho útil; texto debajo | Marca editorial discreta, título display, sinopsis <=3 líneas desktop y <=4 mobile |
| Acciones hero | Play primary + Mi Lista secondary; link Más información abajo | Play ancho completo; Mi Lista + detalles después | Si serie/sin video, Ver detalles es primaria |
| Continuar | Heading 28; top margin 32; 4 cards de ~300 si caben | Heading 24; card 286 y fracción siguiente | Imagen 16:9, barra 4, título y 12:34 / duración |
| Películas | Margin top 48; row de posters 2:3 | Row horizontal, poster ~144 | Solo títulos de respuesta publicada |
| Series | Igual, metadata «Serie» | Igual | Acceso a ficha, episodios pendientes explícitos en detalle |
| Mi Lista | Carril solo con datos y servicio disponible | Igual | Enlace Ver todo |
| Futuro Recommendations | No ocupa espacio ni skeleton hoy | No visible | Inserción por descriptor tras integración real |
| Navegación inferior | No existe | Alto 64 + safe-area; padding de contenido equivalente | Nunca cubre última fila |

Primera pantalla a 900 px de alto debe mostrar hero y comienzo de Continuar; ajustar hero si chrome/zoom lo impide. No encerrar Home en tarjetas administrativas. Mantener heading/fila como región semántica para AT.

## Detalle

| Región | Desktop | Móvil | Condiciones |
|---|---|---|---|
| Navbar + volver | Navbar 72; link volver debajo si aporta contexto | Header compacto + volver a resultados | Back conserva filtros/search |
| Ficha principal | Backdrop con lectura; título/metadata a la izquierda; hasta 560 px texto | Imagen arriba, título y metadata debajo | Poster opcional, no competir con backdrop |
| Metadata primaria | Año · duración película · clasificación edad | Wrap sin scroll horizontal | Omitir campo ausente |
| Acción | Play/Continuar, Mi Lista | Botón Play full width, guardar después | No Play habilitado sin disponibilidad |
| Gustos | Dos botones «Me gusta» / «No me gusta» bajo acciones | Siempre visibles sin hover | Mutuamente excluyentes |
| Sinopsis | Ancho <=65ch, sin recortar en página dedicada | Misma lectura | No HTML sin sanitizar |
| Créditos | Reparto, dirección, idiomas, géneros | Lista vertical | Solo datos reales |
| Serie | Estado Episodios todavía no disponibles | Igual | No filas de episodios falsas |

## Watch

| Región | Desktop | Móvil | Comportamiento |
|---|---|---|---|
| Header player | Back 44 y título sobre fondo sólido/legible | Safe-area + back/título abreviado visualmente | Nombre completo accesible |
| Escenario | Fondo negro; video object-fit contain; ocupa área restante sin deformar | Video inline 16:9, permite fullscreen nativo | Sin navbar ni bottom nav |
| Aviso sincronización | Pequeño, fuera de subtítulos/controles | Debajo del video si inline | Solo «Guardando»/error cuando aporta; no toast por cada progreso |
| Timeline | Ancho total útil; zona táctil 44, track visual 4 | 44 de hit area, slider nativo | Arrastrar previsualiza tiempo y guarda al confirmar |
| Controles principales | Play/Pause, -10/+10 opcionales, mute/volume, mm:ss / total | Play/Pause, tiempo y fullscreen; volumen del sistema si necesario | Accesos opcionales solo si probados |
| Fullscreen | Derecha, 44 | Derecho, si soportado | No prometer orientación ni API ausente |
| Buffering/error | Indicador local; error terminal con Reintentar/Volver | Igual, botones apilados | Mantener pausa/posición conocida |

En playing sin interacción, controles se ocultan tras 3 s; si focus o paused, permanecen. Si hay subtítulos reales, reservar espacio y permitir controles nativos; no mostrar selector de pistas inexistentes. Guardar progreso no exige controles de backend para seek/volumen, pues son acciones del elemento video.

## Mi Lista

| Región | Desktop | Móvil | Comportamiento |
|---|---|---|---|
| Título | H1 + conteo solo si real | H1 28 | Mi Lista |
| Colección | 6/5 posters, gap 16 | 2 columnas; gap 12 | Título visible y quitar accesible por foco/touch |
| Item sin ficha | CompactCard con texto No disponible | Igual | No descartar referencia durante error temporal |
| Paginación | Controles al final | Anterior/Siguiente de 44 | Conserva posición/filtros |
| Empty | Bloque <=440, texto + Explorar | Ancho útil | Solo tras lista confirmada vacía |

## Perfil

| Región | Desktop | Móvil | Comportamiento |
|---|---|---|---|
| Identidad | Avatar 64 + nombre/correo | Avatar 48 + stack | Correo no editable sin API |
| Formulario | <=640, nombre, avatar URL si admitido, idioma | Una columna | Guardar explícito, error inline |
| Actividad | Links a Historial, Continuar, Preferencias | Lista táctil con labels | No ajustes de privacidad ficticios |
| Seguridad | Cambiar contraseña P2 y cerrar sesión | Bloques separados | Advertir revocación al cambiar clave |

## Admin Upload

| Región | Desktop | Móvil | Comportamiento |
|---|---|---|---|
| Shell | Sidebar 224 + heading Subir video | Header Admin + menú | Permiso validado en servidor |
| Stepper | Archivo → Validación → Ficha → Publicación | Pasos verticales compactos | Solo avanzar por confirmación real |
| Upload | Dropzone grande + botón Seleccionar | input accesible sin requerir drag | Archivo/tamaño y reglas confirmadas |
| Progreso | Barra transferencia; después estado Validando video | Misma semántica | Sin porcentaje ffprobe inventado |
| Metadata | Nombre, duración, códec, resolución y assetId copiable | Cards compactas | Solo ADMIN y datos sanitizados |
| Ficha nueva | Formulario principal; preview lateral | Una columna; preview al final | Asociar título existente bloqueado por G01 |
| Publicación | Resumen estado y Publicar título | Botón 48 + confirmación clara | No publicar optimista; verificar visibilidad |
| Recuperación | Asset confirmado retenido si falla ficha | Igual | No repetir carga ciegamente |

## Ejemplos con contenido de demo

Usar títulos propios como «Luz de regreso» o «Detrás de NÉVARO» como fixtures claramente etiquetadas hasta importar datos reales. Nunca presentar un póster inventado como salida del backend. Revisar wireframes con sinopsis de 500 caracteres, títulos de 80 caracteres e imágenes rotas.
