# Manual de marca — NÉVARO

**Marca provisional de proyecto.** Las propuestas siguientes son creación conceptual, no nombres con exclusividad garantizada. Antes de lanzamiento público: búsqueda de coincidencias en productos, dominios y registros de marca. No se ha hecho una revisión comercial exhaustiva.

## Naming

| Nombre | Significado/concepto | Personalidad | Pronunciación | Tagline posible |
|---|---|---|---|---|
| Névaro | Neologismo: novedad, navegación y horizonte narrativo | Editorial, serena | NÉ-va-ro, sencilla | Tu próxima historia empieza aquí |
| Vélumo | Velo de proyección + luz | Cálida, cinematográfica | VÉ-lu-mo | Dale luz a otra historia |
| Trávora | Trama + recorrido | Curiosa, dinámica | TRÁ-vo-ra | Historias que te llevan |
| Réluno | Relato + atmósfera nocturna | Íntima | RÉ-lu-no | Quédate en la historia |
| Lumetra | Luz + metraje | Técnica, precisa | lu-ME-tra | Encuentra tu siguiente escena |
| Nuvoria | Nuevo + memoria | Personal | nu-VO-ria | Siempre hay otra historia |
| Cadévo | Cadencia + movimiento | Fluida | ca-DÉ-vo | Historias a tu ritmo |
| Orvilo | Órbita + hilo narrativo | Exploradora | or-VI-lo | Sigue lo que te mueve |
| Telunia | Tela de proyección + noche | Suave | te-LU-nia | Un espacio para tus historias |
| Virelo | Ver + relato | Directa | vi-RE-lo | Mira dónde empieza |

Top 3: **Névaro**, Vélumo y Trávora. Ganador provisional Névaro: tres sílabas claras, no depende del sufijo «flix», funciona en texto y símbolo. Riesgo: acento en escritura y búsqueda; usar `nevaro` para slug y `NÉVARO` para marca. La aprobación final del usuario no se presupone.

## Esencia

Propósito: abrir espacio para una historia y facilitar volver a ella. Valores: claridad, continuidad, autonomía y cuidado. Posicionamiento: una sala personal de descubrimiento y reproducción, sobria y accesible. Atributos: cinematográfica 5/5, humana 4/5, tecnológica 3/5, lúdica 2/5. Evitar lenguaje grandilocuente y ciencia ficción decorativa.

## Voz y tono

Español neutro cercano, tuteo, frases breves. Mayúsculas solo marca/siglas; botones con verbo cuando representan una acción. No culpar al usuario ni mostrar códigos como mensaje principal.

| Contexto | Texto aprobado | Evitar |
|---|---|---|
| Inicio | ¿Qué historia sigue? | El mejor streaming del universo |
| Mi Lista vacía | Guarda algo para después. Explora el catálogo y encuentra tu próxima historia. | No existen registros |
| Login | Vuelve a tus historias | Autenticación requerida |
| Error de sesión | Tu sesión venció. Inicia sesión para continuar. | Error 401 |
| Error guardado | No pudimos guardar el cambio. Inténtalo otra vez. | Operación fallida |
| Agregar | + Mi Lista → En Mi Lista | Inserción exitosa |
| Upload finalizado | Video cargado. Ahora completa su ficha. | Recurso creado exitosamente |
| Sin video | Este título todavía no tiene un video disponible. | Error de asset |
| Recomendación futura | Porque viste «{título}» | Nuestra IA sabe lo que quieres |
| Reanudar | Continuar desde 12:34 | Resume playback |
| Bienvenida de registro | Tu cuenta está lista. Inicia sesión. | Suponer login automático no documentado |

Secciones canónicas: Inicio, Explorar, Mi Lista, Historial, Perfil. Películas y Series son filtros enlazables de Explorar. «Continuar viendo» es carril y página. «Preferencias» expresa gustos de contenido; idioma pertenece a Perfil. «Recomendados para ti» queda oculto hasta integración real.

## Logo conceptual

