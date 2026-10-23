import { test, expect } from "@playwright/test";
import type { Page, BrowserContext } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const fixture = JSON.parse(await readFile(process.env.E2E_FIXTURE!, "utf8")) as {
  project: string;
  compose: string;
  origin: string;
  clip: string;
  tituloId: string;
  title: string;
  seriesId: string;
  password: string;
  privateKey: string;
};
if (
  !/^nevaro-e2e-[a-f0-9]{10}$/.test(fixture.project) ||
  fixture.origin !== process.env.E2E_BASE_URL
)
  throw new Error("Only a runner-owned test stack is allowed");
const exec = promisify(execFile),
  headers = { "X-Nevaro-Request": "1" };
const dc = async (...args: string[]) =>
  (
    await exec("docker", ["compose", "-p", fixture.project, "-f", fixture.compose, ...args], {
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    })
  ).stdout.trim();
async function login(page: Page, email = "demo@streaming.local", password = fixture.password) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}
async function account(context: BrowserContext) {
  const email = `qa-${randomBytes(8).toString("hex")}@example.test`;
  expect(
    (
      await context.request.post("/api/bff/auth/register", {
        headers,
        data: { email, password: fixture.password, displayName: "Espectador QA" },
      })
    ).status(),
  ).toBe(201);
  return email;
}
async function prepare(page: Page) {
  await page.getByRole("button", { name: "Preparar reproducción", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reproducir", exact: true })).toBeVisible();
}
async function healthy(service: string) {
  await expect
    .poll(
      async () => {
        const container = await dc("ps", "-q", service);
        return (
          await exec("docker", ["inspect", "--format", "{{.State.Health.Status}}", container], {
            windowsHide: true,
          })
        ).stdout.trim();
      },
      { timeout: 60000 },
    )
    .toBe("healthy");
}
async function session(context: BrowserContext, action: "expire" | "delete") {
  const id = (await context.cookies()).find((cookie) => cookie.name === "nevaro_session")?.value;
  expect(id).toBeTruthy();
  const code = await readFile("scripts/prepare-test-session.mjs", "utf8");
  await new Promise<void>((done, reject) => {
    const child = execFile(
      "docker",
      [
        "compose",
        "-p",
        fixture.project,
        "-f",
        fixture.compose,
        "exec",
        "-T",
        "frontend",
        "node",
        "--input-type=module",
        "-e",
        code,
      ],
      { windowsHide: true },
      (error) => (error ? reject(new Error("Could not prepare owned test session")) : done()),
    );
    child.stdin!.end(JSON.stringify({ id, action, privateKey: fixture.privateKey }));
  });
}

test("E2E-01 Register → Login → Home; authentication stays server-side", async ({
  page,
  context,
}) => {
  const email = `registration-${randomBytes(8).toString("hex")}@example.test`;
  await page.goto("/register");
  await page.getByLabel("Nombre visible").fill("Espectador de auditoría");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tu cuenta está lista." })).toBeVisible();
  await page.getByRole("link", { name: "Iniciar sesión", exact: true }).click();
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText("Qué bueno verte, Espectador de auditoría.")).toBeVisible();
  const cookies = await context.cookies();
  expect(cookies.find((cookie) => cookie.name === "nevaro_session")).toMatchObject({
    httpOnly: true,
    sameSite: "Strict",
  });
  expect(cookies.some((cookie) => cookie.name === "users_refresh")).toBe(false);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test("E2E-02 Login → filtered catalog → detail → watchlist → My List → remove", async ({
  page,
  context,
}) => {
  await login(page, await account(context));
  await page.goto("/explore?genre=10&year=2026&type=1");
  await expect(page.getByRole("heading", { name: fixture.title, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NÉVARO QA · Serie", exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("heading", { name: fixture.title, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/title/${fixture.tituloId}$`));
  await page.getByRole("button", { name: "+ Mi Lista", exact: true }).click();
  await expect(page.getByRole("button", { name: "En Mi Lista", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.goto("/my-list");
  await expect(page.getByRole("heading", { name: fixture.title, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Quitar de Mi Lista", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Guarda algo para después." })).toBeVisible();
  await page.goto("/search?q=zzsincoincidencias987654321");
  await expect(
    page.getByRole("heading", { name: "No encontramos títulos con esos filtros." }),
  ).toBeVisible();
});

test("E2E-03 LIKE → DISLIKE persists after navigation", async ({ page, context }) => {
  await login(page, await account(context));
  await page.goto(`/title/${fixture.tituloId}`);
  await page.getByRole("button", { name: "Me gusta", exact: true }).click();
  await expect(page.getByRole("button", { name: "Me gusta", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "No me gusta", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "No me gusta", exact: true }).click();
  await expect(page.getByRole("button", { name: "No me gusta", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Me gusta", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.goto("/preferences");
  await expect(page.getByText("No me gusta", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("No me gusta", { exact: true })).toBeVisible();
});

test("E2E-04 real HTML5 MP4 → seek → pause → home → resume near saved position → complete", async ({
  page,
  context,
}) => {
  await login(page, await account(context));
  await page.goto(`/title/${fixture.tituloId}`);
  await page.getByRole("link", { name: "Reproducir", exact: true }).click();
  await prepare(page);
  await page.getByRole("button", { name: "Reproducir", exact: true }).click();
  await expect
    .poll(() => page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0);
  const progress = page.waitForResponse(
    (r) => r.url().includes("/progress") && r.request().method() === "PATCH",
  );
  await page.locator("video").evaluate((v: HTMLVideoElement) => {
    v.currentTime = 4;
  });
  expect((await progress).status()).toBe(200);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Pausa y avance guardados");
  const saved = await page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime);
  await page.getByRole("button", { name: "Volver a la ficha" }).click();
  await page.goto("/home");
  await expect(page.getByRole("link", { name: /Continuar desde 0:0/ })).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: `Progreso de ${fixture.title}` }),
  ).toHaveAttribute("value", /[1-9]/);
  await page.getByRole("link", { name: /Continuar desde/ }).click();
  await prepare(page);
  const resumed = await page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime);
  expect(Math.abs(resumed - saved)).toBeLessThan(2);
  expect(resumed).toBeGreaterThanOrEqual(3);
  await page.getByRole("button", { name: "Reproducir", exact: true }).click();
  await page.locator("video").evaluate((v: HTMLVideoElement) => {
    v.currentTime = v.duration - 0.2;
  });
  await expect(page.getByRole("heading", { name: "Hasta la próxima historia." })).toBeVisible();
  await page.goto("/history");
  await expect(page.getByText(/Completado/)).toBeVisible();
});

test("E2E-05 ADMIN uploads a small MP4, verifies asset, publishes and edits a title", async ({
  page,
  context,
}) => {
  await login(page, "admin@streaming.local");
  await page.goto("/admin/upload");
  await page.getByLabel("Archivo de video").setInputFiles(fixture.clip);
  const uploaded = page.waitForResponse(
    (r) => r.url().endsWith("/admin/assets") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Subir video", exact: true }).click();
  const response = await uploaded;
  expect(response.status()).toBe(201);
  const { asset } = await response.json();
  expect(asset.durationSeconds).toBeGreaterThan(10);
  expect(asset.sizeBytes).toBeLessThan(1048576);
  expect((await context.request.get(`/api/bff/admin/assets/${asset.assetId}`)).status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Completa la ficha" })).toBeVisible();
  await page.getByLabel("Título", { exact: true }).fill("NÉVARO QA · Publicación");
  await page
    .getByLabel("Sinopsis", { exact: true })
    .fill("Contenido sintético propio para verificar la publicación real.");
  await page.getByRole("button", { name: "Crear ficha", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lista para publicar." })).toBeVisible();
  await page.getByRole("button", { name: "Publicar título", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tu historia ya está en NÉVARO." })).toBeVisible();
  await page.getByRole("link", { name: "Ver la ficha", exact: true }).click();
  await expect(page).toHaveURL(/\/title\/ttl_[a-f0-9-]+$/);
  const id = page.url().split("/").at(-1)!;
  await page.goto(`/admin/content/${id}`);
  await expect(page.getByRole("heading", { name: "Editar ficha", exact: true })).toBeVisible();
  await page.getByLabel("Título", { exact: true }).fill("NÉVARO QA · Publicación editada");
  await page.getByRole("button", { name: "Guardar ficha", exact: true }).click();
  await expect(page.getByText("Ficha actualizada.")).toBeVisible();
  await page.goto(`/title/${id}`);
  await expect(
    page.getByRole("heading", { name: "NÉVARO QA · Publicación editada", exact: true }),
  ).toBeVisible();
});

test("E2E-06 expired signed JWT → concurrent refresh rotates exactly once → navigation continues", async ({
  page,
  context,
}) => {
  await login(page);
  const users = await dc("ps", "-q", "users");
  const count = async () => {
    const { stdout, stderr } = await exec("docker", ["logs", users], {
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    });
    return (stdout + stderr)
      .split("\n")
      .filter((line) => line.includes('"endpoint":"/api/v1/auth/refresh"')).length;
  };
  const before = await count();
  await session(context, "expire");
  const responses = await Promise.all([
    context.request.get("/api/bff/me"),
    context.request.get("/api/bff/library/watchlist"),
    context.request.get("/api/bff/library/history"),
  ]);
  for (const response of responses) expect(response.status()).toBe(200);
  expect((await count()) - before).toBe(1);
  await page.goto("/explore");
  await expect(page.getByRole("heading", { name: "Un mundo por descubrir." })).toBeVisible();
  const me = await context.request.get("/api/bff/me");
  expect(await me.text()).not.toMatch(/accessToken|refreshToken/);
});

test("E2E-07 Catalog unavailable shows a controlled error and recovers", async ({ page }) => {
  await login(page);
  try {
    await dc("stop", "catalog");
    await page.goto("/home");
    await expect(
      page.getByRole("heading", { name: "No pudimos cargar el catálogo." }),
    ).toBeVisible();
    await page.goto("/explore");
    await expect(
      page.getByRole("heading", { name: "No pudimos cargar esta parte." }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Reintentar", exact: true })).toBeVisible();
  } finally {
    await dc("start", "catalog");
    await healthy("catalog");
  }
  await page.goto("/home");
  await expect(page.getByText(/Qué bueno verte/)).toBeVisible();
});

test("E2E-08 Playback unavailable preserves the application and permits recovery", async ({
  page,
  context,
}) => {
  await login(page, await account(context));
  await page.goto(`/watch/${fixture.tituloId}`);
  try {
    await dc("stop", "playback");
    await page.getByRole("button", { name: "Preparar reproducción", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir un nuevo reproductor" })).toBeEnabled();
  } finally {
    await dc("start", "playback");
    await healthy("playback");
  }
  await page.getByRole("button", { name: "Abrir un nuevo reproductor" }).click();
  await expect(page.getByRole("button", { name: "Reproducir", exact: true })).toBeVisible();
});

test("USER is denied administration and cross-site writes; expired session returns to login", async ({
  page,
  context,
}) => {
  await login(page, await account(context));
  await page.goto("/admin/upload");
  await expect(
    page.getByRole("heading", { name: "Tu cuenta no tiene acceso a esta sección." }),
  ).toBeVisible();
  expect(
    (await context.request.post("/api/bff/admin/catalog", { headers, data: {} })).status(),
  ).toBe(403);
  expect(
    (
      await context.request.post("/api/bff/auth/logout", {
        headers: { ...headers, Origin: "https://other.example" },
      })
    ).status(),
  ).toBe(403);
  await page.goto(`/title/${fixture.tituloId}`);
  await expect(page.getByRole("button", { name: "Me gusta", exact: true })).toBeEnabled();
  await session(context, "delete");
  await page.getByRole("button", { name: "Me gusta", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("automatic signed media URL renewal preserves paused position", async ({ page, context }) => {
  await page.clock.install();
  await login(page, await account(context));
  await page.goto(`/watch/${fixture.tituloId}`);
  await prepare(page);
  const at = await page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime);
  const renewed = page.waitForResponse(
    (r) => r.url().includes("/refresh-url") && r.request().method() === "POST",
  );
  await page.clock.fastForward(841000);
  expect((await renewed).status()).toBe(200);
  await expect
    .poll(() => page.locator("video").evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(1);
  expect(await page.locator("video").evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  expect(
    Math.abs((await page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime)) - at),
  ).toBeLessThan(1);
});

test("profile, password revocation, account isolation and responsive layout", async ({
  page,
  context,
}) => {
  const email = await account(context);
  await login(page, email);
  await page.goto("/profile");
  await page.getByLabel("Nombre visible", { exact: true }).fill("QA actualizado");
  await page.getByRole("button", { name: "Guardar perfil", exact: true }).click();
  await expect(page.getByText("Tu perfil está actualizado.")).toBeVisible();
  for (const width of [1440, 1100, 820, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/home");
    await expect(page.getByText("Qué bueno verte, QA actualizado.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.goto("/my-list");
  await expect(page.getByRole("heading", { name: "Guarda algo para después." })).toBeVisible();
  await page.goto("/profile");
  await page.getByText("Cambiar contraseña", { exact: true }).click();
  await page.getByLabel("Contraseña actual", { exact: true }).fill(fixture.password);
  await page.getByLabel("Nueva contraseña", { exact: true }).fill(`${fixture.password}-new`);
  await page.getByRole("button", { name: "Cambiar contraseña y salir", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await login(page, email, `${fixture.password}-new`);
});

test("logout clears browser session during an owned Redis outage", async ({ context }) => {
  const email = await account(context);
  expect(
    (
      await context.request.post("/api/bff/auth/login", {
        headers,
        data: { email, password: fixture.password },
      })
    ).status(),
  ).toBe(200);
  try {
    await dc("stop", "redis");
    const response = await context.request.post("/api/bff/auth/logout", { headers });
    expect(response.status()).toBe(200);
    expect((await response.json()).revoked).toBe(false);
    expect((await context.cookies()).some((cookie) => cookie.name === "nevaro_session")).toBe(
      false,
    );
  } finally {
    await dc("start", "redis");
    await healthy("redis");
  }
});
