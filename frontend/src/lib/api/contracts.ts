import type { components as Catalog } from "../../types/generated/catalog";
import type { components as Users } from "../../types/generated/users";
import type { components as Playback } from "../../types/generated/playback";
export type CatalogTitleDto = Catalog["schemas"]["CatalogTitle"];
export type CatalogListItemDto = Catalog["schemas"]["CatalogListItem"];
export type UserDto = Users["schemas"]["User"];
export type PlaybackSessionDto = Playback["schemas"]["Session"];
export type PlaybackUrlDto = Playback["schemas"]["PlaybackUrl"];
