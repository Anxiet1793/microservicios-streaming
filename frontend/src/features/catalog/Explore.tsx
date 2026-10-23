import Link from "next/link";
import { catalog } from "../../lib/server/catalog";
import { genres } from "../../lib/models";
import { Grid, Message } from "../../components/ui";
import s from "./catalog.module.css";
import { SearchField } from "./SearchField";
import { exploreQuery } from "./query";
export async function Explore({
  query,
  search = false,
}: {
  query: Record<string, string | string[] | undefined>;
  search?: boolean;
}) {
  const params = exploreQuery(query);
  const page = await catalog(params);
  const base = search ? "/search" : "/explore";
  const href = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    return `${base}?${next}`;
  };
  return (
    <>
      <span className="eyebrow">ELIGE TU PRÓXIMA HISTORIA</span>
      <div className={s.welcome}>
        <h1>
          {search
            ? params.get("q")
              ? `Resultados para “${params.get("q")}”`
              : "Busca una película o serie"
            : "Un mundo por descubrir."}
        </h1>
        <p>{page.pagination.total} títulos</p>
      </div>
      <nav className={s.tabs} aria-label="Tipo de contenido">
        {[
          ["", "Todo"],
          ["1", "Películas"],
          ["2", "Series"],
        ].map(([value, label]) => (
          <Link
            key={label}
            href={href({ type: value!, page: "1" })}
            aria-current={(params.get("type") || "") === value ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <form action={base} className={s.filters}>
        {params.get("type") && <input type="hidden" name="type" value={params.get("type")!} />}
        <label>
          Buscar
          <SearchField value={params.get("q") || ""} base={base} />
        </label>
        <label>
          Género
          <select name="genre" defaultValue={params.get("genre") || ""}>
            <option value="">Todos los géneros</option>
            {genres.map((g, i) => (
              <option key={g} value={i + 1}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label>
          Año
          <input
            type="number"
            name="year"
            min={1888}
            max={9999}
            defaultValue={params.get("year") || ""}
            placeholder="Cualquier año"
          />
        </label>
        <div className={s.filterActions}>
          <button className="button secondary">Aplicar filtros</button>
          <Link href={base} className="button ghost">
            Limpiar
          </Link>
        </div>
      </form>
      {page.data.length ? (
        <Grid titles={page.data} />
      ) : (
        <Message title="No encontramos títulos con esos filtros.">
          Prueba otra búsqueda o limpia los filtros.
        </Message>
      )}
      {page.pagination.totalPages > 1 && (
        <nav className={s.pagination} aria-label="Paginación">
          {page.pagination.page > 1 && (
            <Link
              className="button secondary"
              href={href({ page: String(page.pagination.page - 1) })}
            >
              Anterior
            </Link>
          )}
          <span>
            {page.pagination.page} de {page.pagination.totalPages}
          </span>
          {page.pagination.page < page.pagination.totalPages && (
            <Link
              className="button secondary"
              href={href({ page: String(page.pagination.page + 1) })}
            >
              Siguiente
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
