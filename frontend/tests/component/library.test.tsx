import { afterEach, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Library } from "../../src/features/library/Library";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("loads the full page after visiting a four-item Home preview", async () => {
  const items = Array.from({ length: 6 }, (_, i) => ({
    tituloId: `ttl_${i}`,
    title: {
      tituloId: `ttl_${i}`,
      typeId: 1,
      publicationStatusId: 2,
      ficha: { title: `Historia ${i + 1}`, releaseYear: 2026, genres: [10] },
    },
  }));
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    const limit =
      new URL(String(url), "http://localhost").searchParams.get("limit") === "4"
        ? 4
        : 20;
    return Response.json({
      data: items.slice(0, limit),
      pagination: {
        page: 1,
        limit,
        total: 6,
        totalPages: Math.ceil(6 / limit),
      },
    });
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60000 } },
  });
  const view = (compact: boolean) => (
    <QueryClientProvider client={client}>
      <Library kind="watchlist" userId="usr_example" compact={compact} />
    </QueryClientProvider>
  );
  const rendered = render(view(true));
  await screen.findByRole("heading", { name: "Historia 4", exact: true });
  expect(
    screen.queryByRole("heading", { name: "Historia 6", exact: true }),
  ).toBeNull();
  rendered.rerender(view(false));
  expect(
    await screen.findByRole("heading", { name: "Historia 6", exact: true }),
  ).toBeTruthy();
});
