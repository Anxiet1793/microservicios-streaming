export interface paths {
    "/api/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Comprueba disponibilidad de MongoDB */
        get: operations["getHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/catalog": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Lista títulos con proyección reducida y paginación
         * @description Orden updatedAt descendente y tituloId ascendente. Offset máximo 10000.
         *     q busca palabras mediante MongoDB $text, no subcadenas. Conteo y página
         *     son lecturas separadas; no garantizan una instantánea bajo concurrencia.
         */
        get: operations["getCatalogTitles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/catalog/bulk": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Importa títulos mediante INSERT masivo, sin sobrescribir
         * @description Límite predeterminado 500 elementos y 5 MiB por petición; configurables hasta
         *     1000 y 10 MiB. Se valida cada registro y se procesan los válidos en un bulkWrite
         *     ordered:false. Una envoltura inválida rechaza toda la petición sin escrituras.
         *     importKey es inmutable y sensible a mayúsculas. Misma clave y contenido inicial
         *     canónico equivale a duplicado, incluso después de ediciones editoriales.
         *     Misma clave con contenido distinto produce IMPORT_KEY_CONFLICT.
         *     Claves repetidas y contradictorias dentro del lote rechazan todo ese grupo.
         *     207 exige revisar cada resultado. 503 puede contener resultados indeterminados:
         *     reintentar con las mismas claves; no asumir que no hubo escrituras.
         */
        post: operations["bulkCreateCatalogTitles"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/catalog/{tituloId}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                tituloId: components["parameters"]["TituloId"];
            };
            cookie?: never;
        };
        /**
         * Obtiene la ficha completa y referencia técnica de un título
         * @description Contrato para el futuro servicio Reproducción. Este consumidor debe comprobar
         *     publicationStatusId=2. Una serie tiene playbackReference=null; los endpoints
         *     de episodios no forman parte de esta versión. La referencia no es una URL
         *     firmada ni una sesión, y el estado puede cambiar después de la consulta.
         */
        get: operations["getCatalogTitleById"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Actualiza únicamente campos editoriales de ficha
         * @description PATCH parcial; los campos ausentes se conservan. null elimina opcionales.
         *     title, synopsis, releaseYear, genres, languages y durationMinutes no admiten
         *     null. No se admiten IDs, tipo, estado, referencia técnica ni fechas.
         *     Una serie no admite durationMinutes. Un cambio idéntico no modifica updatedAt.
         */
        patch: operations["updateCatalogTitle"];
        trace?: never;
    };
    "/api/v1/catalog/{tituloId}/publication-status": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                tituloId: components["parameters"]["TituloId"];
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Cambia el estado editorial por una transición de dominio
         * @description Ciclo permitido: 1 (REGISTRADO) → 2 (PUBLICADO) → 3 (RETIRADO). Repetir el estado actual es idempotente.
         */
        patch: operations["changePublicationStatus"];
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @example ttl_00000000-0000-4000-8000-000000000001 */
        TituloId: string;
        /**
         * @description 1=MOVIE, 2=SERIES
         * @enum {integer}
         */
        TypeId: 1 | 2;
        /**
         * @description 1=REGISTRADO, 2=PUBLICADO, 3=RETIRADO
         * @enum {integer}
         */
        PublicationStatusId: 1 | 2 | 3;
        /**
         * @description 1=SCIENCE_FICTION, 2=DRAMA, 3=COMEDY, 4=ACTION, 5=ADVENTURE, 6=THRILLER, 7=HORROR, 8=ROMANCE, 9=ANIMATION, 10=DOCUMENTARY, 11=FANTASY, 12=MYSTERY, 13=FAMILY, 14=HISTORY, 15=MUSIC
         * @enum {integer}
         */
        GenreId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
        /**
         * @description 1=es, 2=en, 3=pt, 4=fr, 5=de, 6=it, 7=ja, 8=ko, 9=zh, 10=qu
         * @enum {integer}
         */
        LanguageId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
        /**
         * @description 1=NOT_RATED, 2=G, 3=PG, 4=PG-13, 5=R, 6=NC-17
         * @enum {integer}
         */
        AgeRatingId: 1 | 2 | 3 | 4 | 5 | 6;
        Genres: components["schemas"]["GenreId"][];
        Languages: components["schemas"]["LanguageId"][];
        /** @description Campos de texto normalizados con trim; límites contados en caracteres Unicode. */
        ContentSheet: {
            title: string;
            originalTitle?: string;
            synopsis: string;
            releaseYear: number;
            /** @description Obligatoria en películas y prohibida en series. */
            durationMinutes?: number;
            genres: components["schemas"]["Genres"];
            languages: components["schemas"]["Languages"];
            ageRatingId?: components["schemas"]["AgeRatingId"];
            /**
             * Format: uri
             * @description URL HTTP(S) sin credenciales.
             */
            posterUrl?: string;
            /** Format: uri */
            backdropUrl?: string;
            director?: string;
            cast?: string[];
        };
        MovieSheet: components["schemas"]["ContentSheet"] & Record<string, never>;
        SeriesSheet: components["schemas"]["ContentSheet"] & unknown;
        PlaybackReference: {
            /**
             * @description 1=CDN
             * @enum {integer}
             */
            providerId: 1;
            assetId: string;
            manifestKey: string;
        };
        CreateTitle: {
            /** @description Clave opaca sin espacios exteriores; conservar en reintentos. */
            importKey: string;
            /** @enum {integer} */
            typeId: 1;
            ficha: components["schemas"]["MovieSheet"];
            playbackReference: components["schemas"]["PlaybackReference"];
        } | {
            importKey: string;
            /** @enum {integer} */
            typeId: 2;
            ficha: components["schemas"]["SeriesSheet"];
            /**
             * @description Ausente o null.
             * @enum {unknown|null}
             */
            playbackReference?: null;
        };
        UpdateTitle: {
            ficha: {
                title?: string;
                originalTitle?: string | null;
                synopsis?: string;
                releaseYear?: number;
                /** @description Obligatoria en películas y prohibida en series. */
                durationMinutes?: number;
                genres?: components["schemas"]["Genres"];
                languages?: components["schemas"]["Languages"];
                /** @enum {integer|null} */
                ageRatingId?: 1 | 2 | 3 | 4 | 5 | 6 | null;
                /** Format: uri */
                posterUrl?: string | null;
                /** Format: uri */
                backdropUrl?: string | null;
                director?: string | null;
                cast?: string[] | null;
            };
        };
        ContentSheetOutput: {
            title: string;
            originalTitle?: string;
            synopsis: string;
            releaseYear: number;
            /** @description Obligatoria en películas y prohibida en series. */
            durationMinutes?: number;
            genres: components["schemas"]["Genres"];
            languages: components["schemas"]["Languages"];
            ageRatingId?: components["schemas"]["AgeRatingId"];
            /**
             * Format: uri
             * @description URL HTTP(S) sin credenciales.
             */
            posterUrl?: string;
            /** Format: uri */
            backdropUrl?: string;
            director?: string;
            cast: string[];
            genresName: string[];
            languagesName: string[];
            ageRatingName?: string;
        };
        PlaybackReferenceOutput: {
            /**
             * @description 1=CDN
             * @enum {integer}
             */
            providerId: 1;
            assetId: string;
            manifestKey: string;
            /** @enum {string} */
            providerName: "CDN";
        } | null;
        CatalogTitle: {
            tituloId: components["schemas"]["TituloId"];
            typeId: components["schemas"]["TypeId"];
            /** @enum {string} */
            typeName: "MOVIE" | "SERIES";
            ficha: components["schemas"]["ContentSheetOutput"];
            publicationStatusId: components["schemas"]["PublicationStatusId"];
            /** @enum {string} */
            publicationStatusName: "REGISTRADO" | "PUBLICADO" | "RETIRADO";
            playbackReference: components["schemas"]["PlaybackReferenceOutput"];
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        CatalogListItem: {
            tituloId: components["schemas"]["TituloId"];
            typeId: components["schemas"]["TypeId"];
            /** @enum {string} */
            typeName: "MOVIE" | "SERIES";
            publicationStatusId: components["schemas"]["PublicationStatusId"];
            /** @enum {string} */
            publicationStatusName: "REGISTRADO" | "PUBLICADO" | "RETIRADO";
            /** Format: date-time */
            updatedAt: string;
            ficha: {
                title: string;
                releaseYear: number;
                genres: components["schemas"]["Genres"];
                genresName: string[];
                /** Format: uri */
                posterUrl?: string;
            };
        };
        CatalogPage: {
            data: components["schemas"]["CatalogListItem"][];
            pagination: {
                page: number;
                limit: number;
                total: number;
                totalPages: number;
            };
        };
        BulkOutput: {
            /** @description true cuando todos son insertados o duplicados equivalentes. */
            success: boolean;
            summary: {
                received: number;
                inserted: number;
                duplicates: number;
                failed: number;
                indeterminate: number;
            };
            results: ({
                /** @description Índice original de entrada desde cero. */
                index: number;
                /** @enum {string} */
                status: "inserted" | "duplicate";
                tituloId: components["schemas"]["TituloId"];
            } | {
                index: number;
                /** @enum {string} */
                status: "rejected" | "indeterminate";
                code: string;
                issues?: components["schemas"]["ValidationIssues"];
            })[];
            errors: {
                index: number;
                code: string;
            }[];
        };
        ValidationIssues: {
            path: string;
            code: string;
        }[];
        ErrorResponse: {
            error: {
                code: string;
                message: string;
                /** Format: uuid */
                requestId: string;
                issues?: components["schemas"]["ValidationIssues"];
            };
        };
    };
    responses: {
        /** @description Detalle del título, sin metadatos internos de persistencia */
        Title: {
            headers: {
                "x-request-id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["CatalogTitle"];
            };
        };
        /** @description 200 solo duplicados; 201 inserciones sin fallos; 207 mezcla de aceptados y rechazos; 409 solo conflictos. */
        Bulk: {
            headers: {
                "x-request-id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "success": true,
                 *       "summary": {
                 *         "received": 1,
                 *         "inserted": 1,
                 *         "duplicates": 0,
                 *         "failed": 0,
                 *         "indeterminate": 0
                 *       },
                 *       "results": [
                 *         {
                 *           "index": 0,
                 *           "status": "inserted",
                 *           "tituloId": "ttl_00000000-0000-4000-8000-000000000001"
                 *         }
                 *       ],
                 *       "errors": []
                 *     }
                 */
                "application/json": components["schemas"]["BulkOutput"];
            };
        };
        /** @description VALIDATION_ERROR, JSON inválido o cuerpo ilegible */
        ValidationError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description CATALOG_TITLE_NOT_FOUND */
        NotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description CONCURRENT_MODIFICATION; consultar el estado actual antes de reintentar */
        Conflict: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description PAYLOAD_TOO_LARGE; se cuentan los bytes realmente recibidos */
        TooLarge: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Se requiere application/json UTF-8 sin Content-Encoding comprimido */
        UnsupportedMedia: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description DATABASE_UNAVAILABLE o PERSISTENCE_OUTCOME_UNKNOWN; una escritura podría haberse aplicado */
        Unavailable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Error general; 405 incluye Allow, 500 oculta detalles internos */
        Error: {
            headers: {
                "x-request-id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
    };
    parameters: {
        TituloId: components["schemas"]["TituloId"];
    };
    requestBodies: never;
    headers: {
        /** @description UUID generado por el servidor para correlación con logs */
        RequestId: string;
    };
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Servicio y MongoDB disponibles */
            200: {
                headers: {
                    "x-request-id": components["headers"]["RequestId"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "status": "ok",
                     *       "service": "catalog-service"
                     *     }
                     */
                    "application/json": {
                        /** @enum {string} */
                        status: "ok";
                        /** @enum {string} */
                        service: "catalog-service";
                    };
                };
            };
            503: components["responses"]["Unavailable"];
            default: components["responses"]["Error"];
        };
    };
    getCatalogTitles: {
        parameters: {
            query?: {
                /** @example 1 */
                page?: number;
                /** @example 20 */
                limit?: number;
                type?: components["schemas"]["TypeId"];
                status?: components["schemas"]["PublicationStatusId"];
                genre?: components["schemas"]["GenreId"];
                /** @example 2025 */
                year?: number;
                /**
                 * @description Debe contener al menos una letra o número.
                 * @example Órbita
                 */
                q?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Página del catálogo */
            200: {
                headers: {
                    "x-request-id": components["headers"]["RequestId"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "data": [],
                     *       "pagination": {
                     *         "page": 1,
                     *         "limit": 20,
                     *         "total": 0,
                     *         "totalPages": 0
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["CatalogPage"];
                };
            };
            400: components["responses"]["ValidationError"];
            503: components["responses"]["Unavailable"];
            default: components["responses"]["Error"];
        };
    };
    bulkCreateCatalogTitles: {
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
                 *       "items": [
                 *         {
                 *           "importKey": "demo:movie:orbita-de-papel",
                 *           "typeId": 1,
                 *           "ficha": {
                 *             "title": "Órbita de papel",
                 *             "synopsis": "Una expedición recibe una señal.",
                 *             "releaseYear": 2025,
                 *             "durationMinutes": 108,
                 *             "genres": [
                 *               1,
                 *               2
                 *             ],
                 *             "languages": [
                 *               1,
                 *               2
                 *             ]
                 *           },
                 *           "playbackReference": {
                 *             "providerId": 1,
                 *             "assetId": "orbita",
                 *             "manifestKey": "movies/orbita/master.m3u8"
                 *           }
                 *         }
                 *       ]
                 *     }
                 */
                "application/json": {
                    items: components["schemas"]["CreateTitle"][];
                };
            };
        };
        responses: {
            200: components["responses"]["Bulk"];
            201: components["responses"]["Bulk"];
            207: components["responses"]["Bulk"];
            /** @description Envoltura/JSON inválido (ErrorResponse) o todos los registros inválidos (BulkOutput) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"] | components["schemas"]["BulkOutput"];
                };
            };
            409: components["responses"]["Bulk"];
            413: components["responses"]["TooLarge"];
            415: components["responses"]["UnsupportedMedia"];
            /** @description Fallo interno o lote con fallos confirmados de persistencia */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"] | components["schemas"]["BulkOutput"];
                };
            };
            /** @description MongoDB no disponible o resultado de escritura indeterminado */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"] | components["schemas"]["BulkOutput"];
                };
            };
            default: components["responses"]["Error"];
        };
    };
    getCatalogTitleById: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                tituloId: components["parameters"]["TituloId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["Title"];
            400: components["responses"]["ValidationError"];
            404: components["responses"]["NotFound"];
            503: components["responses"]["Unavailable"];
            default: components["responses"]["Error"];
        };
    };
    updateCatalogTitle: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                tituloId: components["parameters"]["TituloId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "ficha": {
                 *         "title": "Órbita revisada",
                 *         "posterUrl": null
                 *       }
                 *     }
                 */
                "application/json": components["schemas"]["UpdateTitle"];
            };
        };
        responses: {
            200: components["responses"]["Title"];
            400: components["responses"]["ValidationError"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            413: components["responses"]["TooLarge"];
            415: components["responses"]["UnsupportedMedia"];
            503: components["responses"]["Unavailable"];
            default: components["responses"]["Error"];
        };
    };
    changePublicationStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                tituloId: components["parameters"]["TituloId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "publicationStatusId": 2
                 *     }
                 */
                "application/json": {
                    publicationStatusId: components["schemas"]["PublicationStatusId"];
                };
            };
        };
        responses: {
            200: components["responses"]["Title"];
            400: components["responses"]["ValidationError"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            413: components["responses"]["TooLarge"];
            415: components["responses"]["UnsupportedMedia"];
            /** @description INVALID_PUBLICATION_TRANSITION */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": {
                     *         "code": "INVALID_PUBLICATION_TRANSITION",
                     *         "message": "No se puede cambiar de RETIRADO a PUBLICADO.",
                     *         "requestId": "c0a80101-0000-4000-8000-000000000001"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            503: components["responses"]["Unavailable"];
            default: components["responses"]["Error"];
        };
    };
}
