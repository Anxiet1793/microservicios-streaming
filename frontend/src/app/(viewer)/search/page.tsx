import { Explore } from "../../../features/catalog/Explore";
export const metadata = { title: "Buscar" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <Explore query={await searchParams} search />;
}
