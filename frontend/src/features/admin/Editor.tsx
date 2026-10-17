"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api/client";
import { genres, languages, type Title } from "../../lib/models";
import s from "./admin.module.css";
export function TitleFields({
  title,
  duration = 1,
}: {
  title?: Title;
  duration?: number;
}) {
  return (
    <div className={s.fields}>
      <label className={`field ${s.wide}`}>
        <span>Título</span>
        <input
          name="title"
          defaultValue={title?.ficha.title}
          maxLength={300}
          required
        />
      </label>
      <label className={`field ${s.wide}`}>
        <span>Sinopsis</span>
        <textarea
          name="synopsis"
          defaultValue={title?.ficha.synopsis}
          maxLength={10000}
          required
        />
      </label>
      <label className="field">
        <span>Año</span>
        <input
          name="releaseYear"
          type="number"
          defaultValue={title?.ficha.releaseYear || 2026}
          min={1888}
          max={9999}
          required
        />
      </label>
      {title?.typeId !== 2 && (
        <label className="field">
          <span>Duración editorial (minutos)</span>
          <input
            name="durationMinutes"
            type="number"
            defaultValue={title?.ficha.durationMinutes || duration}
            min={1}
            max={100000}
            required
          />
        </label>
      )}
      <label className="field">
        <span>Géneros</span>
        <select
          name="genres"
          multiple
          defaultValue={(title?.ficha.genres || [10]).map(String)}
          required
        >
          {genres.map((g, i) => (
            <option value={i + 1} key={g}>
              {g}
            </option>
          ))}
        </select>
        <small className="hint">Puedes seleccionar varias opciones.</small>
      </label>
      <label className="field">
        <span>Idiomas</span>
        <select
          name="languages"
          multiple
          defaultValue={(title?.ficha.languages || [1]).map(String)}
          required
        >
          {languages.map((g, i) => (
            <option value={i + 1} key={g}>
              {g}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>URL del póster (opcional)</span>
        <input
          name="posterUrl"
          type="url"
          defaultValue={title?.ficha.posterUrl}
          maxLength={2048}
        />
      </label>
      <label className="field">
        <span>URL de portada (opcional)</span>
        <input
          name="backdropUrl"
          type="url"
          defaultValue={title?.ficha.backdropUrl}
          maxLength={2048}
        />
      </label>
    </div>
  );
}
export function ficha(form: HTMLFormElement) {
  const f = new FormData(form);
  return {
    title: String(f.get("title") || ""),
    synopsis: String(f.get("synopsis") || ""),
    releaseYear: Number(f.get("releaseYear")),
    ...(f.has("durationMinutes")
      ? { durationMinutes: Number(f.get("durationMinutes")) }
      : {}),
    genres: f.getAll("genres").map(Number),
    languages: f.getAll("languages").map(Number),
    ...(f.get("posterUrl") ? { posterUrl: String(f.get("posterUrl")) } : {}),
    ...(f.get("backdropUrl")
      ? { backdropUrl: String(f.get("backdropUrl")) }
      : {}),
  };
}
export function Editor({ title }: { title: Title }) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = ficha(e.currentTarget);
    setPending(true);
    setError("");
    setSaved(false);
    try {
      await api(`admin/catalog/${title.tituloId}`, "PATCH", {
        ficha: {
          ...data,
          originalTitle: title.ficha.originalTitle || null,
          ageRatingId: title.ficha.ageRatingId ?? null,
          posterUrl: data.posterUrl || null,
          backdropUrl: data.backdropUrl || null,
          director: title.ficha.director || null,
          cast: title.ficha.cast || null,
        },
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Link href="/admin/content" className="button ghost">
        ← Contenido
      </Link>
      <h1>Editar ficha</h1>
      <p className="muted">El tipo y la referencia del video se conservan.</p>
      <form onSubmit={submit}>
        <TitleFields title={title} />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="success">
            Ficha actualizada.
          </p>
        )}
        <button className="button" disabled={pending}>
          {pending ? "Guardando…" : "Guardar ficha"}
        </button>
      </form>
    </>
  );
}
