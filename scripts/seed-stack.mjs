import { execFile } from "node:child_process";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { json, serviceUrls } from "./lib/stack-http.mjs";

const id = (prefix) => new RegExp(`^${prefix}_[0-9a-f-]{36}$`);
const path = process.env.SEED_STATE_FILE || "/app/public/stack-seed.json";
async function save(state) {
  await writeFile(path + ".tmp", JSON.stringify(state), { mode: 0o600 });
  await rename(path + ".tmp", path);
}
async function seed() {
  if (process.env.DEMO_SEED_ENABLED === "false") {
    console.log("Demo media seed disabled");
    return;
  }
  if (!process.env.SEED_PASSWORD) throw new Error("Falta SEED_PASSWORD");
  const urls = serviceUrls();
  const login = await json(urls.users, "/api/v1/auth/login", {
    method: "POST",
    body: { email: "admin@streaming.local", password: process.env.SEED_PASSWORD },
  });
  if (login.user.role !== "ADMIN") throw new Error("La cuenta seed debe ser ADMIN");
  const token = login.accessToken;
  let state = { version: 1 };
  try {
    state = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw new Error("Estado seed inválido; no se sobrescribe");
  }
  if (
    state.version !== 1 ||
    (state.assetId && !id("ast").test(state.assetId)) ||
    (state.tituloId && !id("ttl").test(state.tituloId))
  )
    throw new Error("Estado seed inválido");
  if (!state.assetId) {
    const directory = await mkdtemp(join(tmpdir(), "nevaro-stack-seed-"));
    try {
      const clip = join(directory, "demo.mp4");
      await promisify(execFile)(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-f",
          "lavfi",
          "-i",
          "testsrc2=size=320x180:rate=24",
          "-t",
          "12",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          clip,
        ],
        { timeout: 30000, windowsHide: true, maxBuffer: 65536 },
      );
      const bytes = await readFile(clip);
      if (bytes.length > 1048576) throw new Error("El clip demo supera 1 MiB");
      const form = new FormData();
      form.append("file", new Blob([bytes], { type: "video/mp4" }), "nevaro-demo.mp4");
      const uploaded = await json(urls.playback, "/api/v1/media/assets", {
        method: "POST",
        body: form,
        token,
        expected: 201,
      });
      state.assetId = uploaded.asset.assetId;
      await save(state); // Preserve asset identity if Catalog is temporarily unavailable on retry.
    } finally {
      const target = resolve(directory);
      if (
        dirname(target) !== resolve(tmpdir()) ||
        !basename(target).startsWith("nevaro-stack-seed-")
      )
        throw new Error("Unsafe temporary path");
      await rm(target, { recursive: true, force: true });
    }
  }
  await json(urls.playback, `/api/v1/media/assets/${state.assetId}`, { token });
  if (!state.tituloId) {
    const imported = await json(urls.catalog, "/api/v1/catalog/bulk", {
      method: "POST",
      token,
      body: {
        items: [
          {
            importKey: "nevaro:demo:synthetic-v1",
            typeId: 1,
            ficha: {
              title: "NÉVARO Demo · Viaje sintético",
              synopsis:
                "Clip sintético propio de doce segundos para explorar el MVP y probar su reproducción.",
              releaseYear: 2026,
              durationMinutes: 1,
              genres: [10],
              languages: [1],
            },
            playbackReference: {
              providerId: 1,
              assetId: state.assetId,
              manifestKey: `asset:${state.assetId}`,
            },
          },
        ],
      },
    });
    const result = imported.results?.[0];
    if (!id("ttl").test(result?.tituloId || ""))
      throw new Error("Catalog no confirmó el título demo");
    state.tituloId = result.tituloId;
    await save(state);
  }
  const title = await json(urls.catalog, `/api/v1/catalog/${state.tituloId}`);
  if (title.playbackReference?.assetId !== state.assetId)
    throw new Error("El estado seed no coincide con Catalog");
  if (title.publicationStatusId === 1)
    await json(urls.catalog, `/api/v1/catalog/${state.tituloId}/publication-status`, {
      method: "PATCH",
      token,
      body: { publicationStatusId: 2 },
    });
  // Preserve editorial changes, including intentionally withdrawn demo titles.
  console.log(
    JSON.stringify({
      event: "stack_demo_seed_completed",
      tituloId: state.tituloId,
      assetId: state.assetId,
      videoSeconds: 12,
    }),
  );
}
try {
  await seed();
} catch (error) {
  console.error(
    error.message?.startsWith("POST /api/v1/auth/login")
      ? "Seed ADMIN login failed. Existing demo passwords are never overwritten; check SEED_PASSWORD."
      : "Stack media seed failed. Check API health and the persisted seed state; no credentials were logged.",
  );
  process.exitCode = 1;
}
