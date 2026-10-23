import { viewer } from "../../../../../lib/server/guard";
import { title } from "../../../../../lib/server/catalog";
import { Editor } from "../../../../../features/admin/Editor";
export default async function Page({ params }: { params: Promise<{ tituloId: string }> }) {
  const user = await viewer();
  if (user.role !== "ADMIN") return null;
  return <Editor title={await title((await params).tituloId, true)} />;
}
