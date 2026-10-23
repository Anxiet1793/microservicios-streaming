import { createWriteStream } from "node:fs";
import { mkdtemp, rm, open, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Busboy from "busboy";
import { z } from "zod";
import { fail, PlaybackError } from "../../domain/model";
import type { Config } from "../../../../shared/config";
import type { Upload } from "../../application/ports";

export async function receiveUpload<T>(
  request: Request,
  config: Config,
  consume: (file: Upload) => Promise<T>,
): Promise<T> {
  if (!request.body) fail("VALIDATION_ERROR");
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.startsWith("multipart/form-data;")) fail("UNSUPPORTED_MEDIA_TYPE");
  if (Number(request.headers.get("content-length") || 0) > config.MAX_UPLOAD_BYTES + 65536)
    fail("FILE_TOO_LARGE");
  const directory = await mkdtemp(join(tmpdir(), "playback-upload-")),
    path = join(directory, "asset.mp4");
  try {
    let parser: ReturnType<typeof Busboy>;
    try {
      parser = Busboy({
        headers: { "content-type": contentType },
        limits: { files: 1, fields: 0, parts: 2, fileSize: config.MAX_UPLOAD_BYTES + 1 },
      });
    } catch {
      fail("VALIDATION_ERROR");
    }
    let filename = "",
      fileError: PlaybackError | undefined,
      write: Promise<void> | undefined,
      total = 0;
    const invalid = () => {
      fileError = new PlaybackError("VALIDATION_ERROR");
    };
    parser.on("fieldsLimit", invalid);
    parser.on("filesLimit", invalid);
    parser.on("partsLimit", invalid);
    parser.on("file", (name, file, info) => {
      filename = [...basename(info.filename.replaceAll("\\", "/"))]
        .filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127)
        .join("")
        .slice(0, 200);
      if (name !== "file" || !filename) {
        invalid();
        file.resume();
        return;
      }
      if (info.mimeType !== "video/mp4" || !/\.mp4$/i.test(filename)) {
        fileError = new PlaybackError("UNSUPPORTED_MEDIA_TYPE");
        file.resume();
        return;
      }
      file.on("limit", () => {
        fileError = new PlaybackError("FILE_TOO_LARGE");
      });
      write = pipeline(file, createWriteStream(path, { flags: "wx" }));
      // Attach immediately to avoid an unhandled rejection before parser completion.
      void write.catch(() => undefined);
    });
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        total += chunk.length;
        callback(
          total > config.MAX_UPLOAD_BYTES + 65536 ? new PlaybackError("FILE_TOO_LARGE") : null,
          chunk,
        );
      },
    });
    try {
      await pipeline(Readable.fromWeb(request.body as never), limiter, parser, {
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(120000)]),
      });
      if (write) await write;
    } catch (error) {
      if (write) await write.catch(() => undefined);
      if (error instanceof PlaybackError) throw error;
      fail("VALIDATION_ERROR");
    }
    if (fileError) throw fileError;
    if (!write || !filename) fail("VALIDATION_ERROR");
    const sizeBytes = (await stat(path)).size;
    if (!sizeBytes) fail("VALIDATION_ERROR");
    if (sizeBytes > config.MAX_UPLOAD_BYTES) fail("FILE_TOO_LARGE");
    const header = Buffer.alloc(12),
      file = await open(path, "r");
    try {
      await file.read(header, 0, 12, 0);
    } finally {
      await file.close();
    }
    if (header.toString("ascii", 4, 8) !== "ftyp") fail("UNSUPPORTED_MEDIA_TYPE");
    let stdout: string;
    try {
      ({ stdout } = await promisify(execFile)(
        config.FFPROBE_PATH,
        [
          "-v",
          "error",
          "-protocol_whitelist",
          "file",
          "-show_entries",
          "format=duration,format_name:stream=codec_type,codec_name,width,height",
          "-of",
          "json",
          path,
        ],
        { timeout: 20000, maxBuffer: 65536, windowsHide: true },
      ));
    } catch {
      fail("UNSUPPORTED_MEDIA_TYPE");
    }
    const probe = z
      .object({
        format: z.object({
          duration: z.coerce.number().positive().max(86400),
          format_name: z.string(),
        }),
        streams: z.array(
          z.object({
            codec_type: z.string(),
            codec_name: z.string(),
            width: z.number().optional(),
            height: z.number().optional(),
          }),
        ),
      })
      .safeParse(JSON.parse(stdout));
    if (!probe.success || !probe.data.format.format_name.split(",").includes("mp4"))
      fail("UNSUPPORTED_MEDIA_TYPE");
    const video = probe.data.streams.find((s) => s.codec_type === "video");
    if (
      !video ||
      video.codec_name !== "h264" ||
      !video.width ||
      !video.height ||
      probe.data.streams.some((s) => s.codec_type === "audio" && s.codec_name !== "aac")
    )
      fail("UNSUPPORTED_MEDIA_TYPE");
    return await consume({
      path,
      filename,
      sizeBytes,
      durationSeconds: probe.data.format.duration,
      codec: video.codec_name,
      width: video.width,
      height: video.height,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
