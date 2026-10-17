import { viewer } from "../../../lib/server/guard";
import { Profile } from "../../../features/profile/Profile";
export const metadata = { title: "Perfil" };
export default async function Page() {
  return <Profile user={await viewer()} />;
}
