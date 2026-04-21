'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CheckCircle2, ExternalLink, Link2, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { confirmDuplicate, dismissDuplicate } from './actions'
import type {
  ReconciliationCandidate,
  ReconciliationConfirmedPair,
  ReconciliationInvoicePreview,
} from '@/types/invoice'

interface ReconciliationBoardProps {
  candidates: ReconciliationCandidate[]
  confirmedPairs: ReconciliationConfirmedPair[]
}

type DiffField = ReconciliationCandidate['different_fields'][number]

function FieldRow({
  label,
  value,
  highlighted,
}: {
  label: string
  value: string
  highlighted: boolean
}) {
  return (
    <div className={cn('rounded-md px-2.5 py-2', highlighted ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-muted/40')}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function InvoicePreview({
  invoice,
  differentFields,
}: {
  invoice: ReconciliationInvoicePreview
  differentFields: DiffField[]
}) {
  const totalLabel =
    invoice.total == null
      ? '—'
      : `${invoice.total.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${invoice.currency}`

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{invoice.source === 'xml' ? 'XML SPV' : 'PDF Scanat'}</p>
          <p className="mt-1 text-xs text-muted-foreground">{invoice.file_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/invoices/${invoice.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline"
          >
            <Link2 className="size-3.5" />
            Detalii
          </Link>
          {invoice.signed_url && (
            <a
              href={invoice.signed_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline"
            >
              <ExternalLink className="size-3.5" />
              Original
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <FieldRow label="Furnizor" value={invoice.vendor_name ?? '—'} highlighted={differentFields.includes('vendor_name')} />
        <FieldRow label="CUI" value={invoice.vendor_cui ?? '—'} highlighted={differentFields.includes('vendor_cui')} />
        <FieldRow label="Nr. factură" value={invoice.invoice_number ?? '—'} highlighted={differentFields.includes('invoice_number')} />
        <FieldRow label="Dată" value={invoice.invoice_date ?? '—'} highlighted={differentFields.includes('invoice_date')} />
        <FieldRow label="Total" value={totalLabel} highlighted={differentFields.includes('total')} />
      </div>
    </div>
  )
}

function CandidateCard({ candidate }: { candidate: ReconciliationCandidate }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [action, setAction] = useState<'confirm' | 'dismiss' | null>(null)

  const pdfInvoice = candidate.left.source === 'pdf' ? candidate.left : candidate.right
  const xmlInvoice = candidate.left.source === 'xml' ? candidate.left : candidate.right

  const handleConfirm = () => {
    setAction('confirm')
    startTransition(async () => {
      const result = await confirmDuplicate(pdfInvoice.id, xmlInvoice.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Perechea a fost confirmată și PDF-ul a fost arhivat.')
        router.refresh()
      }
      setAction(null)
    })
  }

  const handleDismiss = () => {
    setAction('dismiss')
    startTransition(async () => {
      const result = await dismissDuplicate(candidate.left.id, candidate.right.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Perechea a fost eliminată din candidați.')
        router.refresh()
      }
      setAction(null)
    })
  }

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle>Candidat {candidate.score}%</CardTitle>
        <CardDescription>
          CUI {candidate.score_breakdown.vendor_cui} • Număr {candidate.score_breakdown.invoice_number} • Total {candidate.score_breakdown.total} • Dată {candidate.score_breakdown.invoice_date}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <InvoicePreview invoice={candidate.left} differentFields={candidate.different_fields} />
          <InvoicePreview invoice={candidate.right} differentFields={candidate.different_fields} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending && action === 'confirm' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Da, e același document
          </Button>
          <Button variant="outline" onClick={handleDismiss} disabled={isPending}>
            {isPending && action === 'dismiss' ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
            Nu, sunt diferite
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ConfirmedCard({ pair }: { pair: ReconciliationConfirmedPair }) {
  return (
    <Card className="border-emerald-200/80">
      <CardHeader>
        <CardTitle>Pereche confirmată</CardTitle>
        <CardDescription>XML-ul este păstrat activ, iar PDF-ul a fost arhivat.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <InvoicePreview invoice={pair.xml_invoice} differentFields={['file_name']} />
          <InvoicePreview invoice={pair.pdf_invoice} differentFields={['file_name']} />
        </div>
      </CardContent>
    </Card>
  )
}

export function ReconciliationBoard({ candidates, confirmedPairs }: ReconciliationBoardProps) {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.5px]">Reconciliere PDF ↔ XML</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Detectează duplicate între scanuri PDF și XML-urile oficiale SPV din ultimele 90 de zile.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.refresh()}>
          <RefreshCw className="size-4" />
          Re-scanează ultimele 90 zile
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Candidați duplicate</h2>
            <p className="text-sm text-muted-foreground">{candidates.length} sugestii automate</p>
          </div>
          {candidates.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-sm text-muted-foreground">
                Nu există candidați noi pentru reconciliere.
              </CardContent>
            </Card>
          ) : (
            candidates.map((candidate) => <CandidateCard key={candidate.pair_key} candidate={candidate} />)
          )}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Potriviri confirmate</h2>
            <p className="text-sm text-muted-foreground">{confirmedPairs.length} perechi legate</p>
          </div>
          {confirmedPairs.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-sm text-muted-foreground">
                Nicio reconciliere confirmată încă.
              </CardContent>
            </Card>
          ) : (
            confirmedPairs.map((pair) => <ConfirmedCard key={pair.pair_key} pair={pair} />)
          )}
        </section>
      </div>
    </div>
  )
}
