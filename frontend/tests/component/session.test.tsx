import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Shell } from "../../src/components/Shell";
import { Profile } from "../../src/features/profile/Profile";
import { mount, deferred } from "../support/render";
import type { User } from "../../src/lib/models";
const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/profile", useRouter: () => navigation }));
const user: User = {
  userId: "usr_test",
  email: "qa@example.test",
  role: "USER",
  status: "ACTIVE",
  profile: { displayName: "QA", avatarUrl: null, preferredLanguage: "es" },
};
beforeEach(() => {
  navigation.replace.mockClear();
  navigation.refresh.mockClear();
});
it.each([true, false])("logout clears private cached data, revoked=%s", async (revoked) => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ revoked }));
  const { client } = mount(<Shell user={user}>Contenido privado</Shell>);
  client.setQueryData(["private"], "private data");
  fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
  await waitFor(() =>
    expect(navigation.replace).toHaveBeenCalledWith(revoked ? "/login" : "/login?logout=local"),
  );
  expect(client.getQueryData(["private"])).toBeUndefined();
});
it("failed logout retains session, reports failure and enables retry", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
  mount(
    <Shell user={user} admin>
      Panel
    </Shell>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cerrar tu sesión");
  expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeEnabled();
  expect(navigation.replace).not.toHaveBeenCalled();
});
it.each(["USER", "ADMIN"] as const)(
  "profile presents administration only to %s when appropriate",
  (role) => {
    mount(<Profile user={{ ...user, role }} />);
    expect(screen.queryByRole("link", { name: "Administrar contenido" }) !== null).toBe(
      role === "ADMIN",
    );
  },
);
it("profile patches editable fields, exposes loading and reports success", async () => {
  const pending = deferred<Response>(),
    fetch = vi.spyOn(globalThis, "fetch").mockReturnValue(pending.promise);
  mount(<Profile user={user} />);
  fireEvent.change(screen.getByLabelText("Nombre visible"), { target: { value: "Otro nombre" } });
  fireEvent.change(screen.getByLabelText("Imagen de perfil (URL opcional)"), {
    target: { value: "https://example.test/avatar.png" },
  });
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "en" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar perfil" }));
  expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
  pending.resolve(Response.json({}));
  expect(await screen.findByRole("status")).toHaveTextContent("Tu perfil está actualizado");
  expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({
    displayName: "Otro nombre",
    avatarUrl: "https://example.test/avatar.png",
    preferredLanguage: "en",
  });
});
it("password change clears cache and returns to login only after confirmation", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
  const { client, container } = mount(<Profile user={user} />);
  client.setQueryData(["private"], "secret");
  fireEvent.change(screen.getByLabelText("Contraseña actual"), {
    target: { value: "oldPassword123!" },
  });
  fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
    target: { value: "newPassword123!" },
  });
  fireEvent.submit(container.querySelectorAll("form")[1]!);
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/login"));
  expect(client.getQueryData(["private"])).toBeUndefined();
});
