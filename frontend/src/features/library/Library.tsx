"use client";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../lib/api/client";
import type { Page, Reference } from "../../lib/models";
import { Card, Message } from "../../components/ui";
import s from "../../components/ui.module.css";
const names: Record<string, string> = {
  watchlist: "Mi Lista",
  "continue-watching": "Continuar viendo",
  history: "Historial",
  preferences: "Tus gustos",
};
export function Library({
  kind,
  userId,
  compact = false,
}: {
  kind: string;
  userId: string;
  compact?: boolean;
}) {
  const [page, setPage] = useState(1),
    [error, setError] = useState("");
  const queryClient = useQueryClient();
  const limit = compact ? 4 : 20;
  const query = useQuery({
    queryKey: [kind, userId, page, limit],
    queryFn: ({ signal }) =>
      api<Page<Reference>>(
        `library/${kind}?page=${page}&limit=${limit}`,
        "GET",
        undefined,
        signal,
      ),
    staleTime: 10000,
  });
  async function remove(item: Reference) {
    setError("");
    try {
      await api(`${kind}/${item.tituloId}`, "DELETE");
      await queryClient.invalidateQueries({ queryKey: [kind, userId] });
      await queryClient.invalidateQueries({
        queryKey: ["state", userId, item.tituloId],
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos guardar el cambio.",
      );
    }
  }
  if (query.isPending)
    return (
      <div aria-busy="true">
        <span className="srOnly">Cargando {names[kind]}</span>
        <div className={s.landscapeGrid} style={{ display: "grid", gap: 16 }}>
          {[1, 2, 3, 4].map((n) => (
            <div className="skeleton" key={n} />
          ))}
        </div>
      </div>
    );
  if (query.isError)
    return (
      <div className="error" role="alert">
        <p>
          No pudimos cargar {names[kind]?.toLowerCase()}. Tu información sigue
          guardada.
        </p>
        <button className="button secondary" onClick={() => query.refetch()}>
          Reintentar
        </button>
      </div>
    );
  if (!query.data.data.length)
    return compact ? (
      <p className="muted">
        {kind === "continue-watching"
          ? "Tu próxima reproducción aparecerá aquí para continuar después."
          : "Guarda una historia desde su ficha para encontrarla aquí."}
      </p>
    ) : (
      <Message
        title={
          kind === "watchlist"
            ? "Guarda algo para después."
            : kind === "history"
              ? "Tu historial empieza con tu primera reproducción."
              : kind === "preferences"
                ? "Cuéntanos qué te gusta."
                : "Todavía no tienes historias pendientes."
        }
      >
        Explora el catálogo y encuentra tu próxima historia.
      </Message>
    );
  return (
    <>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div
        className={`${s.grid} ${kind !== "watchlist" ? s.landscapeGrid : ""}`}
      >
        {query.data.data.map((item) => (
          <div key={item.tituloId}>
            {item.title ? (
              <Card
                title={item.title}
                reference={item}
                landscape={kind !== "watchlist"}
              />
            ) : (
              <div className="error">
                <p>
                  {item.resolution === "failed"
                    ? "No pudimos cargar esta ficha."
                    : "Título no disponible"}
                </p>
                <small>{item.tituloId}</small>
              </div>
            )}
            {kind === "history" && (
              <p className="hint">
                {item.completed ? "Completado" : "En curso"}
                {item.lastPlayedAt
                  ? ` · ${new Date(item.lastPlayedAt).toLocaleDateString("es-PE")}`
                  : ""}
              </p>
            )}
            {kind === "preferences" && (
              <p className="hint">
                {item.value === "LIKE" ? "Me gusta" : "No me gusta"}
              </p>
            )}
            {!compact && ["watchlist", "preferences"].includes(kind) && (
              <button className="button ghost" onClick={() => remove(item)}>
                Quitar {kind === "watchlist" ? "de Mi Lista" : "señal"}
              </button>
            )}
          </div>
        ))}
      </div>
      {!compact && query.data.pagination.totalPages > 1 && (
        <nav
          className="actions"
          style={{ justifyContent: "center", marginTop: 32 }}
          aria-label="Paginación"
        >
          <button
            className="button secondary"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            Anterior
          </button>
          <span>
            {page} de {query.data.pagination.totalPages}
          </span>
          <button
            className="button secondary"
            onClick={() => setPage(page + 1)}
            disabled={page >= query.data.pagination.totalPages}
          >
            Siguiente
          </button>
        </nav>
      )}
      {compact && (
        <Link
          href={kind === "watchlist" ? "/my-list" : `/${kind}`}
          className="srOnly"
        >
          Ver todos
        </Link>
      )}
    </>
  );
}
