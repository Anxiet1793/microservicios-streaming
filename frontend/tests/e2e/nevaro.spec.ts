import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { readFile, mkdir } from "node:fs/promises";
import { parseEnv } from "node:util";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const env = parseEnv(await readFile("../users-service/.env", "utf8"));
if (env.APP_ENV !== "development" || !env.SEED_PASSWORD)
  throw new Error("E2E requires local development seed");
const demo = JSON.parse(
  await readFile("../playback-service/docs/demo-local.json", "utf8"),
) as { tituloId: string };
const password = `Nevaro-${randomBytes(18).toString("hex")}`;
test("register, authenticate, save preferences, play MP4, resume and isolate accounts", async ({
  page,
  context,
}) => {
  const email = `nevaro-${Date.now()}-${test.info().repeatEachIndex}@example.test`;
  await page.goto("/register");
  await page.getByLabel("Nombre visible").fill("Espectador Névaro");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tu cuenta está lista." }),
  ).toBeVisible();
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(
    page.getByText("Qué bueno verte, Espectador Névaro."),
  ).toBeVisible();
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "nevaro_session")?.httpOnly).toBe(true);
  expect(cookies.some((c) => c.name === "users_refresh")).toBe(false);
  const denied = await context.request.post("/api/bff/admin/catalog", {
    headers: { "X-Nevaro-Request": "1" },
    data: {},
  });
  expect(denied.status()).toBe(403);
  const csrf = await context.request.post("/api/bff/auth/logout", {
    headers: { Origin: "https://wrong.example", "X-Nevaro-Request": "1" },
  });
  expect(csrf.status()).toBe(403);
  await page.goto(`/title/${demo.tituloId}`);
  await page.getByRole("button", { name: "+ Mi Lista", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "En Mi Lista", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Me gusta", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Me gusta", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "No me gusta", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "No me gusta", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Me gusta", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("link", { name: "Reproducir", exact: true }).click();
  await page
    .getByRole("button", { name: "Preparar reproducción", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reproducir", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reproducir", exact: true }).click();
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeGreaterThan(0);
  await page.locator("video").evaluate((v: HTMLVideoElement) => {
    v.currentTime = 25;
  });
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Pausa y avance guardados",
  );
  await page.getByRole("button", { name: "Volver a la ficha" }).click();
  await page.goto("/home");
  await expect(
    page.getByRole("link", { name: /Continuar desde 0:2/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Continuar desde 0:2/ }).click();
  await page
    .getByRole("button", { name: "Preparar reproducción", exact: true })
    .click();
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeGreaterThanOrEqual(24);
  await page.goto("/profile");
  await page
    .getByLabel("Nombre visible", { exact: true })
    .fill("Espectador actualizado");
  await page
    .getByRole("button", { name: "Guardar perfil", exact: true })
    .click();
  await expect(page.getByText("Tu perfil está actualizado.")).toBeVisible();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/my-list");
  await expect(
    page.getByRole("heading", { name: "Exposición académica" }),
  ).toBeVisible();
  await page.goto("/preferences");
  await expect(page.getByText("No me gusta", { exact: true })).toBeVisible();
  for (const width of [1440, 1100, 820, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/home");
    await expect(
      page.getByRole("heading", { name: "Continuar viendo", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Continuar desde/ }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await mkdir(".verification", { recursive: true });
    await page.screenshot({
      path: `.verification/home-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/watch/${demo.tituloId}`);
  await page
    .getByRole("button", { name: "Preparar reproducción", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reproducir", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reproducir", exact: true }).click();
  await page.locator("video").evaluate((v: HTMLVideoElement) => {
    v.currentTime = v.duration - 0.2;
  });
  await expect(
    page.getByRole("heading", { name: "Hasta la próxima historia." }),
  ).toBeVisible();
  await page.goto("/history");
  await expect(page.getByText(/Completado/)).toBeVisible();
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/register");
  await page.getByLabel("Nombre visible").fill("Otra cuenta");
  await page.getByLabel("Correo electrónico").fill(`other-${email}`);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tu cuenta está lista." }),
  ).toBeVisible();
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(`other-${email}`);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/my-list");
  await expect(
    page.getByRole("heading", { name: "Guarda algo para después." }),
  ).toBeVisible();
  await page.goto("/profile");
  await page.getByText("Cambiar contraseña", { exact: true }).click();
  await page.getByLabel("Contraseña actual", { exact: true }).fill(password);
  await page
    .getByLabel("Nueva contraseña", { exact: true })
    .fill(`${password}-new`);
  await page
    .getByRole("button", { name: "Cambiar contraseña y salir", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login/);
});
test("ADMIN streams an MP4, creates and publishes a title", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("admin@streaming.local");
  await page.getByLabel("Contraseña", { exact: true }).fill(env.SEED_PASSWORD!);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/admin/upload");
  await page
    .getByLabel("Archivo de video")
    .setInputFiles(
      resolve("../playback-service/.verification/synthetic-demo.mp4"),
    );
  await page.getByRole("button", { name: "Subir video", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Completa la ficha" }),
  ).toBeVisible();
  await page
    .getByLabel("Título", { exact: true })
    .fill(`Detrás de Névaro ${Date.now()}`);
  await page
    .getByLabel("Sinopsis", { exact: true })
    .fill(
      "Video sintético propio para comprobar la publicación real de la plataforma.",
    );
  await page.getByRole("button", { name: "Crear ficha", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Lista para publicar." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Publicar título", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tu historia ya está en NÉVARO." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Ver la ficha", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Reproducir", exact: true }),
  ).toBeVisible();
  const id = page.url().split("/").at(-1)!;
  await page.goto(`/admin/content/${id}`);
  await page
    .getByLabel("Título", { exact: true })
    .fill("Detrás de NÉVARO · Ensayo publicado");
  await page
    .getByRole("button", { name: "Guardar ficha", exact: true })
    .click();
  await expect(page.getByText("Ficha actualizada.")).toBeVisible();
  await page.goto(`/title/${id}`);
  await expect(
    page.getByRole("heading", {
      name: "Detrás de NÉVARO · Ensayo publicado",
      exact: true,
    }),
  ).toBeVisible();
});
test("concurrent expired access uses a single refresh rotation", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("demo@streaming.local");
  await page.getByLabel("Contraseña", { exact: true }).fill(env.SEED_PASSWORD!);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  const id = (await context.cookies()).find(
    (c) => c.name === "nevaro_session",
  )!.value;
  const code = await readFile("scripts/force-test-expiry.mjs", "utf8");
  const count = async () => {
    const { stdout, stderr } = await promisify(execFile)(
      "docker",
      ["logs", "users-service-users-service-1"],
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
    );
    return (stdout + stderr)
      .split("\n")
      .filter((line) => line.includes('"endpoint":"/api/v1/auth/refresh"'))
      .length;
  };
  const before = await count();
  await new Promise<void>((resolve, reject) => {
    const child = execFile(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "frontend",
        "node",
        "--input-type=module",
        "-e",
        code,
      ],
      { windowsHide: true },
      (error) =>
        error
          ? reject(new Error("Could not prepare test session expiry"))
          : resolve(),
    );
    child.stdin!.end(id);
  });
  const responses = await Promise.all([
    context.request.get("/api/bff/me"),
    context.request.get("/api/bff/library/watchlist"),
    context.request.get("/api/bff/library/history"),
  ]);
  for (const response of responses) expect(response.status()).toBe(200);
  expect((await count()) - before).toBe(1);
  const me = await context.request.get("/api/bff/me");
  expect(me.status()).toBe(200);
  const body = await me.text();
  expect(body).not.toContain("accessToken");
  expect(body).not.toContain("refreshToken");
});
test("signed URL renewal preserves the paused position", async ({ page }) => {
  await page.clock.install();
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("demo@streaming.local");
  await page.getByLabel("Contraseña", { exact: true }).fill(env.SEED_PASSWORD!);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto(`/watch/${demo.tituloId}`);
  await page
    .getByRole("button", { name: "Preparar reproducción", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reproducir", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reproducir", exact: true }).click();
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.paused),
    )
    .toBe(false);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Pausa y avance guardados",
  );
  const at = await page
    .locator("video")
    .evaluate((v: HTMLVideoElement) => v.currentTime);
  const renewed = page.waitForResponse(
    (r) => r.url().includes("/refresh-url") && r.request().method() === "POST",
  );
  await page.clock.fastForward(841000);
  expect((await renewed).status()).toBe(200);
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.readyState),
    )
    .toBeGreaterThanOrEqual(1);
  await expect
    .poll(async () =>
      Math.abs(
        (await page
          .locator("video")
          .evaluate((v: HTMLVideoElement) => v.currentTime)) - at,
      ),
    )
    .toBeLessThan(2);
  expect(
    await page.locator("video").evaluate((v: HTMLVideoElement) => v.paused),
  ).toBe(true);
});
test("logout clears the browser cookie when Redis cannot confirm remote revocation", async ({
  context,
}) => {
  const exec = promisify(execFile);
  const email = `logout-${Date.now()}@example.test`,
    password = randomBytes(20).toString("hex");
  const headers = { "X-Nevaro-Request": "1" };
  expect(
    (
      await context.request.post("/api/bff/auth/register", {
        headers,
        data: { email, password, displayName: "Ensayo de cierre" },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await context.request.post("/api/bff/auth/login", {
        headers,
        data: { email, password },
      })
    ).status(),
  ).toBe(200);
  try {
    await exec("docker", ["compose", "stop", "redis"], { windowsHide: true });
    const response = await context.request.post("/api/bff/auth/logout", {
      headers,
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).revoked).toBe(false);
    expect(
      (await context.cookies()).some((c) => c.name === "nevaro_session"),
    ).toBe(false);
  } finally {
    await exec("docker", ["compose", "start", "redis"], { windowsHide: true });
    await expect
      .poll(async () =>
        (
          await exec(
            "docker",
            ["compose", "exec", "-T", "redis", "redis-cli", "ping"],
            { windowsHide: true },
          )
        ).stdout.trim(),
      )
      .toBe("PONG");
  }
});
