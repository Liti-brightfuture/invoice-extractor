'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { validateCui, type AnafResult } from '@/app/actions/anaf'
import { CheckCircle2, XCircle, ShieldCheck, Loader2 } from 'lucide-react'

interface Props {
  invoiceId: string
  vendorCui: string | null | undefined
  anafValidated: boolean
  anafActive: boolean | null | undefined
  anafVatPayer: boolean | null | undefined
  anafValidatedAt: string | null | undefined
}

export function AnafValidateButton({
  invoiceId,
  vendorCui,
  anafValidated,
  anafActive,
  anafVatPayer,
  anafValidatedAt,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<AnafResult | null>(null)
  const router = useRouter()

  if (!vendorCui) return null

  const handleValidate = () => {
    startTransition(async () => {
      const res = await validateCui(invoiceId)
      setResult(res)
      if (res.success) router.refresh()
    })
  }

  const hasValidation = anafValidated && !result
  const showResult = result

  return (
    <div className="bg-ie-surface border border-ie-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-ie-border bg-ie-bg flex items-center justify-between">
        <p className="font-[family-name:var(--font-dm-mono)] text-[10.5px] text-ie-muted uppercase tracking-[0.6px]">
          Validare ANAF
        </p>
        <button
          onClick={handleValidate}
          disabled={isPending}
          className="flex items-center gap-1.5 text-[12px] font-medium text-ie-accent hover:text-ie-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Se verifică...
            </>
          ) : hasValidation || result?.success ? (
            'Re-validează'
          ) : (
            <>
              <ShieldCheck size={12} />
              Validează CUI
            </>
          )}
        </button>
      </div>

      {/* Rezultat proaspăt */}
      {showResult && (
        <div className="divide-y divide-ie-border">
          {result.success ? (
            <>
              {result.denumire && <AnafRow label="Denumire ANAF" value={result.denumire} />}
              {result.adresa && <AnafRow label="Adresă ANAF" value={result.adresa} />}
              {result.nrRegCom && <AnafRow label="Reg. Com." value={result.nrRegCom} mono />}
              <StatusRow
                label="Stare"
                active={result.stare?.toUpperCase().includes('ACTIVA') ?? false}
                activeLabel="Activ"
                inactiveLabel="Inactiv"
              />
              <StatusRow
                label="TVA"
                active={result.scpTVA ?? false}
                activeLabel="Plătitor TVA"
                inactiveLabel="Neplătitor TVA"
                neutralWhenInactive
              />
              {result.data_inceput_ScpTVA && (
                <AnafRow label="TVA din" value={result.data_inceput_ScpTVA} />
              )}
            </>
          ) : (
            <div className="px-5 py-4">
              <p className="text-[13px] text-red-600">{result.error}</p>
            </div>
          )}
        </div>
      )}

      {/* Status din DB (validat anterior, fără rezultat proaspăt) */}
      {hasValidation && (
        <div className="divide-y divide-ie-border">
          <StatusRow
            label="Stare"
            active={anafActive ?? false}
            activeLabel="Activ"
            inactiveLabel="Inactiv"
          />
          <StatusRow
            label="TVA"
            active={anafVatPayer ?? false}
            activeLabel="Plătitor TVA"
            inactiveLabel="Neplătitor TVA"
            neutralWhenInactive
          />
          {anafValidatedAt && (
            <AnafRow
              label="Validat la"
              value={new Date(anafValidatedAt).toLocaleString('ro-RO', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
          )}
        </div>
      )}

      {/* Nevalidat încă */}
      {!anafValidated && !result && (
        <div className="px-5 py-4">
          <p className="text-[13px] text-ie-muted">
            CUI:{' '}
            <span className="font-[family-name:var(--font-dm-mono)] text-ie-text">{vendorCui}</span>{' '}
            — nevalidat
          </p>
        </div>
      )}
    </div>
  )
}

function AnafRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between px-5 py-3 gap-4">
      <span className="text-[13px] text-ie-muted shrink-0">{label}</span>
      <span
        className={[
          'text-[13px] text-ie-text text-right',
          mono ? 'font-[family-name:var(--font-dm-mono)]' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {value}
      </span>
    </div>
  )
}

function StatusRow({
  label,
  active,
  activeLabel,
  inactiveLabel,
  neutralWhenInactive = false,
}: {
  label: string
  active: boolean
  activeLabel: string
  inactiveLabel: string
  neutralWhenInactive?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3 gap-4">
      <span className="text-[13px] text-ie-muted shrink-0">{label}</span>
      <span
        className={[
          'inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-0.5 rounded-full',
          active
            ? 'bg-ie-green-light text-ie-green'
            : neutralWhenInactive
              ? 'bg-ie-border text-ie-muted'
              : 'bg-red-50 text-red-600',
        ].join(' ')}
      >
        {active ? (
          <>
            <CheckCircle2 size={11} />
            {activeLabel}
          </>
        ) : (
          <>
            {!neutralWhenInactive && <XCircle size={11} />}
            {inactiveLabel}
          </>
        )}
      </span>
    </div>
  )
}
