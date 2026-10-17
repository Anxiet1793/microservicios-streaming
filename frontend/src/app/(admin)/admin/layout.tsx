import { viewer } from "../../../lib/server/guard";
import { Shell } from "../../../components/Shell";
import { Message } from "../../../components/ui";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await viewer();
  if (user.role !== "ADMIN")
    return (
      <Shell user={user}>
        <Message title="Tu cuenta no tiene acceso a esta sección.">
          Vuelve a tus historias para continuar.
        </Message>
      </Shell>
    );
  return (
    <Shell user={user} admin>
      {children}
    </Shell>
  );
}