Símbolo: dos trazos verticales desplazados que sugieren un fotograma abierto y una N incompleta; el espacio negativo apunta hacia delante sin usar un triángulo Play literal. Retícula 24×24, grosor 3, extremos suaves de radio 1.5. Diseño definitivo pendiente de vectorización y prueba a tamaño pequeño.

Logotipo: NÉVARO en Manrope 700 con espaciado 0.06em, sin deformar glifos. Horizontal: isotipo de 24 y palabra con separación 8; área de respeto de 0.5× altura del isotipo. Isotipo solo para favicon y navegación móvil; a 16 px simplificar trazos. Versiones marfil, tinta y monocromo. Acento ámbar permitido solo sobre tinta y fuera del player inmersivo.

No estirar, rotar, usar sombras, encerrar en botones Play, aplicar degradados, recolorear por póster ni colocar sobre una zona fotográfica sin contraste. Tamaño mínimo propuesto: palabra 88 px de ancho; símbolo 16 px. Nombre/tagline/alt se configuran en `brand.ts`; colores en CSS. Una cadena CSS no sustituye textos semánticos del DOM.

## Paleta funcional

Valores y contrastes calculados en 03. Primary ámbar #F4C46B: acción de reproducción y foco; secondary azul #9BB9E9: información y enlaces; accent salvia #A8C8B3: detalle editorial limitado. La asociación cálida/cinematográfica es una intención de diseño, no una afirmación psicológica universal. El ámbar reserva atención y evita competir con los pósteres; la tinta reduce ruido alrededor del video. No usar primary para todo.

Fondos tinta #0B1017, superficies #131C27 y #1D2938, textos #F5F1E8 y #B5C0CE. Sin modo claro en MVP: duplica QA visual sin aportar al flujo de exposición. No confundir fondo oscuro con contraste automáticamente correcto.

## Tipografía

Manrope para marca, títulos y cuerpo; una familia reduce cargas y mantiene identidad. Fuente open source bajo SIL OFL según su repositorio oficial; conservar licencia al distribuir y alojar WOFF2 localmente. Fallback: `Arial, sans-serif`. Tiempos de player con cifras tabulares y `ui-monospace` si es necesario.

| Rol | Desktop / mobile px | Line-height | Peso |
|---|---|---|---|
| Display XL | 64 / 40 | 1.08 | 700 |
| Display | 48 / 32 | 1.12 | 700 |
| H1 | 36 / 28 | 1.20 | 700 |
| H2 | 28 / 24 | 1.25 | 650 |
| H3 | 22 / 20 | 1.30 | 650 |
| Body L | 18 / 18 | 1.55 | 400 |
| Body | 16 / 16 | 1.50 | 400 |
| Body S | 14 / 14 | 1.50 | 400 |
| Caption | 12 / 12 | 1.50 | 500 |
| Button | 14 / 14 | 1.20 | 650 |

## Iconos, imagen y motion

Lucide, trazo 2, 20 o 24 px; licencia ISC según fuente oficial. No mezclar outline/filled de otras familias. Estado activo añade check/texto o `aria-pressed`, no solo color.

Poster 2:3; backdrop y landscape 16:9; avatar 1:1. `object-fit: cover` con punto focal configurable cuando exista. Nunca estirar. Fallback con superficie, símbolo simple y título real; no imagen de otra película. Sin filtros de color destructivos. En hero, degradado tinta solo como capa de lectura y se prueba con imágenes claras y oscuras. Imágenes con derechos o propias para demo; no generar afirmaciones de licencia de pósteres.

Motion: hover 160 ms, toggle 120 ms, overlay 220 ms, controles player 180 ms, scroll de carril <=240 ms y sin autoavance. Easing `cubic-bezier(.2,.8,.2,1)`. Hover eleva borde/contraste; escala máxima 1.015 sin desplazar vecinos. No autoplay de previews. Reduced motion elimina escala, shimmer y desplazamientos animados. Los estados siguen siendo visibles sin animación.

Fuentes primarias: https://github.com/google/fonts/blob/main/ofl/manrope/OFL.txt ; https://lucide.dev/ . Consultadas 17/10/2026.
