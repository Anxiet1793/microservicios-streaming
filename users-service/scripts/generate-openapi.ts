import { writeFile, mkdir } from "node:fs/promises";
import { stringify } from "yaml";
import { TITLE_ID, USER_ID } from "../src/modules/users/domain/user";

type Schema = Record<string, unknown>;
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const object = (properties: Schema, required = Object.keys(properties)): Schema => ({ type: "object", additionalProperties: false, ...(required.length ? { required } : {}), properties });
const string = (extra: Schema = {}): Schema => ({ type: "string", ...extra });
const integer = (extra: Schema = {}): Schema => ({ type: "integer", ...extra });
const date = string({ format: "date-time" });
const profile = {
  displayName: string({ minLength: 1, maxLength: 100 }),
  avatarUrl: string({ format: "uri", nullable: true, maxLength: 2048, pattern: "^https?://", description: "URL HTTP(S) sin credenciales. null elimina el avatar; no se descarga desde el servidor." }),
  preferredLanguage: string({ pattern: "^[a-z]{2}(-[A-Z]{2})?$", example: "es" }),
};
const authUser = { userId: ref("UserId"), email: string({ format: "email" }), displayName: profile.displayName, status: ref("Status"), role: ref("Role") };
const schemas: Record<string, Schema> = {
  UserId: string({ pattern: USER_ID.source, example: "usr_00000000-0000-4000-8000-000000000001" }),
  TituloId: string({ pattern: TITLE_ID.source, example: "ttl_00000000-0000-4000-8000-000000000001", description: "Referencia externa del contrato de Catálogo; sin FK ni consulta síncrona a Catalog." }),
  Status: string({ enum: ["ACTIVE", "INACTIVE"] }), Role: string({ enum: ["USER", "ADMIN"] }),
  PreferenceValue: string({ enum: ["LIKE", "DISLIKE"] }),
  Password: string({ minLength: 12, maxLength: 128, writeOnly: true, description: "12–128 caracteres Unicode, sin NUL. No se recorta ni se normaliza; admite frases." }),
  Profile: object(profile), ProfilePatch: { ...object(profile, []), minProperties: 1 },
  AuthUser: object(authUser),
  User: object({ userId: ref("UserId"), email: string({ format: "email" }), status: ref("Status"), role: ref("Role"), profile: ref("Profile"), createdAt: date, updatedAt: date }),
  RegisterInput: object({ email: string({ format: "email", maxLength: 254 }), password: ref("Password"), displayName: profile.displayName }),
  RegisterOutput: object({ user: ref("AuthUser") }),
  LoginInput: object({ email: string({ format: "email", maxLength: 254 }), password: string({ minLength: 1, maxLength: 256, writeOnly: true }) }),
  Session: object({ accessToken: string({ description: "JWT RS256. Mantener en memoria del cliente; no contiene email ni passwordHash." }), expiresIn: integer({ example: 900 }), user: ref("AuthUser") }),
  ChangePassword: object({ currentPassword: string({ minLength: 1, maxLength: 256, writeOnly: true }), newPassword: ref("Password") }),
  WatchlistItem: object({ tituloId: ref("TituloId"), addedAt: date }),
  ContentPreference: object({ tituloId: ref("TituloId"), value: ref("PreferenceValue"), createdAt: date, updatedAt: date }),
  PreferenceInput: object({ value: ref("PreferenceValue") }),
  Pagination: object({ page: integer({ minimum: 1 }), limit: integer({ minimum: 1, maximum: 100 }), total: integer({ minimum: 0 }), totalPages: integer({ minimum: 0 }) }),
  Watchlist: object({ items: { type: "array", maxItems: 100, items: ref("WatchlistItem") }, pagination: ref("Pagination") }),
  Preferences: object({ items: { type: "array", maxItems: 100, items: ref("ContentPreference") }, pagination: ref("Pagination") }),
  Health: object({ status: string({ enum: ["ok"] }), service: string({ enum: ["users-service"] }) }),
  JWKS: object({ keys: { type: "array", items: object({ kty: string({ enum: ["RSA"] }), n: string(), e: string(), kid: string(), alg: string({ enum: ["RS256"] }), use: string({ enum: ["sig"] }) }) } }),
  Error: object({ error: object({ code: string(), message: string(), requestId: string({ format: "uuid" }) }) }),
};
const commonHeaders = { "x-request-id": { schema: string({ format: "uuid" }), description: "ID generado por el servidor y correlacionado con logs." } };
const response = (description: string, schema?: string) => ({ description, headers: commonHeaders, ...(schema ? { content: { "application/json": { schema: ref(schema) } } } : {}) });
const codes: Record<string, string> = {
  400: "VALIDATION_ERROR: JSON, campos, identificadores o paginación inválidos.", 401: "UNAUTHORIZED o INVALID_CREDENTIALS. No distingue email/contraseña incorrectos, usuario inactivo o refresh inválido.",
  403: "FORBIDDEN: origen/CSRF o permisos insuficientes.", 404: "USER_NOT_FOUND.", 409: "EMAIL_ALREADY_EXISTS o WATCHLIST_ITEM_ALREADY_EXISTS.",
  413: "PAYLOAD_TOO_LARGE.", 415: "UNSUPPORTED_MEDIA_TYPE: requiere JSON UTF-8 sin compresión.",
  429: "RATE_LIMIT_EXCEEDED; Retry-After indica segundos restantes.", 500: "INTERNAL_SERVER_ERROR; sin stack ni mensajes internos.", 503: "SERVICE_UNAVAILABLE.",
};
const errors = (list: number[]) => Object.fromEntries([...new Set([...list, 500])].map(code => [String(code), { ...response(codes[code]!, "Error"), ...(code === 429 ? { headers: { ...commonHeaders, "Retry-After": { schema: integer({ minimum: 1 }) } } } : {}) }]));
const body = (schema: string, example: unknown) => ({ required: true, content: { "application/json": { schema: ref(schema), example } } });
const titleParam = { name: "tituloId", in: "path", required: true, schema: ref("TituloId") };
const pagination = [{ name: "page", in: "query", schema: integer({ minimum: 1, default: 1 }) }, { name: "limit", in: "query", schema: integer({ minimum: 1, maximum: 100, default: 20 }) }];
const csrf = { name: "X-CSRF-Protection", in: "header", schema: string({ enum: ["1"] }), description: "Obligatoria con valor 1 cuando no se envía Origin. Si se envía Origin, debe coincidir exactamente con APP_ORIGIN." };
const auth = [{ bearerAuth: [] }];
const sessionResponse = { ...response("JWT de acceso y usuario. Refresh solo en cookie, nunca en el body.", "Session"), headers: { ...commonHeaders, "Set-Cookie": { schema: string(), description: "users_refresh; HttpOnly; SameSite=Strict; Path=/api/v1/auth; Secure en APP_ENV=production. Sin Domain." } } };
const paths: Record<string, unknown> = {
  "/api/v1/auth/register": { post: { operationId: "registerUser", tags: ["Auth"], summary: "Registra usuario y perfil en una transacción", description: "Email normalizado con trim/lowercase. Rol USER asignado por servidor. No inicia sesión automáticamente.", requestBody: body("RegisterInput", { email: "samuel@example.com", password: "PasswordSegura123!", displayName: "Samuel" }), responses: { 201: response("Usuario creado.", "RegisterOutput"), ...errors([400, 403, 409, 413, 415, 429]) } } },
  "/api/v1/auth/login": { post: { operationId: "loginUser", tags: ["Auth"], summary: "Inicia sesión", requestBody: body("LoginInput", { email: "samuel@example.com", password: "PasswordSegura123!" }), responses: { 200: sessionResponse, ...errors([400, 401, 403, 413, 415, 429]) } } },
  "/api/v1/auth/refresh": { post: { operationId: "refreshSession", tags: ["Auth"], summary: "Rota refresh y emite access token", description: "Cookie users_refresh requerida. Rotación de un solo uso con caducidad absoluta fija. Reutilizar un token consumido/revocado invalida su familia y responde 401. El frontend debe serializar los refresh; dos solicitudes simultáneas se consideran replay. Ante 401 se borra la cookie.", security: [{ refreshCookie: [] }], parameters: [csrf], responses: { 200: sessionResponse, ...errors([400, 401, 403, 429]) } } },
  "/api/v1/auth/logout": { post: { operationId: "logoutUser", tags: ["Auth"], summary: "Revoca la familia de sesión y borra la cookie", description: "Idempotente sin cookie o con token desconocido bien formado. Los access tokens ya emitidos conservan su validez hasta expirar; el cliente debe descartarlos.", parameters: [csrf], responses: { 204: { ...response("Sesión revocada, sin contenido."), headers: { ...commonHeaders, "Set-Cookie": { schema: string(), description: "Elimina users_refresh mediante Max-Age=0." } } }, ...errors([400, 401, 403, 429]) } } },
  "/api/v1/users/me": {
    get: { operationId: "getCurrentUser", tags: ["Users"], summary: "Obtiene el usuario autenticado", security: auth, responses: { 200: response("Usuario y perfil.", "User"), ...errors([400, 401]) } },
    patch: { operationId: "updateProfile", tags: ["Users"], summary: "Actualiza parcialmente el perfil", security: auth, description: "Solo displayName, avatarUrl y preferredLanguage. avatarUrl=null elimina el campo. Campos ausentes se conservan; PATCH idéntico no modifica updatedAt.", requestBody: body("ProfilePatch", { displayName: "Samuel actualizado", avatarUrl: null }), responses: { 200: response("Perfil actualizado.", "User"), ...errors([400, 401, 403, 413, 415]) } },
  },
  "/api/v1/users/me/change-password": { post: { operationId: "changePassword", tags: ["Users"], summary: "Cambia contraseña y revoca todas las sesiones", security: auth, description: "Verifica la contraseña actual, cambia el hash y revoca todos los refresh en una transacción. Incrementa authVersion: Users rechaza JWT anteriores inmediatamente. Otros servicios que solo verifican firma los aceptan hasta exp, salvo una política futura de revocación distribuida.", requestBody: body("ChangePassword", { currentPassword: "PasswordSegura123!", newPassword: "NuevaPasswordSegura456!" }), responses: { 204: response("Contraseña cambiada; volver a iniciar sesión. Se borra cookie."), ...errors([400, 401, 403, 413, 415, 429]) } } },
  "/api/v1/users/me/watchlist": { get: { operationId: "getWatchlist", tags: ["Watchlist"], summary: "Lista referencias para ver después", security: auth, parameters: pagination, description: "Orden addedAt descendente, tituloId ascendente. Offset máximo 10000. Conteo y página son lecturas separadas.", responses: { 200: response("Referencias sin metadata de Catálogo.", "Watchlist"), ...errors([400, 401]) } } },
  "/api/v1/users/me/watchlist/{tituloId}": { parameters: [titleParam],
    post: { operationId: "addToWatchlist", tags: ["Watchlist"], summary: "Agrega una referencia a Mi Lista", security: auth, responses: { 201: response("Referencia agregada.", "WatchlistItem"), ...errors([400, 401, 403, 404, 409]) } },
    delete: { operationId: "removeFromWatchlist", tags: ["Watchlist"], summary: "Elimina una referencia de Mi Lista", security: auth, description: "Idempotente: devuelve 204 aunque no exista.", responses: { 204: response("Referencia eliminada."), ...errors([400, 401, 403, 404]) } },
  },
  "/api/v1/users/me/preferences": { get: { operationId: "getContentPreferences", tags: ["Preferences"], summary: "Lista señales explícitas del usuario", security: auth, parameters: pagination, description: "Orden updatedAt descendente, tituloId ascendente; offset máximo 10000. No calcula recomendaciones.", responses: { 200: response("Preferencias del usuario autenticado.", "Preferences"), ...errors([400, 401]) } } },
  "/api/v1/users/me/preferences/{tituloId}": { parameters: [titleParam],
    put: { operationId: "setContentPreference", tags: ["Preferences"], summary: "Crea o cambia LIKE/DISLIKE", security: auth, description: "PUT idempotente: repetir valor conserva updatedAt; cambiarlo conserva createdAt. No admite usuarioId en entrada.", requestBody: body("PreferenceInput", { value: "LIKE" }), responses: { 200: response("Preferencia guardada.", "ContentPreference"), ...errors([400, 401, 403, 404, 413, 415]) } },
    delete: { operationId: "removeContentPreference", tags: ["Preferences"], summary: "Elimina una señal explícita", security: auth, description: "Idempotente, incluso si no existía.", responses: { 204: response("Preferencia eliminada."), ...errors([400, 401, 403, 404]) } },
  },
  "/api/health": { get: { operationId: "health", tags: ["Infrastructure"], summary: "Comprueba PostgreSQL y par de claves JWT", responses: { 200: response("Servicio disponible.", "Health"), ...errors([503]) } } },
  "/.well-known/jwks.json": { get: { operationId: "jwks", tags: ["Infrastructure"], summary: "Publica solo clave pública RSA", description: "Consumidores fijan issuer, audience, RS256 y exp y seleccionan kid; no siguen jku del token. En esta versión se publica una única clave activa.", responses: { 200: response("JSON Web Key Set público.", "JWKS"), ...errors([400]) } } },
};
for (const value of Object.values(paths)) {
  for (const [method, operation] of Object.entries(value as Record<string, unknown>)) {
    if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
    const op = operation as { responses: Record<string, unknown> };
    op.responses.default = response("Error general; métodos no permitidos devuelven 405 con Allow.", "Error");
  }
}
const document = {
  openapi: "3.0.3", info: { title: "Users Service", version: "1.0.0", description: "Bounded Context Usuarios. JWT Bearer para operaciones propias. Refresh opaco solo en cookie HttpOnly. Las escrituras validan Origin; no hay CORS entre orígenes por defecto. Todos los objetos JSON son estrictos. Se rechazan queries repetidas/desconocidas. Body máximo 16 KiB configurable. Logs sin datos de entrada ni tokens. GET admite HEAD, rutas admiten OPTIONS (204). Todas las respuestas incluyen x-request-id y Cache-Control: no-store." },
  servers: [{ url: "http://127.0.0.1:3001" }], tags: ["Auth", "Users", "Watchlist", "Preferences", "Infrastructure"].map(name => ({ name })), paths,
  components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT RS256" }, refreshCookie: { type: "apiKey", in: "cookie", name: "users_refresh" } }, schemas },
};
await mkdir("docs", { recursive: true });
await writeFile("docs/openapi.yaml", stringify(document, { aliasDuplicateObjects: false, lineWidth: 100 }));
console.log("OpenAPI generado: 15 operaciones.");
