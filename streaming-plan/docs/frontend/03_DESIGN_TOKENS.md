# Design tokens

Una fuente de valores: `frontend/src/styles/tokens.css`. Las tablas son norma; no añadir valores ad hoc sin actualizar este documento. Los tokens son propuesta, no prueba de accesibilidad de una app completa.

## Color

Contraste calculado con luminancia relativa sRGB y fórmula WCAG; verificar cada combinación real, incluidos overlays.

| Token | HEX | RGB | Uso | Contraste calculado |
|---|---|---|---|---|
| brand-primary | #F4C46B | 244, 196, 107 | CTA, relleno de botón | 11.77:1 frente a #0B1017 |
| brand-secondary | #9BB9E9 | 155, 185, 233 | Enlaces y ayuda | 9.55:1 frente a #0B1017 |
| brand-accent | #A8C8B3 | 168, 200, 179 | Detalle editorial | 10.52:1 frente a #0B1017 |
| background | #0B1017 | 11, 16, 23 | Fondo base | 16.93:1 frente a #F5F1E8 |
| surface-01 | #131C27 | 19, 28, 39 | Contenedores | 15.23:1 frente a #F5F1E8 |
| surface-02 | #1D2938 | 29, 41, 56 | Overlays y paneles | 13.06:1 frente a #F5F1E8 |
| text-primary | #F5F1E8 | 245, 241, 232 | Lectura principal | 16.93:1 frente a #0B1017 |
| text-secondary | #B5C0CE | 181, 192, 206 | Metadata | 10.35:1 frente a #0B1017 |
| border | #66778C | 102, 119, 140 | Límites interactivos | 4.16:1 frente a #0B1017 |
| success | #8FD2AA | 143, 210, 170 | Confirmación + icono | 10.87:1 frente a #0B1017 |
| warning | #F4C46B | 244, 196, 107 | Aviso + texto | 11.77:1 frente a #0B1017 |
| error | #FFA5A5 | 255, 165, 165 | Error + texto | 10.15:1 frente a #0B1017 |
| info | #9BB9E9 | 155, 185, 233 | Información + icono | 9.55:1 frente a #0B1017 |

Combinaciones aprobadas: tinta sobre primary 11.77:1; text-primary sobre surface-02 13.06:1; text-secondary sobre surface-02 7.99:1; border sobre surface-02 3.21:1. No usar blanco sobre ámbar para texto de botones. Bordes decorativos pueden ser más sutiles; los que identifican un input conservan >=3:1. Primary y warning comparten matiz: distinguir con icono y etiqueta.

## Escalas

- Espaciado: 0, 4, 8, 12, 16, 24, 32, 48, 64, 96 px; unidad base 4. Gaps de cards: 16 desktop, 12 mobile.
- Radios: sm 4, md 8, lg 12, xl 16, full 9999 px. Botones/input md; card lg; panel xl; avatar full.
- Sombras: `overlay=0 16px 48px rgb(0 0 0 / .40)`; foco con outline, nunca sombra sola. No sombra en cada póster.
- Z: base 0, sticky 20, dropdown 40, backdrop 60, modal 70, toast 90. Fullscreen usa top layer del navegador; portales del player deben quedar dentro de su raíz.
- Breakpoints: mobile 0–767, tablet 768–1023, laptop 1024–1279, desktop >=1280. CSS mobile first; probar 320 px y zoom.
- Contenido: máximo 1600 px; márgenes 16/32/40/64 respectivamente. Formularios <=440 px; texto <=65ch.
- Tipografía: tabla normativa en 02; display fluido con clamp entre 40 y 64. Texto base 16 px.
- Motion: fast 120, hover 160, controls 180, overlay 220, carousel 240 ms; easing(.2,.8,.2,1). Con reducción: 0 ms y scroll instantáneo.

## Tokens semánticos

`--action-primary-bg` referencia brand-primary; `--action-primary-fg` referencia background. `--focus-ring` referencia brand-primary; `--field-border` referencia border. Los componentes consumen semánticos para facilitar cambio de marca.

El nombre de marca, tagline, rutas y accesibilidad se configuran en un objeto TypeScript conceptual: `brand={ name: 'NÉVARO', slug: 'nevaro', tagline: 'Tu próxima historia empieza aquí' }`. No insertar texto de marca con pseudoelementos CSS.

## Gobernanza

Nombrar por función, no `yellowButton`. Cambiar token antes que sobrescribir veinte componentes. La adaptación de breakpoints va en media queries literales; variables CSS no se usan como condiciones de media query. No incluir modo claro en este set. Toda variación nueva necesita contraste, estado focus y screenshot de referencia durante implementación.
