import { viewer } from "../../../../lib/server/guard";
import { title } from "../../../../lib/server/catalog";
import { Player } from "../../../../features/playback/Player";
import { Message } from "../../../../components/ui";
export default async function Page({
  params,
}: {
  params: Promise<{ tituloId: string }>;
}) {
  await viewer();
  const data = await title((await params).tituloId);
  if (data.typeId === 2 || !data.playbackReference)
    return (
      <main className="page">
        <Message title="Este título todavía no tiene un video disponible.">
          Puedes guardar su ficha en Mi Lista y volver después.
        </Message>
      </main>
    );
  return <Player tituloId={data.tituloId} title={data.ficha.title} />;
}
