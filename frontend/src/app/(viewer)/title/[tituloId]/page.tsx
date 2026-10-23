import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { title } from "../../../../lib/server/catalog";
import { viewer } from "../../../../lib/server/guard";
import { ServiceError } from "../../../../lib/server/http";
import { genres, languages } from "../../../../lib/models";
import { Hero } from "../../../../features/catalog/Hero";
import { PersonalActions } from "../../../../features/library/PersonalActions";
import s from "../../../../features/catalog/catalog.module.css";
export default async function Page({ params }: { params: Promise<{ tituloId: string }> }) {
  const user = await viewer();
  let data;
  try {
    data = await title((await params).tituloId);
  } catch (e) {
    if (e instanceof ServiceError && e.status === 404) notFound();
    throw e;
  }
  return (
    <article className={s.detail}>
      <Link href="/explore" className={s.back}>
        <ArrowLeft size={16} />
        Volver a explorar
      </Link>
      <Hero title={data} detail />
      <PersonalActions userId={user.userId} tituloId={data.tituloId} />
      <div className={s.detailsGrid}>
        <section>
          <span className="eyebrow">LA HISTORIA</span>
          <h2>Sinopsis</h2>
          <p className={s.synopsis}>
            {data.ficha.synopsis || "Todavía no hay una sinopsis disponible."}
          </p>
        </section>
        <section>
          <h2>En la ficha</h2>
          <dl>
            <dt>Géneros</dt>
            <dd>
              {data.ficha.genres
                .map((n) => genres[n - 1])
                .filter(Boolean)
                .join(", ")}
            </dd>
            {data.ficha.director && (
              <>
                <dt>Dirección</dt>
                <dd>{data.ficha.director}</dd>
              </>
            )}
            {data.ficha.cast?.length ? (
              <>
                <dt>Reparto</dt>
                <dd>{data.ficha.cast.join(", ")}</dd>
              </>
            ) : null}
            {data.ficha.languages?.length ? (
              <>
                <dt>Idiomas</dt>
                <dd>
                  {data.ficha.languages
                    .map((n) => languages[n - 1])
                    .filter(Boolean)
                    .join(", ")}
                </dd>
              </>
            ) : null}
          </dl>
        </section>
      </div>
    </article>
  );
}
