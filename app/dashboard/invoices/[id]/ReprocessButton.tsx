'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Loader2, X } from 'lucide-react'
import { reprocessInvoice } from './actions'

type ReprocessMode = 'simple' | 'context'

interface Props {
  invoiceId: string
  reprocessCount: number
}

export function ReprocessButton({ invoiceId, reprocessCount }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<ReprocessMode>('simple')
  const [context, setContext] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const remaining = 3 - reprocessCount
  const disabled = reprocessCount >= 3

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      try {
        await reprocessInvoice(invoiceId, {
          model: 'gpt-4o-mini',
          additionalContext: mode === 'context' ? context : undefined,
        })
        setOpen(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Eroare necunoscută')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? 'Limită 3 re-procesări atinsă' : undefined}
        className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium bg-ie-surface border border-ie-border rounded-lg hover:bg-ie-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <RefreshCw size={14} />
        Re-procesează
        {!disabled && (
          <span className="text-[11px] text-ie-muted ml-0.5">({remaining} rămasă{remaining !== 1 ? 'e' : ''})</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-ie-border">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ie-border">
              <h2 className="text-[15px] font-semibold">Re-procesează factura</h2>
              <button onClick={() => setOpen(false)} className="text-ie-muted hover:text-ie-text">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <ModeOption
                id="simple"
                value="simple"
                selected={mode}
                onSelect={setMode}
                label="Re-rulează extragerea"
                description="AI-ul va analiza din nou fișierul original"
              />
              <ModeOption
                id="context"
                value="context"
                selected={mode}
                onSelect={setMode}
                label="Rulează cu context suplimentar"
                description="Oferă un hint pentru a corecta ce a greșit"
              />

              {mode === 'context' && (
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder='Ex: "CUI-ul corect începe cu 14" sau "Suma totală este 1.250 RON"'
                  rows={3}
                  className="w-full mt-1 px-3 py-2 text-[13px] border border-ie-border rounded-lg bg-ie-bg resize-none focus:outline-none focus:ring-2 focus:ring-ie-accent/30 focus:border-ie-accent"
                />
              )}

              {error && (
                <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
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
                onClick={handleSubmit}
                disabled={isPending || (mode === 'context' && !context.trim())}
                className="flex items-center gap-2 px-4 py-2 bg-ie-accent hover:bg-ie-accent-hover text-white text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Se procesează...
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    Re-procesează
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

function ModeOption({
  id,
  value,
  selected,
  onSelect,
  label,
  description,
}: {
  id: string
  value: ReprocessMode
  selected: ReprocessMode
  onSelect: (v: ReprocessMode) => void
  label: string
  description: string
}) {
  const isSelected = selected === value
  return (
    <label
      htmlFor={id}
      className={[
        'flex items-start gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors',
        isSelected
          ? 'border-ie-accent bg-ie-accent/5'
          : 'border-ie-border bg-ie-bg hover:border-ie-accent/40',
      ].join(' ')}
    >
      <input
        type="radio"
        id={id}
        name="reprocess-mode"
        value={value}
        checked={isSelected}
        onChange={() => onSelect(value)}
        className="mt-0.5 accent-ie-accent"
      />
      <div className="flex-1 min-w-0">
        <span className="text-[13px] font-medium text-ie-text">{label}</span>
        <p className="text-[12px] text-ie-muted mt-0.5">{description}</p>
      </div>
    </label>
  )
}
