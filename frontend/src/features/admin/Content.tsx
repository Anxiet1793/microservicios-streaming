"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Upload, ArrowUpRight } from "lucide-react";
import { api } from "../../lib/api/client";
import type { Page, Title } from "../../lib/models";
import s from "./admin.module.css";
export function Content() {
  const [page, setPage] = useState(1),
    [status, setStatus] = useState(""),
    [target, setTarget] = useState<Title | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const q = useQuery({
    queryKey: ["admin-catalog", page, status],
    queryFn: ({ signal }) =>
      api<Page<Title>>(
        `admin/catalog?page=${page}&limit=20${status ? `&status=${status}` : ""}`,
        "GET",
        undefined,
        signal,
      ),
  });
  async function change() {
    if (!target) return;
    setPending(true);
    setError("");
    try {
      await api(`admin/catalog/${target.tituloId}/publication-status`, "PATCH", {
        publicationStatusId: target.publicationStatusId === 1 ? 2 : 3,
      });
      await q.refetch();
      dialog.current?.close();
      setTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos actualizar el estado.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <span className="eyebrow">EL ARCHIVO DE NÉVARO</span>
      <div className={s.heading}>
        <div>
          <h1>Contenido</h1>
          <p className="muted">Prepara, publica y cuida cada historia.</p>
        </div>
        <Link className="button" href="/admin/upload">
          <Upload size={17} />
          Subir video
        </Link>
      </div>
      <label className="field" style={{ maxWidth: 220 }}>
        <span>Estado editorial</span>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos</option>
          <option value="1">Registrado</option>
          <option value="2">Publicado</option>
          <option value="3">Retirado</option>
        </select>
      </label>
      {q.isPending ? (
        <p role="status">Cargando contenido…</p>
      ) : q.isError ? (
        <div className="error">
          <p>No pudimos cargar el catálogo.</p>
          <button className="button secondary" onClick={() => q.refetch()}>
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <p className="hint">{q.data.pagination.total} títulos</p>
          <div className={s.table}>
            {q.data.data.map((t) => (
              <article key={t.tituloId}>
                <div>
                  <h2>{t.ficha.title}</h2>
                  <span className="hint">
                    {t.typeId === 1 ? "Película" : "Serie"} · {t.ficha.releaseYear}
                  </span>
                </div>
                <span className={s.badge}>
                  {["", "Registrado", "Publicado", "Retirado"][t.publicationStatusId]}
                </span>
                <div className="actions">
                  <Link className="button secondary" href={`/admin/content/${t.tituloId}`}>
                    Editar ficha
                  </Link>
                  {t.publicationStatusId !== 3 && (
                    <button
                      className="button secondary"
                      onClick={() => {
                        setTarget(t);
                        setError("");
                        dialog.current?.showModal();
                      }}
                    >
                      {t.publicationStatusId === 1 ? "Publicar" : "Retirar"}
                    </button>
                  )}
                  {t.publicationStatusId === 2 && (
                    <Link
                      className="button ghost"
                      href={`/title/${t.tituloId}`}
                      aria-label={`Ver ${t.ficha.title}`}
                    >
                      <ArrowUpRight size={18} />
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
          <nav className="actions" aria-label="Paginación" style={{ marginTop: 24 }}>
            <button
              className="button secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </button>
            <span>
              {page} / {Math.max(1, q.data.pagination.totalPages)}
            </span>
            <button
              className="button secondary"
              disabled={page >= q.data.pagination.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </button>
          </nav>
        </>
      )}
      <dialog ref={dialog} className={s.dialog} aria-labelledby="publication-title">
        <h2 id="publication-title">
          {target?.publicationStatusId === 1 ? "Publicar título" : "Retirar título"}
        </h2>
        <p>{target?.ficha.title}</p>
        <p className="muted">
          {target?.publicationStatusId === 1
            ? "Estará visible en el catálogo. Comprobaremos el video antes de publicarlo."
            : "Dejará de estar disponible para nuevas reproducciones. Esta transición no se puede deshacer."}
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button
            className="button secondary"
            onClick={() => dialog.current?.close()}
            disabled={pending}
          >
            Cancelar
          </button>
          <button
            className={`button ${target?.publicationStatusId === 2 ? "danger" : ""}`}
            onClick={change}
            disabled={pending}
          >
            {pending
              ? "Guardando…"
              : target?.publicationStatusId === 1
                ? "Publicar título"
                : "Retirar título"}
          </button>
        </div>
      </dialog>
    </>
  );
}
