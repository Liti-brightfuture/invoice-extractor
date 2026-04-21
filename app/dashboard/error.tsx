'use client'

import Link from 'next/link'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-sm">
        <p className="text-[15px] font-semibold text-ie-text mb-1">Eroare la încărcare</p>
        <p className="text-[13px] text-ie-muted mb-5">
          {error.message || 'Datele nu au putut fi încărcate. Încearcă din nou.'}
        </p>
        {error.digest && (
          <p className="font-[family-name:var(--font-dm-mono)] text-[11px] text-ie-muted mb-4">
            ID: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={reset}
            className="text-[12.5px] font-medium px-4 py-2 rounded-md border border-ie-border bg-ie-surface text-ie-text hover:bg-ie-bg transition-colors"
          >
            Reîncearcă
          </button>
          <Link
            href="/dashboard"
            className="text-[12.5px] font-medium px-4 py-2 rounded-md bg-ie-accent text-white hover:bg-ie-accent-hover transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
