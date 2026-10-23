import { beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { Player } from "../../src/features/playback/Player";
import { mount, deferred } from "../support/render";
const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
const source = { url: "http://media.example.test/short.mp4", expiresIn: 900 };
const playback = {
  session: { sessionId: "ses_test", progress: { positionSeconds: 30 } },
  playback: source,
};
let video: HTMLVideoElement;
beforeEach(() => {
  const paused = new WeakMap<HTMLMediaElement, boolean>();
  vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(120);
  vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    return paused.get(this) ?? true;
  });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    queueMicrotask(() => this.dispatchEvent(new Event("loadedmetadata")));
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async function (
    this: HTMLMediaElement,
  ) {
    paused.set(this, false);
    this.dispatchEvent(new Event("play"));
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    if (paused.get(this) === false) {
      paused.set(this, true);
      this.dispatchEvent(new Event("pause"));
    }
  });
});
function setup() {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url) =>
      String(url).endsWith("/sessions") || String(url).endsWith("/resume")
        ? Response.json(playback)
        : String(url).endsWith("/refresh-url")
          ? Response.json({ playback: { ...source, url: "http://media.example.test/renewed.mp4" } })
          : new Response(null, { status: 204 }),
    );
  const rendered = mount(<Player tituloId="ttl_test" title="Historia de prueba" />);
  video = rendered.container.querySelector("video")!;
  return fetch;
}
async function prepare() {
  fireEvent.click(screen.getByRole("button", { name: "Preparar reproducción" }));
  await screen.findByRole("button", { name: "Reproducir" });
}
it("creates a single session, exposes loading and restores initial currentTime", async () => {
  const fetch = setup(),
    pending = deferred<Response>();
  fetch.mockReturnValueOnce(pending.promise);
  fireEvent.click(screen.getByRole("button", { name: "Preparar reproducción" }));
  const loading = screen.getByRole("button", { name: "Preparando video…" });
  expect(loading).toBeDisabled();
  fireEvent.click(loading);
  expect(fetch).toHaveBeenCalledOnce();
  await act(async () => pending.resolve(Response.json(playback)));
  await screen.findByRole("button", { name: "Reproducir" });
  expect(video.currentTime).toBe(30);
  expect(fetch.mock.calls[0]?.[1]).toMatchObject({
    method: "POST",
    body: JSON.stringify({ tituloId: "ttl_test" }),
  });
  expect(screen.getByRole("slider", { name: "Posición de reproducción" })).toHaveAttribute(
    "aria-valuetext",
    "0:30 de 2:00",
  );
});
it("plays, persists a seek, pauses with position and resumes with a new URL", async () => {
  const fetch = setup();
  await prepare();
  fireEvent.click(screen.getByRole("button", { name: "Reproducir" }));
  await screen.findByRole("button", { name: "Pausar" });
  video.currentTime = 45;
  fireEvent.seeked(video);
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      "/api/bff/sessions/ses_test/progress",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ positionSeconds: 45 }) }),
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("Pausa y avance guardados"),
  );
  expect(fetch).toHaveBeenCalledWith(
    "/api/bff/sessions/ses_test/pause",
    expect.objectContaining({ body: JSON.stringify({ positionSeconds: 45 }) }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Reproducir" }));
  await screen.findByRole("button", { name: "Pausar" });
  expect(fetch).toHaveBeenCalledWith(
    "/api/bff/sessions/ses_test/resume",
    expect.objectContaining({ method: "POST" }),
  );
  expect(video.currentTime).toBe(45);
});
it("automatically saves playing progress every ten seconds and stops timers on unmount", async () => {
  const fetch = setup();
  await prepare();
  fireEvent.click(screen.getByRole("button", { name: "Reproducir" }));
  await screen.findByRole("button", { name: "Pausar" });
  // Fake only intervals: metadata, React Query and URL timers retain normal ordering.
  const callbacks: (() => void)[] = [];
  const interval = vi.spyOn(globalThis, "setInterval").mockImplementation((callback) => {
    callbacks.push(callback as () => void);
    return 777 as unknown as ReturnType<typeof setInterval>;
  });
  const clear = vi.spyOn(globalThis, "clearInterval");
  const second = mount(<Player tituloId="ttl_timer" title="Temporizador" />);
  const secondVideo = second.container.querySelector("video")!;
  const buttons = screen.getAllByRole("button", { name: "Preparar reproducción" });
  fireEvent.click(buttons[0]!);
  await waitFor(() => expect(second.container.querySelector("input[type=range]")).not.toBeNull());
  await act(async () => {
    await secondVideo.play();
  });
  secondVideo.currentTime = 52;
  expect(interval).toHaveBeenCalledWith(expect.any(Function), 10000);
  await act(async () => callbacks[0]!());
  expect(fetch).toHaveBeenCalledWith(
    "/api/bff/sessions/ses_test/progress",
    expect.objectContaining({ body: JSON.stringify({ positionSeconds: 52 }) }),
  );
  second.unmount();
  expect(clear).toHaveBeenCalledWith(777);
});
it("completes once and stops progress after completion", async () => {
  const fetch = setup();
  await prepare();
  fireEvent.ended(video);
  expect(await screen.findByRole("heading", { name: "Hasta la próxima historia." })).toBeVisible();
  const count = fetch.mock.calls.length;
  video.currentTime = 120;
  fireEvent.seeked(video);
  fireEvent.ended(video);
  await act(async () => {});
  expect(fetch.mock.calls.length).toBe(count);
});
it("renews an expiring URL while preserving paused position", async () => {
  const timers: { callback: () => void; ms: number | undefined }[] = [];
  const original = globalThis.setTimeout;
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((
    callback: () => void,
    ms?: number,
    ...args: unknown[]
  ) => {
    if (ms === 840000) {
      timers.push({ callback, ms });
      return original(() => {}, 840000);
    }
    return original(callback, ms, ...args);
  }) as typeof setTimeout);
  const fetch = setup();
  await prepare();
  video.currentTime = 48;
  expect(timers).toHaveLength(1);
  await act(async () => timers[0]!.callback());
  await waitFor(() => expect(video.src).toBe("http://media.example.test/renewed.mp4"));
  expect(video.currentTime).toBe(48);
  expect(video.paused).toBe(true);
  expect(fetch).toHaveBeenCalledWith(
    "/api/bff/sessions/ses_test/refresh-url",
    expect.objectContaining({ method: "POST" }),
  );
});
it("offers recovery after a media error and renews without creating another session", async () => {
  const fetch = setup();
  await prepare();
  fireEvent.error(video);
  expect(screen.getByRole("alert")).toHaveTextContent("No pudimos continuar el video");
  fireEvent.click(screen.getByRole("button", { name: "Renovar acceso" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(fetch.mock.calls.filter(([url]) => String(url).endsWith("/sessions"))).toHaveLength(1);
});
it("reports playback service failure and allows opening another session", async () => {
  const fetch = setup();
  fetch.mockResolvedValueOnce(
    Response.json({ error: { code: "SERVICE_UNAVAILABLE" } }, { status: 503 }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Preparar reproducción" }));
  expect(await screen.findByRole("alert")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Abrir un nuevo reproductor" }));
  await screen.findByRole("button", { name: "Reproducir" });
});
