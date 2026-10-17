export interface User {
  userId: string;
  email: string;
  role: "USER" | "ADMIN";
  status: string;
  profile: {
    displayName: string;
    avatarUrl: string | null;
    preferredLanguage: string;
  };
}
export interface Title {
  tituloId: string;
  typeId: 1 | 2;
  publicationStatusId: number;
  ficha: {
    title: string;
    synopsis?: string;
    releaseYear: number;
    durationMinutes?: number;
    genres: number[];
    genresName?: string[];
    languages?: number[];
    languagesName?: string[];
    posterUrl?: string;
    backdropUrl?: string;
    director?: string;
    cast?: string[];
    ageRatingName?: string;
    originalTitle?: string;
    ageRatingId?: number;
  };
  playbackReference?: { assetId: string } | null;
}
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Page<T> {
  data: T[];
  pagination: Pagination;
}
export interface Reference {
  tituloId: string;
  addedAt?: string;
  lastPlayedAt?: string;
  completed?: boolean;
  value?: "LIKE" | "DISLIKE";
  progress?: Progress;
  title?: Title | null;
  resolution?: "resolved" | "unavailable" | "failed";
}
export interface Progress {
  positionSeconds: number;
  durationSeconds: number;
  percentage: number;
}
export interface Playback {
  session: {
    sessionId: string;
    tituloId: string;
    status: string;
    progress: Progress;
  };
  playback?: { url: string; expiresIn: number };
}
export const genres = [
  "Ciencia ficción",
  "Drama",
  "Comedia",
  "Acción",
  "Aventura",
  "Suspenso",
  "Terror",
  "Romance",
  "Animación",
  "Documental",
  "Fantasía",
  "Misterio",
  "Familiar",
  "Historia",
  "Música",
];
export const languages = [
  "Español",
  "Inglés",
  "Portugués",
  "Francés",
  "Alemán",
  "Italiano",
  "Japonés",
  "Coreano",
  "Chino",
  "Quechua",
];
export function time(value: number) {
  const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function safeReturn(value: string | null) {
  return value &&
    /^\/(home|explore|search|title|watch|my-list|history|continue-watching|profile|preferences|admin)(\/|\?|$)/.test(
      value,
    ) &&
    !value.includes("\\")
    ? value
    : "/home";
}
