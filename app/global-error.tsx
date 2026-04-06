'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body style={{ background: '#F7F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0 }}>
        <div style={{ textAlign: 'center', color: '#111827' }}>
          <p style={{ marginBottom: '16px', opacity: 0.5 }}>Algo salió mal</p>
          <button
            onClick={reset}
            style={{ padding: '8px 20px', background: '#c9a84c', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
