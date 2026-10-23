import { beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthForm } from "../../src/features/auth/AuthForm";
import { deferred } from "../support/render";
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  params: new URLSearchParams(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  useSearchParams: () => navigation.params,
}));
beforeEach(() => {
  navigation.replace.mockClear();
  navigation.refresh.mockClear();
  navigation.params = new URLSearchParams();
});
function fill() {
  fireEvent.change(screen.getByRole("textbox", { name: /^Correo electrónico/ }), {
    target: { value: "qa@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña", { exact: true }), {
    target: { value: "Academic-Test-123!" },
  });
}
it("LoginForm submits once, shows loading and returns to a safe destination", async () => {
  navigation.params.set("next", "/my-list");
  const response = deferred<Response>();
  const fetch = vi.spyOn(globalThis, "fetch").mockReturnValue(response.promise);
  render(<AuthForm />);
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  const loading = await screen.findByRole("button", { name: "Un momento…" });
  expect(loading).toBeDisabled();
  expect(loading).toHaveAttribute("aria-busy", "true");
  fireEvent.click(loading);
  expect(fetch).toHaveBeenCalledOnce();
  await act(async () => response.resolve(Response.json({ user: {} })));
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/my-list"));
  expect(navigation.refresh).toHaveBeenCalledOnce();
});
it("RegisterForm creates an account and never redirects before login", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json({ user: {} }, { status: 201 }));
  render(<AuthForm register />);
  fill();
  fireEvent.change(screen.getByLabelText("Nombre visible"), { target: { value: "QA académico" } });
  fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
  expect(await screen.findByRole("heading", { name: "Tu cuenta está lista." })).toBeVisible();
  expect(fetch.mock.calls[0]?.[0]).toBe("/api/bff/auth/register");
  expect(navigation.replace).not.toHaveBeenCalled();
});
it("validates registration and email before calling the API", async () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  const { container } = render(<AuthForm register />);
  fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "invalid" } });
  fireEvent.submit(container.querySelector("form")!);
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: /^Correo electrónico/ })).toHaveAttribute(
      "aria-invalid",
      "true",
    ),
  );
  expect(fetch).not.toHaveBeenCalled();
  fill();
  fireEvent.submit(container.querySelector("form")!);
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
});
it("shows generic authentication errors and allows another attempt", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ error: { code: "INVALID_CREDENTIALS" } }, { status: 401 }),
  );
  render(<AuthForm />);
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/correo|contraseña/i);
  expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  expect(navigation.replace).not.toHaveBeenCalled();
});
it("honors Retry-After instead of silently retrying credentials", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json(
      { error: { code: "RATE_LIMIT_EXCEEDED" } },
      { status: 429, headers: { "Retry-After": "2" } },
    ),
  );
  render(<AuthForm />);
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByRole("button", { name: "Espera 2 s" })).toBeDisabled();
});
it("does not dispatch a session-expiry event for a rejected login", async () => {
  const expired = vi.fn();
  window.addEventListener("nevaro:expired", expired);
  try {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 }),
    );
    render(<AuthForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByRole("alert");
    expect(expired).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener("nevaro:expired", expired);
  }
});
