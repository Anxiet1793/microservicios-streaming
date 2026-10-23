"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Compass, Bookmark, UserRound, Search, LogOut, ArrowUpRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Brand } from "./ui";
import { api } from "../lib/api/client";
import type { User } from "../lib/models";
import s from "./shell.module.css";
const nav = [
  { href: "/home", label: "Inicio", Icon: Home },
  { href: "/explore", label: "Explorar", Icon: Compass },
  { href: "/my-list", label: "Mi Lista", Icon: Bookmark },
  { href: "/profile", label: "Perfil", Icon: UserRound },
];
export function Shell({
  user,
  children,
  admin = false,
}: {
  user: User;
  children: React.ReactNode;
  admin?: boolean;
}) {
  const path = usePathname(),
    router = useRouter(),
    query = useQueryClient();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function leave() {
    setPending(true);
    try {
      const result = await api<{ revoked: boolean }>("auth/logout", "POST");
      query.clear();
      router.replace(result.revoked ? "/login" : "/login?logout=local");
      router.refresh();
    } catch {
      setError("No pudimos cerrar tu sesión. Inténtalo otra vez.");
      setPending(false);
    }
  }
  return (
    <>
      <a className="skip" href="#main">
        Saltar al contenido
      </a>
      <header className={s.header}>
        <Brand />
        <nav aria-label="Principal" className={s.desktop}>
          {nav.slice(0, 3).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={path === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action="/search" className={s.search}>
          <Search size={17} />
          <label className="srOnly" htmlFor="global-search">
            Buscar títulos
          </label>
          <input id="global-search" name="q" maxLength={100} placeholder="Buscar una historia" />
        </form>
        <Link href="/profile" className={s.account}>
          <span className={s.avatar}>{user.profile.displayName.slice(0, 1).toUpperCase()}</span>
          <span>{user.profile.displayName}</span>
        </Link>
      </header>
      <div className={admin ? s.adminLayout : ""}>
        {admin && (
          <aside className={s.sidebar}>
            <span className="eyebrow">ESTUDIO NÉVARO</span>
            <h2>Administración</h2>
            <Link href="/admin/content">Contenido</Link>
            <Link href="/admin/upload">Subir video</Link>
            <Link href="/home">
              Volver a Inicio <ArrowUpRight size={16} />
            </Link>
          </aside>
        )}
        <main id="main" className={admin ? s.adminMain : "page"}>
          {children}
          {error && <p role="alert">{error}</p>}
          {path === "/profile" && (
            <button className="button secondary" onClick={leave} disabled={pending}>
              <LogOut size={17} />
              {pending ? "Cerrando sesión…" : "Cerrar sesión"}
            </button>
          )}
        </main>
      </div>
      <footer className={s.footer}>
        <span>NÉVARO</span>
        <span>Tu próxima historia empieza aquí.</span>
        <span>Un proyecto de streaming académico.</span>
      </footer>
      <nav aria-label="Navegación móvil" className={s.bottom}>
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={path === item.href ? "page" : undefined}
          >
            <item.Icon size={20} />
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
