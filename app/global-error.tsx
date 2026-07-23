"use client";

// Captura errores del propio root layout. Reemplaza <html>, así que se
// mantiene mínimo y autocontenido (sin depender de providers ni tokens).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, system-ui, sans-serif",
          background: "#0A1628",
          color: "#F1F5F9",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Error del sistema</h1>
        <p style={{ maxWidth: 360, color: "#94A3B8", fontSize: 14, marginTop: 8 }}>
          No pudimos cargar la aplicación. Reintenta en un momento.
        </p>
        {error.digest && (
          <p style={{ fontFamily: "monospace", fontSize: 11, color: "#64748B", marginTop: 8 }}>Ref: {error.digest}</p>
        )}
        <button
          onClick={() => reset()}
          style={{
            marginTop: 24, padding: "10px 20px", borderRadius: 12, border: "none",
            background: "#0066CC", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
