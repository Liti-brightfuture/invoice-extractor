'use client'

import { useState, useTransition } from 'react'
import { Trash2, Loader2, X, AlertTriangle } from 'lucide-react'
import { deleteInvoice } from './actions'

interface Props {
  invoiceId: string
  exportedAt: string | null
}

export function DeleteButton({ invoiceId, exportedAt }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isExported = exportedAt != null

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      try {
        await deleteInvoice(invoiceId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Eroare la ștergere')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={isExported}
        title={isExported ? 'Factura a fost exportată și nu poate fi ștearsă' : undefined}
        className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Trash2 size={14} />
        Șterge
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm border border-ie-border">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ie-border">
              <h2 className="text-[15px] font-semibold text-red-600">Șterge factura</h2>
              <button onClick={() => setOpen(false)} className="text-ie-muted hover:text-ie-text">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-5">
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
                <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-[13px] text-red-700">
                  Această acțiune este <strong>ireversibilă</strong>. Fișierul și toate datele asociate vor fi șterse permanent.
                </p>
              </div>

              {error && (
                <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-ie-border">
              <button
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-[13px] text-ie-muted hover:text-ie-text transition-colors"
              >
                Anulează
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Se șterge...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Șterge definitiv
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
