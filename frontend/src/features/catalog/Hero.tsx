import Link from "next/link";
import { Play, ArrowRight } from "lucide-react";
import type { Title } from "../../lib/models";
import s from "./catalog.module.css";
export function Hero({ title, detail = false }: { title: Title; detail?: boolean }) {
  const playable = title.typeId === 1 && title.playbackReference && title.publicationStatusId === 2;
  return (
    <section className={s.hero}>
      {title.ficha.backdropUrl && (
        <img className={s.heroImage} src={title.ficha.backdropUrl} alt="" />
      )}
      <div className={s.heroContent}>
        <span className="eyebrow">
          {detail ? (title.typeId === 1 ? "PELÍCULA" : "SERIE") : "UNA HISTORIA PARA HOY"}
        </span>
        <h1>{title.ficha.title}</h1>
        <div className={s.meta}>
          <span>{title.ficha.releaseYear}</span>
          <span>{title.typeId === 1 ? "Película" : "Serie"}</span>
          {title.ficha.durationMinutes && <span>{title.ficha.durationMinutes} min</span>}
          {title.ficha.ageRatingName && <span>{title.ficha.ageRatingName}</span>}
        </div>
        {title.ficha.synopsis && (
          <p>
            {title.ficha.synopsis.slice(0, detail ? 500 : 230)}
            {title.ficha.synopsis.length > (detail ? 500 : 230) ? "…" : ""}
          </p>
        )}
        <div className="actions">
          {playable ? (
            <Link className="button" href={`/watch/${title.tituloId}`}>
              <Play size={17} fill="currentColor" />
              Reproducir
            </Link>
          ) : (
            <p>
              {title.typeId === 2
                ? "Episodios todavía no disponibles."
                : "Este título todavía no tiene un video disponible."}
            </p>
          )}
          {!detail && (
            <Link className="button secondary" href={`/title/${title.tituloId}`}>
              Ver detalles <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </div>
      {!detail && <span className={s.heroCount}>DESCUBRE A TU RITMO — NÉVARO</span>}
    </section>
  );
}
