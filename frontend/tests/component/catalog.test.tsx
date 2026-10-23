import { expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Card, Section, Grid } from "../../src/components/ui";
import { Hero } from "../../src/features/catalog/Hero";
import { Explore } from "../../src/features/catalog/Explore";
import { SearchField } from "../../src/features/catalog/SearchField";
import { Library } from "../../src/features/library/Library";
import { mount } from "../support/render";
import type { Title } from "../../src/lib/models";
const mocks = vi.hoisted(() => ({ catalog: vi.fn(), replace: vi.fn() }));
vi.mock("../../src/lib/server/catalog", () => ({ catalog: mocks.catalog }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams("genre=10&page=4"),
}));
const title: Title = {
  tituloId: "ttl_test",
  typeId: 1,
  publicationStatusId: 2,
  ficha: {
    title: "Viaje de prueba",
    synopsis: "Una historia reproducible.",
    releaseYear: 2026,
    durationMinutes: 2,
    genres: [10],
  },
  playbackReference: { assetId: "ast_test" },
};
it("MediaCard uses catalog IDs, metadata and an image fallback on load failure", () => {
  const { container } = render(
    <Card
      title={{ ...title, ficha: { ...title.ficha, posterUrl: "https://example.test/poster.jpg" } }}
    />,
  );
  expect(screen.getByRole("heading", { name: title.ficha.title })).toBeVisible();
  expect(screen.getByRole("link")).toHaveAttribute("href", "/title/ttl_test");
  fireEvent.error(container.querySelector("img")!);
  expect(screen.getByText("NÉVARO / ARCHIVO")).toBeVisible();
});
it("MediaRow/Section renders its cards and collection link", () => {
  render(
    <Section title="Documentales" href="/explore?genre=10">
      <Grid titles={[title]} />
    </Section>,
  );
  expect(screen.getByRole("heading", { name: "Documentales" })).toBeVisible();
  expect(screen.getByRole("link", { name: /Ver todo/ })).toHaveAttribute(
    "href",
    "/explore?genre=10",
  );
  expect(screen.getAllByRole("article")).toHaveLength(1);
});
it("detail offers playback only for a published movie with an asset", () => {
  const { rerender } = render(<Hero title={title} detail />);
  expect(screen.getByRole("link", { name: /Reproducir/ })).toHaveAttribute(
    "href",
    "/watch/ttl_test",
  );
  expect(screen.getByText(title.ficha.synopsis!)).toBeVisible();
  rerender(<Hero title={{ ...title, typeId: 2, playbackReference: null }} detail />);
  expect(screen.queryByRole("link", { name: /Reproducir/ })).toBeNull();
  expect(screen.getByText(/Episodios todavía/)).toBeVisible();
});
it("debounces search, preserves filters, resets pagination and cancels on unmount", async () => {
  vi.useFakeTimers();
  mocks.replace.mockClear();
  const { unmount } = render(
    <label>
      Buscar
      <SearchField value="" base="/search" />
    </label>,
  );
  fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: " viaje " } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(299);
  });
  expect(mocks.replace).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(mocks.replace).toHaveBeenCalledWith("/search?genre=10&q=viaje", { scroll: false });
  fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "otro" } });
  unmount();
  await vi.advanceTimersByTimeAsync(300);
  expect(mocks.replace).toHaveBeenCalledOnce();
});
it("renders search/filter values, preserves them in pagination and shows empty results", async () => {
  mocks.catalog.mockResolvedValue({
    data: [],
    pagination: { total: 0, page: 2, limit: 20, totalPages: 3 },
  });
  render(
    await Explore({
      query: { q: "vacío", genre: "10", year: "2026", page: "2", type: "1" },
      search: true,
    }),
  );
  expect(
    screen.getByRole("heading", { name: "No encontramos títulos con esos filtros." }),
  ).toBeVisible();
  expect(screen.getByLabelText("Género")).toHaveValue("10");
  expect(screen.getByLabelText("Año")).toHaveValue(2026);
  const url = new URL(
    screen.getByRole("link", { name: "Siguiente" }).getAttribute("href")!,
    "http://test",
  );
  expect(url.searchParams.get("q")).toBe("vacío");
  expect(url.searchParams.get("genre")).toBe("10");
  expect(url.searchParams.get("page")).toBe("3");
});
it("Continue Watching exposes a percentage and resumes the same title", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      data: [
        {
          tituloId: title.tituloId,
          title,
          progress: { positionSeconds: 30, durationSeconds: 120, percentage: 25 },
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }),
  );
  mount(<Library kind="continue-watching" userId="usr_test" />);
  const progress = await screen.findByRole("progressbar", {
    name: `Progreso de ${title.ficha.title}`,
  });
  expect(progress).toHaveAttribute("value", "25");
  expect(progress).toHaveAttribute("max", "100");
  expect(screen.getByRole("link", { name: "Continuar desde 0:30" })).toHaveAttribute(
    "href",
    "/watch/ttl_test",
  );
});
it.each(["watchlist", "continue-watching", "preferences", "history"])(
  "%s shows a controlled error and retries",
  async (kind) => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({ error: { code: "SERVICE_UNAVAILABLE" } }, { status: 503 }),
      )
      .mockResolvedValue(Response.json({ data: [], pagination: { page: 1, totalPages: 0 } }));
    mount(<Library kind={kind} userId="usr_test" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Tu información sigue guardada");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByRole("heading");
    expect(fetch).toHaveBeenCalledTimes(2);
  },
);
