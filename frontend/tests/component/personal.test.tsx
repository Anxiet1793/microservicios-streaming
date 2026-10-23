import { expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { PersonalActions } from "../../src/features/library/PersonalActions";
import { mount, deferred } from "../support/render";
function setup(item: unknown = null, preference: { value: "LIKE" | "DISLIKE" } | null = null) {
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) =>
    init?.method === "GET"
      ? Response.json({
          watchlist: { known: true, item },
          preference: { known: true, item: preference },
        })
      : new Response(null, { status: 204 }),
  );
  mount(<PersonalActions userId="usr_test" tituloId="ttl_test" />);
  return fetch;
}
it("adds and removes a watchlist reference using optimistic state", async () => {
  const fetch = setup();
  const pending = deferred<Response>();
  const add = await screen.findByRole("button", { name: "+ Mi Lista" });
  await waitFor(() => expect(add).toBeEnabled());
  fetch.mockReturnValueOnce(pending.promise);
  fireEvent.click(add);
  expect(await screen.findByRole("button", { name: "En Mi Lista" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: "En Mi Lista" })).toBeDisabled();
  await act(async () => pending.resolve(new Response(null, { status: 204 })));
  await waitFor(() => expect(screen.getByRole("button", { name: "En Mi Lista" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "En Mi Lista" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "+ Mi Lista" })).toBeEnabled());
  expect(fetch.mock.calls.map(([, init]) => init?.method)).toEqual(["GET", "POST", "DELETE"]);
});
it("restores an existing item when optimistic removal fails", async () => {
  const fetch = setup({ tituloId: "ttl_test" });
  const remove = await screen.findByRole("button", { name: "En Mi Lista" });
  await waitFor(() => expect(remove).toBeEnabled());
  fetch.mockResolvedValueOnce(
    Response.json({ error: { code: "SERVICE_UNAVAILABLE" } }, { status: 503 }),
  );
  fireEvent.click(remove);
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "En Mi Lista" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
it.each(["LIKE", "DISLIKE"] as const)(
  "sets %s and removes it when pressed again",
  async (value) => {
    const fetch = setup(),
      label = value === "LIKE" ? "Me gusta" : "No me gusta";
    const button = screen.getByRole("button", { name: label });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true"));
    await waitFor(() => expect(button).toBeEnabled());
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({ value }),
    });
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "false"));
    await waitFor(() => expect(button).toBeEnabled());
    expect(fetch.mock.calls[2]?.[1]?.method).toBe("DELETE");
  },
);
it("changes LIKE to DISLIKE without deleting first and rolls back a failed change", async () => {
  const fetch = setup(null, { value: "LIKE" });
  const dislike = screen.getByRole("button", { name: "No me gusta" });
  await waitFor(() => expect(dislike).toBeEnabled());
  fetch.mockResolvedValueOnce(
    Response.json({ error: { code: "SERVICE_UNAVAILABLE" } }, { status: 503 }),
  );
  fireEvent.click(dislike);
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "Me gusta" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(dislike);
  await waitFor(() => expect(dislike).toHaveAttribute("aria-pressed", "true"));
  expect(screen.getByRole("button", { name: "Me gusta" })).toHaveAttribute("aria-pressed", "false");
  expect(fetch.mock.calls.slice(1).every(([, init]) => init?.method === "PUT")).toBe(true);
});
