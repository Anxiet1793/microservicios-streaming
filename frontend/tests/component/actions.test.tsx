import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersonalActions } from "../../src/features/library/PersonalActions";
import { api } from "../../src/lib/api/client";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <PersonalActions userId="usr_test" tituloId="ttl_test" />
    </QueryClientProvider>,
  );
}
describe("personal state under failure", () => {
  it("distinguishes a wrong current password from an expired session", async () => {
    const expired = vi.fn();
    window.addEventListener("nevaro:expired", expired);
    try {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          Response.json({ error: { code: "INVALID_CREDENTIALS" } }, { status: 401 }),
        )
        .mockResolvedValueOnce(Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 }));
      await expect(api("me/change-password", "POST", {})).rejects.toMatchObject({
        code: "INVALID_CREDENTIALS",
      });
      expect(expired).not.toHaveBeenCalled();
      await expect(api("me")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(expired).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener("nevaro:expired", expired);
    }
  });
  it("rolls back an optimistic watchlist toggle after a rejected write", async () => {
    let rejectWrite: () => void = () => {};
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      if (init?.method === "POST")
        return new Promise<Response>((resolve) => {
          rejectWrite = () =>
            resolve(Response.json({ error: { code: "SERVICE_UNAVAILABLE" } }, { status: 503 }));
        });
      return Response.json({
        watchlist: { known: true, item: null },
        preference: { known: true, item: null },
      });
    });
    mount();
    const add = await screen.findByRole("button", {
      name: "+ Mi Lista",
    });
    await waitFor(() => expect(add.hasAttribute("disabled")).toBe(false));
    fireEvent.click(add);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "En Mi Lista" }).getAttribute("aria-pressed")).toBe(
        "true",
      ),
    );
    rejectWrite();
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "+ Mi Lista" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });
  it("keeps an incomplete paginated state unknown rather than enabling neutral actions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        watchlist: { known: false, item: null },
        preference: { known: false, item: null },
      }),
    );
    mount();
    const add = await screen.findByRole("button", {
      name: "+ Mi Lista",
    });
    expect(add.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Me gusta" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/Tu colección es muy extensa/)).toBeTruthy();
  });
});
