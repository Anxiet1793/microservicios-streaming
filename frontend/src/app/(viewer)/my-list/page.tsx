import { viewer } from "../../../lib/server/guard";
import { Library } from "../../../features/library/Library";
export const metadata = { title: "Mi Lista" };
export default async function Page() {
  const user = await viewer();
  return (
    <>
      <span className="eyebrow">TU COLECCIÓN PERSONAL</span>
      <h1>Mi Lista</h1>
      <Library kind="watchlist" userId={user.userId} />
    </>
  );
}
