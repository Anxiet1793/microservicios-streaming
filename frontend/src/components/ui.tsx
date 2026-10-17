import Link from "next/link";
import { ArrowRight, Film, Play } from "lucide-react";
import { brand } from "../lib/brand";
import type { Reference, Title } from "../lib/models";
import { time } from "../lib/models";
import s from "./ui.module.css";
import { Picture } from "./Picture";
export function Brand() {
  return (
    <Link href="/home" className={s.brand} aria-label={`${brand.name}, Inicio`}>
      <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
        <path d="M5 23V6h5l8 13V3h5v20h-5L10 10v13Z" fill="currentColor" />
      </svg>
      {brand.name}
    </Link>
  );
}
export function Message({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={s.message}>
      <Film size={28} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{children}</p>
      <Link className="button secondary" href="/explore">
        Explorar el catálogo <ArrowRight size={16} />
      </Link>
    </div>
  );
}
export function Poster({
  title,
  landscape = false,
}: {
  title: Title;
  landscape?: boolean;
}) {
  const src = landscape
    ? title.ficha.backdropUrl || title.ficha.posterUrl
    : title.ficha.posterUrl;
  return (
    <div className={`${s.poster} ${landscape ? s.landscape : ""}`}>
      <Picture src={src}>
        <div className={s.art}>
          <span>NÉVARO / ARCHIVO</span>
          <Film size={40} strokeWidth={1} />
          <span>{title.ficha.title}</span>
        </div>
      </Picture>
      <span className={s.corner}>
        {title.typeId === 1 ? "PELÍCULA" : "SERIE"}
      </span>
    </div>
  );
}
export function Card({
  title,
  reference,
  landscape = false,
}: {
  title: Title;
  reference?: Reference;
  landscape?: boolean;
}) {
  return (
    <article className={s.card}>
      <Link href={`/title/${title.tituloId}`}>
        <Poster title={title} landscape={landscape} />
        <h3>{title.ficha.title}</h3>
        <p>
          {title.ficha.releaseYear} <span>·</span>{" "}
          {title.typeId === 1 ? "Película" : "Serie"}
          {title.ficha.durationMinutes
            ? ` · ${title.ficha.durationMinutes} min`
            : ""}
        </p>
      </Link>
      {reference?.progress && (
        <>
          <progress
            max={100}
            value={reference.progress.percentage}
            aria-label={`Progreso de ${title.ficha.title}`}
          />
          <Link className={s.continue} href={`/watch/${title.tituloId}`}>
            <Play size={15} /> Continuar desde{" "}
            {time(reference.progress.positionSeconds)}
          </Link>
        </>
      )}
    </article>
  );
}
export function Section({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <h2>{title}</h2>
        {href && (
          <Link href={href}>
            Ver todo <ArrowRight size={16} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
export function Grid({
  titles,
  landscape = false,
}: {
  titles: Title[];
  landscape?: boolean;
}) {
  return (
    <div className={`${s.grid} ${landscape ? s.landscapeGrid : ""}`}>
      {titles.map((title) => (
        <Card key={title.tituloId} title={title} landscape={landscape} />
      ))}
    </div>
  );
}
