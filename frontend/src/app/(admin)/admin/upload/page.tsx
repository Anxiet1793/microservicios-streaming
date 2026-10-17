import { viewer } from "../../../../lib/server/guard";
import { Upload } from "../../../../features/admin/Upload";
export const metadata = { title: "Subir video" };
export default async function Page() {
  const user = await viewer();
  return user.role === "ADMIN" ? <Upload userId={user.userId} /> : null;
}
