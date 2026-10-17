export default function Loading() {
  return (
    <div aria-busy="true">
      <span className="srOnly">Cargando tus historias…</span>
      <div className="skeleton" style={{ height: 360 }} />
      <div className="skeleton" style={{ marginTop: 32 }} />
    </div>
  );
}
