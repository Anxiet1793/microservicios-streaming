import { expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Upload } from "../../src/features/admin/Upload";
import UploadPage from "../../src/app/(admin)/admin/upload/page";
import { Editor } from "../../src/features/admin/Editor";
const mocks = vi.hoisted(() => ({ viewer: vi.fn() }));
vi.mock("../../src/lib/server/guard", () => ({ viewer: mocks.viewer }));
class UploadRequest {
  static current: UploadRequest;
  upload = {
    onprogress: (event: { lengthComputable: boolean; loaded: number; total: number }) => {
      void event;
    },
    onload: () => {},
  };
  status = 201;
  responseText = "";
  timeout = 0;
  onload = () => {};
  onerror = () => {};
  ontimeout = () => {};
  onabort = () => {};
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  abort = vi.fn();
  constructor() {
    UploadRequest.current = this;
  }
}
function choose(type = "video/mp4", name = "test.mp4") {
  vi.stubGlobal("XMLHttpRequest", UploadRequest);
  render(<Upload userId="usr_admin" />);
  fireEvent.change(screen.getByLabelText("Archivo de video"), {
    target: { files: [new File(["synthetic"], name, { type })] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Subir video" }));
  return UploadRequest.current;
}
it.each(["USER", "ADMIN"])("upload route checks %s before rendering the form", async (role) => {
  mocks.viewer.mockResolvedValue({ role, userId: "usr_test" });
  render(await UploadPage());
  if (role === "ADMIN") expect(screen.getByLabelText("Archivo de video")).toBeVisible();
  else expect(screen.queryByLabelText("Archivo de video")).toBeNull();
});
it("streams MP4, exposes upload progress and confirms asset metadata", async () => {
  const xhr = choose();
  expect(xhr.open).toHaveBeenCalledWith("POST", "/api/bff/admin/assets");
  expect(xhr.setRequestHeader).toHaveBeenCalledWith("X-Nevaro-Request", "1");
  expect(xhr.send.mock.calls[0]?.[0]).toBeInstanceOf(FormData);
  await act(async () => {
    xhr.upload.onprogress({ lengthComputable: true, loaded: 4, total: 10 });
  });
  expect(screen.getByRole("progressbar", { name: "Transferencia del archivo" })).toHaveAttribute(
    "value",
    "40",
  );
  expect(screen.getByRole("button", { name: "Procesando…" })).toBeDisabled();
  xhr.responseText = JSON.stringify({
    asset: {
      assetId: "ast_test",
      originalFilename: "test.mp4",
      sizeBytes: 1234,
      durationSeconds: 12,
      codec: "h264",
      width: 320,
      height: 180,
      status: "READY",
    },
  });
  await act(async () => xhr.onload());
  expect(screen.getByRole("heading", { name: "Completa la ficha" })).toBeVisible();
  expect(screen.getByText("ast_test")).toBeVisible();
  expect(sessionStorage.getItem("nevaro:upload:usr_admin")).toContain("ast_test");
});
it.each(["onerror", "ontimeout", "onabort"] as const)(
  "reports uncertain upload after %s without automatically retrying",
  async (event) => {
    const xhr = choose();
    await act(async () => xhr[event]());
    expect(screen.getByRole("alert")).toHaveTextContent("No repitas la carga sin comprobar");
    expect(xhr.send).toHaveBeenCalledOnce();
  },
);
it("shows a controlled API upload error", async () => {
  const xhr = choose();
  xhr.status = 403;
  xhr.responseText = JSON.stringify({ error: { code: "FORBIDDEN" } });
  await act(async () => xhr.onload());
  expect(screen.getByRole("alert")).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Completa la ficha" })).toBeNull();
});
it("rejects a non MP4 before starting a network transfer", () => {
  choose("text/plain", "file.txt");
  expect(screen.getByRole("alert")).toHaveTextContent("Selecciona un archivo MP4");
});
it("retains a stable import key after a rejected ficha and publishes without uploading twice", async () => {
  const xhr = choose();
  xhr.responseText = JSON.stringify({
    asset: {
      assetId: "ast_test",
      originalFilename: "test.mp4",
      sizeBytes: 1234,
      durationSeconds: 12,
      codec: "h264",
      width: 320,
      height: 180,
      status: "READY",
    },
  });
  await act(async () => xhr.onload());
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      Response.json({ error: { code: "SERVICE_UNAVAILABLE" } }, { status: 503 }),
    )
    .mockResolvedValueOnce(Response.json({ results: [{ status: "CREATED", tituloId: "ttl_new" }] }))
    .mockResolvedValueOnce(Response.json({}));
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Prueba" } });
  fireEvent.change(screen.getByLabelText("Sinopsis"), {
    target: { value: "Una historia de prueba" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Crear ficha" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Crear ficha" }));
  await screen.findByRole("heading", { name: "Lista para publicar." });
  const first = JSON.parse(fetch.mock.calls[0]![1]!.body as string),
    second = JSON.parse(fetch.mock.calls[1]![1]!.body as string);
  expect(second.importKey).toBe(first.importKey);
  expect(second.playbackReference.assetId).toBe("ast_test");
  fireEvent.click(screen.getByRole("button", { name: "Publicar título" }));
  expect(
    await screen.findByRole("heading", { name: "Tu historia ya está en NÉVARO." }),
  ).toBeVisible();
  expect(sessionStorage.getItem("nevaro:upload:usr_admin")).toBeNull();
  expect(xhr.send).toHaveBeenCalledOnce();
});
it("editor preserves noneditable catalog metadata while clearing blank artwork URLs", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}));
  render(
    <Editor
      title={{
        tituloId: "ttl_test",
        typeId: 1,
        publicationStatusId: 2,
        ficha: {
          title: "Original",
          synopsis: "Sinopsis",
          releaseYear: 2026,
          genres: [10],
          durationMinutes: 1,
          originalTitle: "Original title",
          director: "Autora",
          cast: ["Actor"],
          ageRatingId: 1,
        },
      }}
    />,
  );
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Editado" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar ficha" }));
  await screen.findByRole("status");
  const body = JSON.parse(fetch.mock.calls[0]![1]!.body as string);
  expect(body.ficha).toMatchObject({
    title: "Editado",
    originalTitle: "Original title",
    director: "Autora",
    cast: ["Actor"],
    ageRatingId: 1,
    posterUrl: null,
    backdropUrl: null,
  });
  expect(body).not.toHaveProperty("playbackReference");
  expect(body).not.toHaveProperty("publicationStatusId");
});
