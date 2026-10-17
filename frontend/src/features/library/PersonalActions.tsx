"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bookmark, Check, ThumbsUp, ThumbsDown } from "lucide-react";
import { api } from "../../lib/api/client";
interface State {
  watchlist: { known: boolean; item: unknown };
  preference: { known: boolean; item: { value: "LIKE" | "DISLIKE" } | null };
}
export function PersonalActions({
  userId,
  tituloId,
}: {
  userId: string;
  tituloId: string;
}) {
  const key = ["state", userId, tituloId],
    client = useQueryClient();
  const q = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      api<State>(`state/${tituloId}`, "GET", undefined, signal),
  });
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function change(
    kind: "watchlist" | "preferences",
    value?: "LIKE" | "DISLIKE",
  ) {
    if (!q.data || pending) return;
    const old = q.data;
    setError("");
    setPending(true);
    await client.cancelQueries({ queryKey: key });
    const remove =
      kind === "watchlist"
        ? !!old.watchlist.item
        : old.preference.item?.value === value;
    client.setQueryData<State>(
      key,
      kind === "watchlist"
        ? { ...old, watchlist: { known: true, item: remove ? null : {} } }
        : {
            ...old,
            preference: {
              known: true,
              item: remove ? null : { value: value! },
            },
          },
    );
    try {
      await api(
        `${kind}/${tituloId}`,
        remove ? "DELETE" : kind === "watchlist" ? "POST" : "PUT",
        kind === "preferences" && !remove ? { value } : undefined,
      );
      await client.invalidateQueries({ queryKey: [kind, userId] });
    } catch (e) {
      client.setQueryData(key, old);
      setError(
        e instanceof Error ? e.message : "No pudimos guardar el cambio.",
      );
    } finally {
      setPending(false);
    }
  }
  if (q.isError)
    return (
      <div className="error">
        <p>No pudimos comprobar Mi Lista y tus gustos.</p>
        <button className="button secondary" onClick={() => q.refetch()}>
          Reintentar
        </button>
      </div>
    );
  const known = q.data?.watchlist.known && q.data.preference.known;
  return (
    <div>
      <div className="actions">
        <button
          className="button secondary"
          aria-pressed={!!q.data?.watchlist.item}
          disabled={!known || pending}
          onClick={() => change("watchlist")}
        >
          {q.data?.watchlist.item ? (
            <Check size={17} />
          ) : (
            <Bookmark size={17} />
          )}{" "}
          {q.isPending
            ? "Comprobando…"
            : q.data?.watchlist.item
              ? "En Mi Lista"
              : "+ Mi Lista"}
        </button>
        <button
          className="button secondary"
          aria-pressed={q.data?.preference.item?.value === "LIKE"}
          disabled={!known || pending}
          onClick={() => change("preferences", "LIKE")}
        >
          <ThumbsUp size={17} />
          Me gusta
        </button>
        <button
          className="button secondary"
          aria-pressed={q.data?.preference.item?.value === "DISLIKE"}
          disabled={!known || pending}
          onClick={() => change("preferences", "DISLIKE")}
        >
          <ThumbsDown size={17} />
          No me gusta
        </button>
      </div>
      {!known && !q.isPending && (
        <p className="hint">
          Tu colección es muy extensa para comprobarla aquí. Adminístrala desde
          Mi Lista o Tus gustos.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
