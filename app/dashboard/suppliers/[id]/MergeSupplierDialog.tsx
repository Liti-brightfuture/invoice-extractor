'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { mergeSuppliers } from '../actions'

interface OtherSupplier {
  id: string
  cui: string
  name: string | null
}

interface Props {
  currentId: string
  currentName: string | null
  others: OtherSupplier[]
}

export function MergeSupplierDialog({ currentId, currentName, others }: Props) {
  const [open, setOpen] = useState(false)
  const [keepId, setKeepId] = useState<string>('')
  const [pending, startTransition] = useTransition()

  const selectedOther = others.find((o) => o.id === keepId)

  function handleMerge() {
    if (!keepId) return
    startTransition(async () => {
      const { error } = await mergeSuppliers(keepId, currentId)
      if (error) {
        toast.error('Eroare la unificare', { description: error })
      }
      // redirect happens server-side on success
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Unifică cu alt furnizor
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Unifică furnizori</h2>
            <p className="text-sm text-gray-500 mb-4">
              Toate facturile furnizorului{' '}
              <strong>{currentName ?? 'curent'}</strong> vor fi mutate la furnizorul selectat,
              iar furnizorul curent va fi șters. Acțiunea nu poate fi anulată.
            </p>

            {others.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">Nu există alți furnizori disponibili.</p>
            ) : (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Păstrează furnizorul
                </label>
                <select
                  value={keepId}
                  onChange={(e) => setKeepId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Selectează —</option>
                  {others.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name ?? 'Fără nume'} ({o.cui})
                    </option>
                  ))}
                </select>
                {selectedOther && (
                  <p className="mt-2 text-xs text-gray-500">
                    Facturile vor fi atribuite lui <strong>{selectedOther.name ?? selectedOther.cui}</strong>.
                    Furnizorul <strong>{currentName ?? 'curent'}</strong> va fi șters.
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Anulează
              </button>
              <button
                onClick={handleMerge}
                disabled={!keepId || pending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {pending ? 'Se unifică…' : 'Unifică și șterge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
