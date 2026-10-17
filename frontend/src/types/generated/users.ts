export interface paths {
    "/api/v1/auth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Registra usuario y perfil en una transacción
         * @description Email normalizado con trim/lowercase. Rol USER asignado por servidor. No inicia sesión automáticamente.
         */
        post: operations["registerUser"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Inicia sesión */
        post: operations["loginUser"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rota refresh y emite access token
         * @description Cookie users_refresh requerida. Rotación de un solo uso con caducidad absoluta fija. Reutilizar un token consumido/revocado invalida su familia y responde 401. El frontend debe serializar los refresh; dos solicitudes simultáneas se consideran replay. Ante 401 se borra la cookie.
         */
        post: operations["refreshSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Revoca la familia de sesión y borra la cookie
         * @description Idempotente sin cookie o con token desconocido bien formado. Los access tokens ya emitidos conservan su validez hasta expirar; el cliente debe descartarlos.
         */
        post: operations["logoutUser"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Obtiene el usuario autenticado */
        get: operations["getCurrentUser"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Actualiza parcialmente el perfil
         * @description Solo displayName, avatarUrl y preferredLanguage. avatarUrl=null elimina el campo. Campos ausentes se conservan; PATCH idéntico no modifica updatedAt.
         */
        patch: operations["updateProfile"];
        trace?: never;
    };
    "/api/v1/users/me/change-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cambia contraseña y revoca todas las sesiones
         * @description Verifica la contraseña actual, cambia el hash y revoca todos los refresh en una transacción. Incrementa authVersion: Users rechaza JWT anteriores inmediatamente. Otros servicios que solo verifican firma los aceptan hasta exp, salvo una política futura de revocación distribuida.
         */
        post: operations["changePassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/me/watchlist": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Lista referencias para ver después
         * @description Orden addedAt descendente, tituloId ascendente. Offset máximo 10000. Conteo y página son lecturas separadas.
         */
        get: operations["getWatchlist"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/me/watchlist/{tituloId}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                tituloId: components["schemas"]["TituloId"];
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Agrega una referencia a Mi Lista */
        post: operations["addToWatchlist"];
        /**
         * Elimina una referencia de Mi Lista
         * @description Idempotente: devuelve 204 aunque no exista.
         */
        delete: operations["removeFromWatchlist"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/me/preferences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Lista señales explícitas del usuario
         * @description Orden updatedAt descendente, tituloId ascendente; offset máximo 10000. No calcula recomendaciones.
         */
        get: operations["getContentPreferences"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/me/preferences/{tituloId}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                tituloId: components["schemas"]["TituloId"];
            };
            cookie?: never;
        };
        get?: never;
        /**
         * Crea o cambia LIKE/DISLIKE
         * @description PUT idempotente: repetir valor conserva updatedAt; cambiarlo conserva createdAt. No admite usuarioId en entrada.
         */
        put: operations["setContentPreference"];
        post?: never;
        /**
         * Elimina una señal explícita
         * @description Idempotente, incluso si no existía.
         */
        delete: operations["removeContentPreference"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Comprueba PostgreSQL y par de claves JWT */
        get: operations["health"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/.well-known/jwks.json": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Publica solo clave pública RSA
         * @description Consumidores fijan issuer, audience, RS256 y exp y seleccionan kid; no siguen jku del token. En esta versión se publica una única clave activa.
         */
        get: operations["jwks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @example usr_00000000-0000-4000-8000-000000000001 */
        UserId: string;
        /**
         * @description Referencia externa del contrato de Catálogo; sin FK ni consulta síncrona a Catalog.
         * @example ttl_00000000-0000-4000-8000-000000000001
         */
        TituloId: string;
        /** @enum {string} */
        Status: "ACTIVE" | "INACTIVE";
        /** @enum {string} */
        Role: "USER" | "ADMIN";
        /** @enum {string} */
        PreferenceValue: "LIKE" | "DISLIKE";
        /** @description 12–128 caracteres Unicode, sin NUL. No se recorta ni se normaliza; admite frases. */
        Password: string;
        Profile: {
            displayName: string;
            /**
             * Format: uri
             * @description URL HTTP(S) sin credenciales. null elimina el avatar; no se descarga desde el servidor.
             */
            avatarUrl: string | null;
            /** @example es */
            preferredLanguage: string;
        };
        ProfilePatch: {
            displayName?: string;
            /**
             * Format: uri
             * @description URL HTTP(S) sin credenciales. null elimina el avatar; no se descarga desde el servidor.
             */
            avatarUrl?: string | null;
            /** @example es */
            preferredLanguage?: string;
        };
        AuthUser: {
            userId: components["schemas"]["UserId"];
            /** Format: email */
            email: string;
            displayName: string;
            status: components["schemas"]["Status"];
            role: components["schemas"]["Role"];
        };
        User: {
            userId: components["schemas"]["UserId"];
            /** Format: email */
            email: string;
            status: components["schemas"]["Status"];
            role: components["schemas"]["Role"];
            profile: components["schemas"]["Profile"];
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        RegisterInput: {
            /** Format: email */
            email: string;
            password: components["schemas"]["Password"];
            displayName: string;
        };
        RegisterOutput: {
            user: components["schemas"]["AuthUser"];
        };
        LoginInput: {
            /** Format: email */
            email: string;
            password: string;
        };
        Session: {
            /** @description JWT RS256. Mantener en memoria del cliente; no contiene email ni passwordHash. */
            accessToken: string;
            /** @example 900 */
            expiresIn: number;
            user: components["schemas"]["AuthUser"];
        };
        ChangePassword: {
            currentPassword: string;
            newPassword: components["schemas"]["Password"];
        };
        WatchlistItem: {
            tituloId: components["schemas"]["TituloId"];
            /** Format: date-time */
            addedAt: string;
        };
        ContentPreference: {
            tituloId: components["schemas"]["TituloId"];
            value: components["schemas"]["PreferenceValue"];
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        PreferenceInput: {
            value: components["schemas"]["PreferenceValue"];
        };
        Pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
        Watchlist: {
            items: components["schemas"]["WatchlistItem"][];
            pagination: components["schemas"]["Pagination"];
        };
        Preferences: {
            items: components["schemas"]["ContentPreference"][];
            pagination: components["schemas"]["Pagination"];
        };
        Health: {
            /** @enum {string} */
            status: "ok";
            /** @enum {string} */
            service: "users-service";
        };
        JWKS: {
            keys: {
                /** @enum {string} */
                kty: "RSA";
                n: string;
                e: string;
                kid: string;
                /** @enum {string} */
                alg: "RS256";
                /** @enum {string} */
                use: "sig";
            }[];
        };
        Error: {
            error: {
                code: string;
                message: string;
                /** Format: uuid */
                requestId: string;
            };
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    registerUser: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "email": "samuel@example.com",
                 *       "password": "PasswordSegura123!",
                 *       "displayName": "Samuel"
                 *     }
                 */
                "application/json": components["schemas"]["RegisterInput"];
            };
        };
        responses: {
            /** @description Usuario creado. */
            201: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RegisterOutput"];
                };
            };
            /** @description VALIDATION_ERROR: JSON, campos, identificadores o paginación inválidos. */
            400: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description FORBIDDEN: origen/CSRF o permisos insuficientes. */
            403: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description EMAIL_ALREADY_EXISTS o WATCHLIST_ITEM_ALREADY_EXISTS. */
            409: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description PAYLOAD_TOO_LARGE. */
            413: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description UNSUPPORTED_MEDIA_TYPE: requiere JSON UTF-8 sin compresión. */
            415: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description RATE_LIMIT_EXCEEDED; Retry-After indica segundos restantes. */
            429: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description INTERNAL_SERVER_ERROR; sin stack ni mensajes internos. */
            500: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Error general; métodos no permitidos devuelven 405 con Allow. */
            default: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    loginUser: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "email": "samuel@example.com",
                 *       "password": "PasswordSegura123!"
                 *     }
                 */
                "application/json": components["schemas"]["LoginInput"];
            };
        };
        responses: {
            /** @description JWT de acceso y usuario. Refresh solo en cookie, nunca en el body. */
            200: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    /** @description users_refresh; HttpOnly; SameSite=Strict; Path=/api/v1/auth; Secure en APP_ENV=production. Sin Domain. */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Session"];
                };
            };
            /** @description VALIDATION_ERROR: JSON, campos, identificadores o paginación inválidos. */
            400: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description UNAUTHORIZED o INVALID_CREDENTIALS. No distingue email/contraseña incorrectos, usuario inactivo o refresh inválido. */
            401: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description FORBIDDEN: origen/CSRF o permisos insuficientes. */
            403: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description PAYLOAD_TOO_LARGE. */
            413: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description UNSUPPORTED_MEDIA_TYPE: requiere JSON UTF-8 sin compresión. */
            415: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description RATE_LIMIT_EXCEEDED; Retry-After indica segundos restantes. */
            429: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description INTERNAL_SERVER_ERROR; sin stack ni mensajes internos. */
            500: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Error general; métodos no permitidos devuelven 405 con Allow. */
            default: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    refreshSession: {
        parameters: {
            query?: never;
            header?: {
                /** @description Obligatoria con valor 1 cuando no se envía Origin. Si se envía Origin, debe coincidir exactamente con APP_ORIGIN. */
                "X-CSRF-Protection"?: "1";
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description JWT de acceso y usuario. Refresh solo en cookie, nunca en el body. */
            200: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    /** @description users_refresh; HttpOnly; SameSite=Strict; Path=/api/v1/auth; Secure en APP_ENV=production. Sin Domain. */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Session"];
                };
            };
            /** @description VALIDATION_ERROR: JSON, campos, identificadores o paginación inválidos. */
            400: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description UNAUTHORIZED o INVALID_CREDENTIALS. No distingue email/contraseña incorrectos, usuario inactivo o refresh inválido. */
            401: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description FORBIDDEN: origen/CSRF o permisos insuficientes. */
            403: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description RATE_LIMIT_EXCEEDED; Retry-After indica segundos restantes. */
            429: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description INTERNAL_SERVER_ERROR; sin stack ni mensajes internos. */
            500: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Error general; métodos no permitidos devuelven 405 con Allow. */
            default: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    logoutUser: {
        parameters: {
            query?: never;
            header?: {
                /** @description Obligatoria con valor 1 cuando no se envía Origin. Si se envía Origin, debe coincidir exactamente con APP_ORIGIN. */
                "X-CSRF-Protection"?: "1";
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sesión revocada, sin contenido. */
            204: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    /** @description Elimina users_refresh mediante Max-Age=0. */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description VALIDATION_ERROR: JSON, campos, identificadores o paginación inválidos. */
            400: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description UNAUTHORIZED o INVALID_CREDENTIALS. No distingue email/contraseña incorrectos, usuario inactivo o refresh inválido. */
            401: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description FORBIDDEN: origen/CSRF o permisos insuficientes. */
            403: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description RATE_LIMIT_EXCEEDED; Retry-After indica segundos restantes. */
            429: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description INTERNAL_SERVER_ERROR; sin stack ni mensajes internos. */
            500: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Error general; métodos no permitidos devuelven 405 con Allow. */
            default: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getCurrentUser: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Usuario y perfil. */
            200: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["User"];
                };
            };
            /** @description VALIDATION_ERROR: JSON, campos, identificadores o paginación inválidos. */
            400: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description UNAUTHORIZED o INVALID_CREDENTIALS. No distingue email/contraseña incorrectos, usuario inactivo o refresh inválido. */
            401: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description INTERNAL_SERVER_ERROR; sin stack ni mensajes internos. */
            500: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Error general; métodos no permitidos devuelven 405 con Allow. */
            default: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    updateProfile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "displayName": "Samuel actualizado",
                 *       "avatarUrl": null
                 *     }
                 */
                "application/json": components["schemas"]["ProfilePatch"];
            };
        };
        responses: {
            /** @description Perfil actualizado. */
            200: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["User"];
                };
            };
            /** @description VALIDATION_ERROR: JSON, campos, identificadores o paginación inválidos. */
            400: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description UNAUTHORIZED o INVALID_CREDENTIALS. No distingue email/contraseña incorrectos, usuario inactivo o refresh inválido. */
            401: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description FORBIDDEN: origen/CSRF o permisos insuficientes. */
            403: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description PAYLOAD_TOO_LARGE. */
            413: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description UNSUPPORTED_MEDIA_TYPE: requiere JSON UTF-8 sin compresión. */
            415: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description INTERNAL_SERVER_ERROR; sin stack ni mensajes internos. */
            500: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Error general; métodos no permitidos devuelven 405 con Allow. */
            default: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    changePassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "currentPassword": "PasswordSegura123!",
                 *       "newPassword": "NuevaPasswordSegura456!"
                 *     }
                 */
                "application/json": components["schemas"]["ChangePassword"];
            };
        };
        responses: {
            /** @description Contraseña cambiada; volver a iniciar sesión. Se borra cookie. */
            204: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description VALIDATION_ERROR: JSON, campos, identificadores o paginación inválidos. */
            400: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description UNAUTHORIZED o INVALID_CREDENTIALS. No distingue email/contraseña incorrectos, usuario inactivo o refresh inválido. */
            401: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description FORBIDDEN: origen/CSRF o permisos insuficientes. */
            403: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description PAYLOAD_TOO_LARGE. */
            413: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description UNSUPPORTED_MEDIA_TYPE: requiere JSON UTF-8 sin compresión. */
            415: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description RATE_LIMIT_EXCEEDED; Retry-After indica segundos restantes. */
            429: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description INTERNAL_SERVER_ERROR; sin stack ni mensajes internos. */
            500: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Error general; métodos no permitidos devuelven 405 con Allow. */
            default: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getWatchlist: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Referencias sin metadata de Catálogo. */
            200: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Watchlist"];
                };
            };
            /** @description VALIDATION_ERROR: JSON, campos, identificadores o paginación inválidos. */
            400: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description UNAUTHORIZED o INVALID_CREDENTIALS. No distingue email/contraseña incorrectos, usuario inactivo o refresh inválido. */
            401: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description INTERNAL_SERVER_ERROR; sin stack ni mensajes internos. */
            500: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Error general; métodos no permitidos devuelven 405 con Allow. */
            default: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    addToWatchlist: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                tituloId: components["schemas"]["TituloId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Referencia agregada. */
            201: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WatchlistItem"];
                };
            };
            /** @description VALIDATION_ERROR: JSON, campos, identificadores o paginación inválidos. */
            400: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description UNAUTHORIZED o INVALID_CREDENTIALS. No distingue email/contraseña incorrectos, usuario inactivo o refresh inválido. */
            401: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description FORBIDDEN: origen/CSRF o permisos insuficientes. */
            403: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description USER_NOT_FOUND. */
            404: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description EMAIL_ALREADY_EXISTS o WATCHLIST_ITEM_ALREADY_EXISTS. */
            409: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description INTERNAL_SERVER_ERROR; sin stack ni mensajes internos. */
            500: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Error general; métodos no permitidos devuelven 405 con Allow. */
            default: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    removeFromWatchlist: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                tituloId: components["schemas"]["TituloId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Referencia eliminada. */
            204: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description VALIDATION_ERROR: JSON, campos, identificadores o paginación inválidos. */
            400: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description UNAUTHORIZED o INVALID_CREDENTIALS. No distingue email/contraseña incorrectos, usuario inactivo o refresh inválido. */
            401: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description FORBIDDEN: origen/CSRF o permisos insuficientes. */
            403: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description USER_NOT_FOUND. */
            404: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description INTERNAL_SERVER_ERROR; sin stack ni mensajes internos. */
            500: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Error general; métodos no permitidos devuelven 405 con Allow. */
            default: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getContentPreferences: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Preferencias del usuario autenticado. */
            200: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Preferences"];
                };
            };
            /** @description VALIDATION_ERROR: JSON, campos, identificadores o paginación inválidos. */
            400: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description UNAUTHORIZED o INVALID_CREDENTIALS. No distingue email/contraseña incorrectos, usuario inactivo o refresh inválido. */
            401: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description INTERNAL_SERVER_ERROR; sin stack ni mensajes internos. */
            500: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Error general; métodos no permitidos devuelven 405 con Allow. */
            default: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    setContentPreference: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                tituloId: components["schemas"]["TituloId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "value": "LIKE"
                 *     }
                 */
                "application/json": components["schemas"]["PreferenceInput"];
            };
        };
        responses: {
            /** @description Preferencia guardada. */
            200: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContentPreference"];
                };
            };
            /** @description VALIDATION_ERROR: JSON, campos, identificadores o paginación inválidos. */
            400: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description UNAUTHORIZED o INVALID_CREDENTIALS. No distingue email/contraseña incorrectos, usuario inactivo o refresh inválido. */
            401: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description FORBIDDEN: origen/CSRF o permisos insuficientes. */
            403: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description USER_NOT_FOUND. */
            404: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description PAYLOAD_TOO_LARGE. */
            413: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description UNSUPPORTED_MEDIA_TYPE: requiere JSON UTF-8 sin compresión. */
            415: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description INTERNAL_SERVER_ERROR; sin stack ni mensajes internos. */
            500: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Error general; métodos no permitidos devuelven 405 con Allow. */
            default: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    removeContentPreference: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                tituloId: components["schemas"]["TituloId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Preferencia eliminada. */
            204: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description VALIDATION_ERROR: JSON, campos, identificadores o paginación inválidos. */
            400: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description UNAUTHORIZED o INVALID_CREDENTIALS. No distingue email/contraseña incorrectos, usuario inactivo o refresh inválido. */
            401: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description FORBIDDEN: origen/CSRF o permisos insuficientes. */
            403: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description USER_NOT_FOUND. */
            404: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description INTERNAL_SERVER_ERROR; sin stack ni mensajes internos. */
            500: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Error general; métodos no permitidos devuelven 405 con Allow. */
            default: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    health: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Servicio disponible. */
            200: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Health"];
                };
            };
            /** @description INTERNAL_SERVER_ERROR; sin stack ni mensajes internos. */
            500: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description SERVICE_UNAVAILABLE. */
            503: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Error general; métodos no permitidos devuelven 405 con Allow. */
            default: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    jwks: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description JSON Web Key Set público. */
            200: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JWKS"];
                };
            };
            /** @description VALIDATION_ERROR: JSON, campos, identificadores o paginación inválidos. */
            400: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description INTERNAL_SERVER_ERROR; sin stack ni mensajes internos. */
            500: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Error general; métodos no permitidos devuelven 405 con Allow. */
            default: {
                headers: {
                    /** @description ID generado por el servidor y correlacionado con logs. */
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
}
