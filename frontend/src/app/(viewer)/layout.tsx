import { viewer } from "../../lib/server/guard";
import { Shell } from "../../components/Shell";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Shell user={await viewer()}>{children}</Shell>;
}
