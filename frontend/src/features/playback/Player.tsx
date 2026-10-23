"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, ArrowLeft, Volume2, VolumeX, Maximize, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api/client";
import { time, type Playback } from "../../lib/models";
import { PlaybackQueue } from "./queue";
import s from "./player.module.css";
export function Player({ tituloId, title }: { tituloId: string; title: string }) {
  const router = useRouter(),
    cache = useQueryClient();
  const video = useRef<HTMLVideoElement>(null),
    frame = useRef<HTMLDivElement>(null),
    queue = useRef(new PlaybackQueue()),
    session = useRef<string | null>(null),
    backend = useRef("ACTIVE"),
    starting = useRef(false),
    replacing = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [playing, setPlaying] = useState(false),
    [position, setPosition] = useState(0),
    [duration, setDuration] = useState(0),
    [muted, setMuted] = useState(false),
    [error, setError] = useState(""),
    [sync, setSync] = useState(""),
    [completed, setCompleted] = useState(false);
  const failure = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.code === "SESSION_SUPERSEDED") {
      queue.current.stop();
      video.current?.pause();
      setError(e.message);
    } else setSync(e instanceof Error ? e.message : "No pudimos guardar tu avance.");
  }, []);
  const renew = useRef<() => Promise<void>>(async () => {});
  async function load(source: { url: string; expiresIn: number }, at: number, play: boolean) {
    let url: URL;
    try {
      url = new URL(source.url);
    } catch {
      throw new Error("No pudimos validar el acceso al video.");
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !Number.isFinite(source.expiresIn) ||
      source.expiresIn < 1 ||
      source.expiresIn > 3600 ||
      !Number.isFinite(at) ||
      at < 0
    )
      throw new Error("No pudimos validar el acceso al video.");
    const v = video.current;
    if (!v) return;
    replacing.current = true;
    if (timer.current) clearTimeout(timer.current);
    try {
      await new Promise<void>((resolve, reject) => {
        const done = () => {
          clearTimeout(timeout);
          v.removeEventListener("loadedmetadata", loaded);
          v.removeEventListener("error", failed);
        };
        const loaded = () => {
          done();
          resolve();
        };
        const failed = () => {
          done();
          reject(new Error("No pudimos abrir este video."));
        };
        const timeout = setTimeout(failed, 15000);
        v.addEventListener("loadedmetadata", loaded);
        v.addEventListener("error", failed);
        v.src = source.url;
        v.load();
      });
      v.currentTime = Math.min(at, Number.isFinite(v.duration) ? v.duration : at);
      setPosition(v.currentTime);
      setDuration(v.duration);
      setReady(true);
      if (play)
        await v.play().catch(() => {
          setPlaying(false);
        });
      timer.current = setTimeout(
        () => {
          void renew.current().catch(failure);
        },
        Math.max(10, source.expiresIn - 60) * 1000,
      );
    } finally {
      replacing.current = false;
    }
  }
  renew.current = async () => {
    await queue.current.run(async () => {
      if (!session.current || backend.current === "COMPLETED") return;
      const v = video.current!,
        at = v.currentTime,
        play = !v.paused;
      const result = await api<{
        playback: { url: string; expiresIn: number };
      }>(`sessions/${session.current}/refresh-url`, "POST");
      await load(result.playback, at, play);
    });
  };
  async function start() {
    if (starting.current) return;
    starting.current = true;
    setBusy(true);
    setError("");
    setSync("");
    queue.current = new PlaybackQueue();
    try {
      const result = await api<Playback>("sessions", "POST", { tituloId });
      session.current = result.session.sessionId;
      backend.current = "ACTIVE";
      setCompleted(false);
      if (!result.playback) throw new Error("El video no está disponible.");
      await load(result.playback, result.session.progress.positionSeconds, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos preparar el video.");
    } finally {
      starting.current = false;
      setBusy(false);
    }
  }
  const save = useCallback(() => {
    if (
      !session.current ||
      replacing.current ||
      backend.current === "COMPLETED" ||
      queue.current.stopped
    )
      return;
    const at = video.current?.currentTime ?? 0;
    setSync("Guardando avance…");
    void queue.current
      .progress(at, async (positionSeconds) => {
        await api(`sessions/${session.current}/progress`, "PATCH", {
          positionSeconds,
        });
        setSync(backend.current === "PAUSED" ? "Pausa y avance guardados" : "Avance guardado");
      })
      .catch(failure);
  }, [failure]);
  async function toggle() {
    const v = video.current;
    if (!v || busy) return;
    if (!ready) {
      await start();
      return;
    }
    if (!v.paused) {
      v.pause();
      return;
    }
    setBusy(true);
    try {
      if (backend.current === "PAUSED") {
        await queue.current.run(async () => {
          const result = await api<Playback>(`sessions/${session.current}/resume`, "POST");
          backend.current = "ACTIVE";
          if (result.playback) await load(result.playback, v.currentTime, false);
        });
      }
      await v.play();
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  function paused() {
    setPlaying(false);
    if (
      replacing.current ||
      !session.current ||
      video.current?.ended ||
      backend.current === "COMPLETED" ||
      queue.current.stopped
    )
      return;
    const at = video.current!.currentTime;
    setSync("Guardando pausa…");
    void queue.current
      .run(async () => {
        if (backend.current === "PAUSED") return;
        await api(`sessions/${session.current}/pause`, "POST", {
          positionSeconds: at,
        });
        backend.current = "PAUSED";
        setSync("Pausa y avance guardados");
        cache.invalidateQueries({ queryKey: ["continue-watching"] });
      })
      .catch(failure);
  }
  function ended() {
    setPlaying(false);
    if (timer.current) clearTimeout(timer.current);
    void queue.current
      .run(async () => {
        if (backend.current === "COMPLETED") return;
        await api(`sessions/${session.current}/complete`, "POST");
        backend.current = "COMPLETED";
        setCompleted(true);
        setSync("Historia completada");
        await cache.invalidateQueries({ queryKey: ["history"] });
        await cache.invalidateQueries({ queryKey: ["continue-watching"] });
      })
      .catch(failure);
  }
  async function leave() {
    video.current?.pause();
    save();
    await Promise.race([
      queue.current.run(async () => {}).catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
    router.push(`/title/${tituloId}`);
    router.refresh();
  }
  useEffect(() => {
    const interval = setInterval(() => {
      if (video.current && !video.current.paused) save();
    }, 10000);
    const hide = () => {
      if (!session.current || backend.current === "COMPLETED" || queue.current.stopped) return;
      void fetch(`/api/bff/sessions/${session.current}/progress`, {
        method: "PATCH",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          "X-Nevaro-Request": "1",
        },
        body: JSON.stringify({
          positionSeconds: video.current?.currentTime || 0,
        }),
      }).catch(() => undefined);
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") save();
    };
    window.addEventListener("pagehide", hide);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(interval);
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("pagehide", hide);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [save]);
  return (
    <main className={s.page}>
      <header className={s.header}>
        <button className="button ghost" onClick={leave}>
          <ArrowLeft size={20} />
          Volver a la ficha
        </button>
        <span>{title}</span>
        <span className="eyebrow">NÉVARO</span>
      </header>
      <div className={s.stage} ref={frame}>
        <video
          ref={video}
          playsInline
          preload="metadata"
          controls={false}
          onTimeUpdate={() => setPosition(video.current?.currentTime || 0)}
          onPlay={() => setPlaying(true)}
          onPause={paused}
          onEnded={ended}
          onSeeked={() => {
            if (!replacing.current) save();
          }}
          onWaiting={() => setSync("Cargando el video…")}
          onPlaying={() => setSync("")}
          onError={() => {
            if (!replacing.current && session.current)
              setError("No pudimos continuar el video. Prueba renovar el acceso.");
          }}
        />
        {!ready && (
          <div className={s.cover}>
            <span className="eyebrow">TU HISTORIA TE ESPERA</span>
            <h1>{title}</h1>
            <p>Encuentra tu lugar. La reproducción comienza cuando tú decides.</p>
            <button className="button" onClick={start} disabled={busy}>
              <Play size={19} />
              {busy ? "Preparando video…" : "Preparar reproducción"}
            </button>
          </div>
        )}
        {completed && (
          <div className={s.complete}>
            <h2>Hasta la próxima historia.</h2>
            <div className="actions">
              <button className="button" onClick={start}>
                <RotateCcw size={17} />
                Volver a ver
              </button>
              <button className="button secondary" onClick={leave}>
                Ver la ficha
              </button>
            </div>
          </div>
        )}
      </div>
      {ready && !completed && (
        <div className={s.controls}>
          <label className={s.timeline}>
            <span className="srOnly">Posición de reproducción</span>
            <input
              type="range"
              min={0}
              max={Number.isFinite(duration) ? duration : 0}
              step={1}
              value={position}
              aria-valuetext={`${time(position)} de ${time(duration)}`}
              onChange={(e) => {
                if (video.current) {
                  video.current.currentTime = Number(e.target.value);
                  setPosition(Number(e.target.value));
                }
              }}
            />
          </label>
          <div className={s.controlRow}>
            <button
              className="button ghost"
              onClick={toggle}
              disabled={busy}
              aria-label={playing ? "Pausar" : "Reproducir"}
            >
              {playing ? <Pause size={23} /> : <Play size={23} />}
            </button>
            <button
              className="button ghost"
              onClick={() => {
                if (video.current) {
                  video.current.muted = !muted;
                  setMuted(!muted);
                }
              }}
              aria-label={muted ? "Activar sonido" : "Silenciar"}
            >
              {muted ? <VolumeX size={21} /> : <Volume2 size={21} />}
            </button>
            <input
              aria-label="Volumen"
              className={s.volume}
              type="range"
              min={0}
              max={1}
              step={0.05}
              defaultValue={1}
              onChange={(e) => {
                if (video.current) video.current.volume = Number(e.target.value);
              }}
            />
            <span className={s.time}>
              {time(position)} <span>/ {time(duration)}</span>
            </span>
            <button
              className="button ghost"
              onClick={() => {
                void document.documentElement
                  .requestFullscreen?.()
                  .catch(() => setSync("Usa los controles de pantalla de tu navegador."));
              }}
              aria-label="Pantalla completa"
            >
              <Maximize size={21} />
            </button>
          </div>
        </div>
      )}
      <div className={s.feedback}>
        {error ? (
          <div className="error" role="alert">
            <p>{error}</p>
            <div className="actions">
              <button
                className="button secondary"
                onClick={() =>
                  void renew
                    .current()
                    .then(() => setError(""))
                    .catch(failure)
                }
              >
                Renovar acceso
              </button>
              <button className="button secondary" onClick={start}>
                Abrir un nuevo reproductor
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p role="status">
              {sync || (ready ? "Tu avance se guarda automáticamente cada 10 segundos." : "")}
            </p>
            {sync.includes("No pudimos") && (
              <button className="button secondary" onClick={save}>
                Reintentar guardado
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
