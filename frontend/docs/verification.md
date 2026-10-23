# Verificación de NÉVARO

17/10/2026. Windows, Node 24.21.0, Docker Desktop Linux y Chromium de Playwright. Se utilizó el backend real del workspace; no se importaron repositorios ni bases de otros contextos dentro de frontend.

## Controles ejecutados

| Control              | Resultado                                                                 |
| -------------------- | ------------------------------------------------------------------------- |
| Typecheck            | Correcto, TypeScript estricto y tipos Next                                |
| ESLint               | Correcto, cero errores/warnings                                           |
| Vitest               | 20 pruebas correctas: 16 unitarias y 4 de componentes                     |
| Next build           | Producción compilada correctamente                                        |
| Tipos OpenAPI        | Generados desde los tres YAML reales                                      |
| Docker               | Imagen multietapa construida; frontend no root; frontend/Redis saludables |
| Navegador real       | Cinco escenarios E2E aprobados                                            |
| Ensayo base repetido | Cinco ejecuciones consecutivas correctas                                  |
| Responsive           | 1440/1100/820/390/320 px sin overflow horizontal de página                |
| Revisión visual      | Capturas de Login e Inicio desktop/móvil inspeccionadas                   |
| Aislamiento Catalog  | Sin puerto publicado en modo integrado                                    |

## Recorridos comprobados

1. Registro USER, login y cookie propia HttpOnly. El navegador no recibe users_refresh ni tokens. Rechazo de escritura ADMIN desde USER y de Origin ajeno.
2. Detalle, agregar a Mi Lista, LIKE → DISLIKE, MP4 realmente reproducido, seek a 25 s, pausa confirmada, nueva sesión que restaura el punto. Logout/re-login conserva lista; otra cuenta no hereda datos. Finalización del video actualiza Historial. Edición de perfil y cambio de contraseña funcionan.
3. ADMIN carga MP4 real mediante el BFF, recibe metadata, crea ficha, publica, abre detalle y edita la ficha editorial por API. El recurso no se reasigna a un título existente.
4. Access caducado preparado en una sesión técnica de prueba: tres lecturas concurrentes producen exactamente una llamada de refresh a Users; la siguiente lectura sigue autenticada. No se registran tokens ni valores de cookies.
5. El reloj del navegador adelanta el temporizador de URL: se ejecuta refresh-url contra Playback real y se conserva posición y estado pausado.
6. Redis detenido de forma controlada al final de la suite: logout elimina la cookie del navegador y devuelve revoked=false, sin afirmar revocación remota. Redis se reinicia y responde PONG en finally.

La suite agrupa registro/bibliotecas/player/perfil en un escenario, upload/editor en otro, y los tres controles restantes en escenarios independientes: cinco tests E2E. El ensayo principal se repitió cinco veces, con cuentas nuevas y servicios reales. Se realizaron también múltiples publicaciones satisfactorias durante la integración.

## Pruebas por riesgo

La cola de player verifica orden, coalescencia, retrocesos intencionales, recuperación tras error y detención tras sustitución. Se validan límites de retorno local y normalización de filtros/query Unicode. Componentes comprueban rollback tras fallo de escritura, estado desconocido al incompletar paginación, diferencia entre contraseña incorrecta y sesión expirada, y separación de cache entre la vista previa de cuatro items y la página completa.

Se corrigieron durante la validación: nombre accesible de contraseña, feedback de pausa que podía ser sobrescrito por un seek pendiente, espera de confirmación de login/logout en el ensayo, conservación de campos editoriales no expuestos y claves de cache que deben incluir el tamaño de página.

## Evidencias y reproducción

```powershell
npm run check
npm run test:e2e
npm run test:e2e -- --grep register --repeat-each=5
```

Los logs de checks/build y capturas quedan en archivos ignorados `.verification*`. No contienen credenciales exportadas. Traces y videos de Playwright están deshabilitados. Los tests solo admiten URLs localhost/127.0.0.1 y exigen un seed de Users en desarrollo. Las cuentas/títulos de ensayo se conservan, dado que no hay DELETE de títulos en la API; no se borraron volúmenes.

## Límites de la evidencia

Pruebas de navegador en Chromium de escritorio y anchos móviles; no se certifica Safari/iOS, NVDA/VoiceOver ni conformidad WCAG completa. Se revisaron semántica, nombres, foco y responsive; falta una campaña manual con tecnologías de asistencia y contenido subtitulado. No se declaran p75 de Core Web Vitals ni cifras de rendimiento de producción desde este ensayo local.

Las respuestas de error de componentes se simulan solo para probar recuperación visual. Los recorridos de aceptación utilizan Users, Catalog, Playback y MinIO reales. No se inyectó cada fallo posible de cada API. Las pruebas de URL adelantan el temporizador del navegador y verifican renovación real; no cambian el reloj del servidor.

Episodios, Recommendations, pagos, HLS/DRM y reasignación de asset permanecen fuera del alcance implementado, como establece el plan. El modo integrado protege Catalog por red y BFF; antes de un despliegue externo conviene añadir autorización también al servicio.
