import { viewer } from "../../../lib/server/guard";
import { Library } from "../../../features/library/Library";
export const metadata = { title: "Tus gustos" };
export default async function Page() {
  const user = await viewer();
  return (
    <>
      <span className="eyebrow">TU COLECCIÓN PERSONAL</span>
      <h1>Tus gustos</h1>
      <p className="muted">
        Tus señales quedan guardadas. Las recomendaciones personalizadas llegarán en una próxima
        etapa.
      </p>
      <Library kind="preferences" userId={user.userId} />
    </>
  );
}
