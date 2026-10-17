import Link from "next/link";
export default function NotFound() {
  return (
    <main className="page">
      <h1>No encontramos ese contenido.</h1>
      <p className="muted">
        Puedes encontrar tu próxima historia en el catálogo.
      </p>
      <Link href="/explore" className="button">
        Explorar
      </Link>
    </main>
  );
}
