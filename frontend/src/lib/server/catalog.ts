import "server-only";
import { ServiceError, upstream } from "./http";
import type { Title, Page, Reference } from "../models";
import type { CatalogTitleDto } from "../api/contracts";
export async function catalog(
  query: URLSearchParams,
  admin = false,
): Promise<Page<Title>> {
  const allowed = new URLSearchParams();
  for (const key of [
    "page",
    "limit",
    "type",
    "genre",
    "year",
    "q",
    ...(admin ? ["status"] : []),
  ]) {
    const value = query.get(key);
    if (value) allowed.set(key, value);
  }
  if (!admin) allowed.set("status", "2");
  return (await upstream("CATALOG", `/api/v1/catalog?${allowed}`)).json();
}
export async function title(id: string, admin = false): Promise<Title> {
  const data: CatalogTitleDto = await (
    await upstream("CATALOG", `/api/v1/catalog/${encodeURIComponent(id)}`)
  ).json();
  if (!admin && data.publicationStatusId !== 2)
    throw new ServiceError(404, "TITLE_NOT_FOUND");
  return {
    ...data,
    playbackReference: data.playbackReference
      ? { assetId: data.playbackReference.assetId }
      : null,
  };
}
export async function compose(items: Reference[]) {
  const result: Reference[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, items.length) }, async () => {
      while (next < items.length) {
        const i = next++,
          item = items[i]!;
        try {
          result[i] = {
            ...item,
            title: await title(item.tituloId),
            resolution: "resolved",
          };
        } catch (error) {
          result[i] = {
            ...item,
            title: null,
            resolution:
              error instanceof ServiceError && error.status === 404
                ? "unavailable"
                : "failed",
          };
        }
      }
    }),
  );
  return result;
}
