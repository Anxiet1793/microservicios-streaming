import { viewer } from "../../../lib/server/guard";
import { Library } from "../../../features/library/Library";
export const metadata = { title: "Continuar viendo" };
export default async function Page() {
  const user = await viewer();
  return (
    <>
      <span className="eyebrow">TU COLECCIÓN PERSONAL</span>
      <h1>Continuar viendo</h1>
      <Library kind="continue-watching" userId={user.userId} />
    </>
  );
}
