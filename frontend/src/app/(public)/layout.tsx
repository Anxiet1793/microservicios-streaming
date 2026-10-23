import { Brand } from "../../components/ui";
import s from "../../features/auth/auth.module.css";
import { currentUser, sessionId } from "../../lib/server/session";
import { redirect } from "next/navigation";
export default async function Layout({ children }: { children: React.ReactNode }) {
  let authenticated = false;
  if (await sessionId()) {
    try {
      await currentUser();
      authenticated = true;
    } catch {
      /* Login remains available for an expired or uncertain session. */
    }
  }
  if (authenticated) redirect("/home");
  return (
    <div className={s.layout}>
      <aside className={s.visual}>
        <Brand />
        <div>
          <span className="eyebrow">DESCUBRE. GUARDA. CONTINÚA.</span>
          <h2>
            Hay historias
            <br />
            que merecen
            <br />
            <em>un lugar.</em>
          </h2>
          <p>Una sala para descubrir nuevos mundos. Y volver a los que dejaste a medias.</p>
        </div>
        <small>TU PRÓXIMA HISTORIA EMPIEZA AQUÍ</small>
      </aside>
      <main className={s.formArea}>
        <div className={s.form}>{children}</div>
      </main>
    </div>
  );
}
