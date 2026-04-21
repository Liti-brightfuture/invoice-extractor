'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md px-6">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Ceva a mers greșit</h1>
            <p className="text-gray-500 text-sm mb-6">
              A apărut o eroare neașteptată. Încearcă să reîncarci pagina.
            </p>
            {error.digest && (
              <p className="font-mono text-xs text-gray-400 mb-4">ID eroare: {error.digest}</p>
            )}
            <button
              onClick={reset}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
            >
              Încearcă din nou
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
