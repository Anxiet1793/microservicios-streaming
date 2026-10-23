"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api/client";
import type { User } from "../../lib/models";
export function Profile({ user }: { user: User }) {
  const router = useRouter(),
    query = useQueryClient();
  const [name, setName] = useState(user.profile.displayName),
    [avatar, setAvatar] = useState(user.profile.avatarUrl || ""),
    [language, setLanguage] = useState(user.profile.preferredLanguage),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const dirty =
    name !== user.profile.displayName ||
    avatar !== (user.profile.avatarUrl || "") ||
    language !== user.profile.preferredLanguage;
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a[href]");
      if (link && !window.confirm("Tienes cambios sin guardar. ¿Quieres salir de todos modos?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    try {
      await api("me", "PATCH", {
        displayName: name,
        avatarUrl: avatar || null,
        preferredLanguage: language,
      });
      setMessage("Tu perfil está actualizado.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar.");
    } finally {
      setPending(false);
    }
  }
  async function password(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError("");
    try {
      await api("me/change-password", "POST", Object.fromEntries(form));
      query.clear();
      router.replace("/login");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cambiar tu contraseña.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div style={{ maxWidth: 720 }}>
      <span className="eyebrow">TU ESPACIO</span>
      <h1>Perfil</h1>
      <p className="muted">{user.email}</p>
      <form onSubmit={submit}>
        <label className="field">
          <span>Nombre visible</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
            autoComplete="nickname"
          />
        </label>
        <label className="field">
          <span>Imagen de perfil (URL opcional)</span>
          <input
            type="url"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            maxLength={2048}
          />
        </label>
        <label className="field">
          <span>Idioma preferido</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="es">Español</option>
            <option value="en">Inglés</option>
            <option value="pt">Portugués</option>
            <option value="fr">Francés</option>
          </select>
          <small className="hint">
            Esta preferencia no cambia las pistas de audio disponibles.
          </small>
        </label>
        <button className="button" disabled={pending}>
          {pending ? "Guardando…" : "Guardar perfil"}
        </button>
        {message && (
          <p role="status" className="success">
            {message}
          </p>
        )}
      </form>
      <hr className="divider" />
      <h2>Tus historias</h2>
      <div className="actions">
        <Link href="/continue-watching" className="button secondary">
          Continuar viendo
        </Link>
        <Link href="/history" className="button secondary">
          Historial
        </Link>
        <Link href="/preferences" className="button secondary">
          Tus gustos
        </Link>
        {user.role === "ADMIN" && (
          <Link href="/admin/content" className="button secondary">
            Administrar contenido
          </Link>
        )}
      </div>
      <hr className="divider" />
      <details>
        <summary style={{ cursor: "pointer", padding: "12px 0" }}>Cambiar contraseña</summary>
        <p className="hint">
          Al cambiarla se revocan tus sesiones y tendrás que iniciar sesión de nuevo.
        </p>
        <form onSubmit={password}>
          <label className="field">
            <span>Contraseña actual</span>
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label className="field">
            <span>Nueva contraseña</span>
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <button className="button secondary" disabled={pending}>
            Cambiar contraseña y salir
          </button>
        </form>
      </details>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <hr className="divider" />
    </div>
  );
}
