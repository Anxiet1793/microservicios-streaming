# Accesibilidad — objetivo WCAG 2.2 AA

Es un objetivo de implementación, no certificación. Sin UI ejecutable no se ha probado conformidad. Las limitaciones de contenido multimedia también cuentan: una UI accesible no resuelve automáticamente subtítulos/audio descriptivo del video.

## Criterios de diseño y verificación

| Área | Especificación | Verificación propuesta |
|---|---|---|
| Contraste | Texto normal >=4.5:1; grande >=3:1; UI relevante >=3:1 | Contrastes de 03 y prueba sobre imagen/overlays reales |
| Foco | Outline 2 px + offset 3; nunca oculto por sticky/bottom nav | Tab/Shift+Tab en todos los estados |
| Tamaño objetivo | Proyecto apunta a 44×44; AA 2.5.8 tiene mínimo 24×24 o excepciones/espaciado | Medir iconos y targets, no solo glyph |
| Reflow | 320 CSS px sin scroll horizontal de página | Zoom y viewport; carriles con scroll intencional accesible |
| Formularios | Labels reales, autocomplete, hint/error asociado, permite pegar | Teclado, gestor y lector; submit con errores |
| Autenticación | No puzzles de memoria ni bloquear password manager | Registro/login manual y con autocompletar |
| Semántica | Un h1 por pantalla, landmarks, jerarquía de headings | Inspector/accessibility tree |
| Cards | Link detalle y botones hermanos, sin controles anidados | Teclado y activación independiente |
| Overlays | Título, foco inicial adecuado, trap/return, Escape | Abrir/cerrar con teclado y lector |
| Estados | Cambios con icono/texto y aria-pressed/selected | Simular daltonismo y usar AT |
| Motion | prefers-reduced-motion elimina desplazamientos/shimmer | Emulación de reducción y prueba manual |
| Player | Botones/slider nombrados, tiempos legibles, foco no autooculto | NVDA/VoiceOver y teclado, inline/fullscreen |
| Live regions | Solo cambios relevantes; nunca narrar cada segundo | Escucha durante video y guardado |
| Contenido multimedia | Subtítulos sincronizados para pregrabado con audio significativo; descripción/audio alternativo según contenido y criterio aplicable | Preparar clip demo accesible; registrar brechas si no hay pistas/backend |
| Idioma | html lang=es; metadata y mensajes coherentes | Lector pronuncia correctamente |

WCAG no exige llamar «AA» a un objetivo de 44 px: ese tamaño es decisión del proyecto por usabilidad, superior al mínimo de 2.5.8 cuando este aplica. La tabla de colores no verifica contraste de texto encima de cualquier fotograma. Probar un fondo sólido de lectura si el degradado no basta.

## Teclado del player

Tab alcanza Volver, Play/Pause, volumen cuando esté soportado, timeline y fullscreen en orden DOM. Space alterna solo si foco dentro de la región player y no está en input/texto editable; no secuestrar Space en toda la página. Slider usa flechas nativas y anuncia tiempo humano mediante aria-valuetext. Escape deja fullscreen antes de abrir navegación externa. Atajos adicionales requieren documentación visible y no son P0.

## Medios accesibles: decisión pendiente

El backend recibido describe un MP4, sin API de pistas/subtítulos. No dibujar CC ni selector de idioma de audio vacíos. Para el clip propio de exposición, preparar subtítulos con distribución válida y método de entrega explícito (por ejemplo pista VTT autorizada si el diseño final lo incorpora); si no se puede, registrar la desviación y no declarar conformidad completa. Preferencia de idioma del perfil no garantiza pistas de audio.

## QA manual de salida

Ejecutar login → explorar → detalle → Mi Lista/gustos → watch → pausa → volver → continuar → admin usando teclado. Repetir rutas principales con NVDA/Chrome y VoiceOver/Safari cuando disponibles, fuente al 200%, viewport equivalente de 320, alto contraste del sistema y reduced-motion. axe automático complementa, no sustituye. Cerrar fallos bloqueantes y documentar desviaciones con alcance, responsable y solución prevista.

Fuente normativa: https://www.w3.org/TR/WCAG22/ . Ayuda de contraste: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html . Consulta 17/10/2026.
