import { catalog, title } from "../../../lib/server/catalog";
import { viewer } from "../../../lib/server/guard";
import { Hero } from "../../../features/catalog/Hero";
import { Grid, Message, Section } from "../../../components/ui";
import { Library } from "../../../features/library/Library";
import s from "../../../features/catalog/catalog.module.css";
export const metadata = { title: "Inicio" };
export default async function Home() {
  const user = await viewer();
  let data;
  try {
    data = await catalog(new URLSearchParams({ limit: "12" }));
  } catch {
    return (
      <>
        <h1>¿Qué historia sigue?</h1>
        <Message title="No pudimos cargar el catálogo.">
          Comprueba la conexión y vuelve a intentarlo.
        </Message>
        <Section title="Continuar viendo" href="/continue-watching">
          <Library kind="continue-watching" userId={user.userId} compact />
        </Section>
      </>
    );
  }
  const first = data.data[0],
    featured = first ? await title(first.tituloId).catch(() => first) : null;
  return (
    <>
      <div className={s.welcome}>
        <div>
          <span className="eyebrow">BIENVENIDO A TU SALA</span>
          <p>Qué bueno verte, {user.profile.displayName}.</p>
        </div>
        <p>Historias para ver a tu ritmo.</p>
      </div>
      {featured ? (
        <Hero title={featured} />
      ) : (
        <>
          <h1>¿Qué historia sigue?</h1>
          <Message title="Estamos preparando nuevas historias.">
            El catálogo aún no tiene títulos publicados.
          </Message>
        </>
      )}
      <Section title="Continuar viendo" href="/continue-watching">
        <Library kind="continue-watching" userId={user.userId} compact />
      </Section>
      {data.data.some((t) => t.typeId === 1) && (
        <Section title="Películas" href="/explore?type=1">
          <Grid titles={data.data.filter((t) => t.typeId === 1)} />
        </Section>
      )}
      {data.data.some((t) => t.typeId === 2) && (
        <Section title="Series" href="/explore?type=2">
          <Grid titles={data.data.filter((t) => t.typeId === 2)} />
        </Section>
      )}
      <Section title="Tu selección, para después" href="/my-list">
        <Library kind="watchlist" userId={user.userId} compact />
      </Section>
    </>
  );
}
