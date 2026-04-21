'use client'

import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Pagina nu a putut fi încărcată</h1>
        <p className="text-gray-500 text-sm mb-6">
          {error.message || 'A apărut o eroare neașteptată.'}
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-gray-400 mb-4">ID eroare: {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Încearcă din nou
          </button>
          <Link
            href="/"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            Acasă
          </Link>
        </div>
      </div>
    </div>
  )
}
