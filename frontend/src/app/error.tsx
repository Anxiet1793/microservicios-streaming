"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="page">
      <h1>No pudimos cargar esta parte.</h1>
      <p className="muted">
        Tu información sigue guardada. Comprueba la conexión y vuelve a intentarlo.
      </p>
      <div className="actions">
        <button className="button" onClick={reset}>
          Reintentar
        </button>
        <Link href="/login" className="button secondary">
          Volver al acceso
        </Link>
      </div>
    </main>
  );
}
