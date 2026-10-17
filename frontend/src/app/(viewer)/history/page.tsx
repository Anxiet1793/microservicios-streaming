import { viewer } from "../../../lib/server/guard";
import { Library } from "../../../features/library/Library";
export const metadata = { title: "Historial" };
export default async function Page() {
  const user = await viewer();
  return (
    <>
      <span className="eyebrow">TU COLECCIÓN PERSONAL</span>
      <h1>Historial</h1>
      <Library kind="history" userId={user.userId} />
    </>
  );
}
