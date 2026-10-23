"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { UploadCloud, Check, ArrowRight } from "lucide-react";
import { api, errorMessage } from "../../lib/api/client";
import { TitleFields, ficha } from "./Editor";
import s from "./admin.module.css";
interface Asset {
  assetId: string;
  originalFilename: string;
  sizeBytes: number;
  durationSeconds: number;
  codec: string;
  width: number;
  height: number;
  status: string;
}
export function Upload({ userId }: { userId: string }) {
  const [asset, setAsset] = useState<Asset | null>(null),
    [file, setFile] = useState<File | null>(null),
    [percent, setPercent] = useState(0),
    [phase, setPhase] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [titleId, setTitleId] = useState(""),
    [published, setPublished] = useState(false);
  const importKey = useRef(""),
    request = useRef<XMLHttpRequest | null>(null);
  const storageKey = `nevaro:upload:${userId}`;
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        setAsset(data.asset);
        importKey.current = data.importKey;
        setTitleId(data.titleId || "");
      }
    } catch {
      /* Ignore damaged local draft. */
    }
    return () => {
      request.current?.abort();
    };
  }, [storageKey]);
  function persist(a: Asset, id = "") {
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ asset: a, importKey: importKey.current, titleId: id }),
    );
  }
  function upload() {
    if (!file || pending) return;
    setError("");
    if (file.size > 268435456) {
      setError("El archivo supera 256 MiB.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".mp4") || file.type !== "video/mp4") {
      setError("Selecciona un archivo MP4 H.264 con audio AAC opcional.");
      return;
    }
    setPending(true);
    setPhase("Subiendo archivo…");
    const body = new FormData();
    body.append("file", file);
    const xhr = new XMLHttpRequest();
    request.current = xhr;
    xhr.open("POST", "/api/bff/admin/assets");
    xhr.setRequestHeader("X-Nevaro-Request", "1");
    xhr.timeout = 125000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setPercent(Math.round((e.loaded / e.total) * 100));
    };
    xhr.upload.onload = () => setPhase("Archivo enviado. Validando el video…");
    xhr.onload = () => {
      try {
        const result = JSON.parse(xhr.responseText);
        if (xhr.status < 200 || xhr.status >= 300)
          throw new Error(errorMessage(result.error?.code));
        setAsset(result.asset);
        importKey.current = `nevaro-${crypto.randomUUID()}`;
        persist(result.asset);
        setPhase("Video cargado. Ahora completa su ficha.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "No pudimos confirmar la carga.");
      } finally {
        setPending(false);
      }
    };
    const fail = () => {
      setPending(false);
      setError("No pudimos confirmar el resultado. No repitas la carga sin comprobar si terminó.");
    };
    xhr.onerror = fail;
    xhr.ontimeout = fail;
    xhr.onabort = fail;
    xhr.send(body);
  }
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!asset) return;
    const data = ficha(e.currentTarget);
    setPending(true);
    setError("");
    try {
      const result = await api<{
        results: { status: string; tituloId?: string; code?: string }[];
      }>("admin/catalog", "POST", {
        importKey: importKey.current,
        typeId: 1,
        ficha: data,
        playbackReference: {
          providerId: 1,
          assetId: asset.assetId,
          manifestKey: `asset:${asset.assetId}`,
        },
      });
      const row = result.results[0];
      if (!row?.tituloId)
        throw new Error(
          row?.code === "IMPORT_KEY_CONFLICT"
            ? "Esta ficha ya se envió con otros datos. Comprueba el contenido antes de crear otro intento."
            : "No se pudo crear la ficha. Tu video sigue cargado.",
        );
      setTitleId(row.tituloId);
      persist(asset, row.tituloId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos crear la ficha.");
    } finally {
      setPending(false);
    }
  }
  async function publish() {
    setPending(true);
    setError("");
    try {
      await api(`admin/catalog/${titleId}/publication-status`, "PATCH", {
        publicationStatusId: 2,
      });
      setPublished(true);
      sessionStorage.removeItem(storageKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos publicar.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <span className="eyebrow">DEL ARCHIVO A LA PANTALLA</span>
      <h1>Una nueva historia.</h1>
      <p className="muted">Sube tu video, completa su ficha y compártelo en el catálogo.</p>
      <ol className={s.steps}>
        {["Archivo", "Validación", "Ficha", "Publicación"].map((step, i) => (
          <li
            key={step}
            aria-current={
              (!asset ? (phase.includes("Validando") ? 1 : 0) : !titleId ? 2 : 3) === i
                ? "step"
                : undefined
            }
          >
            <b>{i + 1}</b>
            {step}
          </li>
        ))}
      </ol>
      {published ? (
        <div className={s.published}>
          <Check size={36} color="var(--success)" />
          <h2>Tu historia ya está en NÉVARO.</h2>
          <p className="muted">El título está publicado y disponible para espectadores.</p>
          <div className="actions">
            <Link className="button" href={`/title/${titleId}`}>
              Ver la ficha <ArrowRight size={16} />
            </Link>
            <Link className="button secondary" href="/admin/content">
              Volver al contenido
            </Link>
          </div>
        </div>
      ) : !asset ? (
        <div className={s.dropzone}>
          <UploadCloud size={38} />
          <h2>Elige el próximo video.</h2>
          <p>MP4 · H.264 · AAC opcional · Hasta 256 MiB</p>
          <label className="field">
            <span>Archivo de video</span>
            <input
              type="file"
              accept="video/mp4,.mp4"
              disabled={pending}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          {file && (
            <p>
              {file.name} · {(file.size / 1048576).toFixed(1)} MiB
            </p>
          )}
          {pending && (
            <>
              <progress
                className={s.transfer}
                value={percent}
                max={100}
                aria-label="Transferencia del archivo"
              />
              <p role="status">{phase}</p>
            </>
          )}
          <div className="actions" style={{ justifyContent: "center" }}>
            <button className="button" onClick={upload} disabled={!file || pending}>
              {pending ? "Procesando…" : "Subir video"}
            </button>
            {pending && (
              <button className="button secondary" onClick={() => request.current?.abort()}>
                Cancelar transferencia
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className={s.formGrid}>
          {!titleId ? (
            <form onSubmit={create}>
              <h2>Completa la ficha</h2>
              <TitleFields duration={Math.max(1, Math.ceil(asset.durationSeconds / 60))} />
              <button className="button" disabled={pending}>
                {pending ? "Creando ficha…" : "Crear ficha"}
                <ArrowRight size={17} />
              </button>
            </form>
          ) : (
            <section>
              <h2>Lista para publicar.</h2>
              <p className="muted">
                La ficha está registrada. Al publicarla aparecerá en el catálogo de espectadores.
              </p>
              <button className="button" onClick={publish} disabled={pending}>
                {pending ? "Comprobando y publicando…" : "Publicar título"}
              </button>
              <p>
                <Link href={`/admin/content/${titleId}`}>Revisar ficha antes de publicar →</Link>
              </p>
            </section>
          )}
          <aside className={s.summary}>
            <span className="eyebrow">VIDEO CONFIRMADO</span>
            <h2>{asset.originalFilename}</h2>
            <dl>
              <dt>Duración</dt>
              <dd>{Math.round(asset.durationSeconds)} segundos</dd>
              <dt>Formato</dt>
              <dd>MP4 · {asset.codec.toUpperCase()}</dd>
              <dt>Resolución</dt>
              <dd>
                {asset.width} × {asset.height}
              </dd>
              <dt>Tamaño</dt>
              <dd>{(asset.sizeBytes / 1048576).toFixed(1)} MiB</dd>
            </dl>
            <p className="hint">Identificador del recurso</p>
            <code>{asset.assetId}</code>
            <p className="hint">
              Esta carga se conserva en esta pestaña si necesitas retomar la ficha. El video solo se
              vincula a un título nuevo.
            </p>
          </aside>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
