import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { FileText, Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { classifyLegacyErrorString } from '@/lib/error-classifier'
import { ExtractionTrigger } from './ExtractionTrigger'
import { AnafValidateButton } from './AnafValidateButton'
import { MarkValidatedButton } from './MarkValidatedButton'
import { ReprocessButton } from './ReprocessButton'
import { EditInvoiceForm } from './EditInvoiceForm'
import { DeleteButton } from './DeleteButton'
import { AuditLog } from './AuditLog'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function InvoicePage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: invoice } = await supabase
    .from('invoices')
    .select(
      'id, file_name, file_path, status, source, linked_invoice_id, archived_at, archived_reason, created_at, vendor_name, vendor_cui, vendor_address, invoice_number, invoice_date, due_date, currency, subtotal, vat_amount, total, confidence_score, processing_time_ms, anaf_validated, anaf_active, anaf_vat_payer, anaf_validated_at, ai_raw_response, reprocess_count, exported_at, error_code, error_message'
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!invoice) notFound()

  const { data: invoiceLines } = await supabase
    .from('invoice_lines')
    .select('*')
    .eq('invoice_id', id)
    .order('line_number')

  const { data: linkedInvoice } = invoice.linked_invoice_id
    ? await supabase
        .from('invoices')
        .select('id, file_name, source')
        .eq('id', invoice.linked_invoice_id)
        .eq('user_id', user.id)
        .single()
    : { data: null }

  const uploadedAt = new Date(invoice.created_at).toLocaleString('ro-RO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const isActionable =
    invoice.status === 'validated' || invoice.status === 'review' || invoice.status === 'error'

  return (
    <div className="max-w-2xl mx-auto py-8">
      {/* Trigger extragere + polling (doar dacă status=processing) */}
      <ExtractionTrigger invoiceId={invoice.id} status={invoice.status} />

      {invoice.archived_at && invoice.archived_reason === 'duplicate_pdf_kept_xml' && (
        <div className="mb-6 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-800">
          PDF-ul a fost arhivat deoarece a fost reconciliat cu XML-ul oficial.
          {linkedInvoice && (
            <a href={`/dashboard/invoices/${linkedInvoice.id}`} className="ml-2 font-semibold hover:underline">
              Vezi XML-ul păstrat
            </a>
          )}
        </div>
      )}

      {invoice.linked_invoice_id && linkedInvoice && !invoice.archived_at && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
          Factura este legată de documentul {linkedInvoice.source === 'xml' ? 'XML oficial' : 'PDF asociat'}.
          <a href={`/dashboard/invoices/${linkedInvoice.id}`} className="ml-2 font-semibold hover:underline">
            Deschide factura legată
          </a>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.5px] mb-1">Factură</h1>
        <p className="text-[14px] text-ie-muted flex items-center gap-2">
          <Clock size={13} />
          {uploadedAt}
        </p>
      </div>

      {/* ── ACTION BAR ── */}
      {isActionable && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <ReprocessButton
            invoiceId={invoice.id}
            reprocessCount={invoice.reprocess_count ?? 0}
          />
          <DeleteButton
            invoiceId={invoice.id}
            exportedAt={invoice.exported_at ?? null}
          />
        </div>
      )}

      {/* ── PROCESSING ── */}
      {invoice.status === 'processing' && (
        <div className="bg-ie-surface border border-ie-border rounded-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 relative">
            <div className="absolute inset-0 rounded-full border-4 border-ie-border" />
            <div className="absolute inset-0 rounded-full border-4 border-t-ie-accent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <FileText size={20} className="text-ie-muted" />
            </div>
          </div>
          <h2 className="text-[16px] font-semibold mb-1">Se procesează...</h2>
          <p className="text-[13px] text-ie-muted mb-6">
            AI-ul extrage datele din factură. Durează de obicei 10–30 secunde.
          </p>
          <FileInfoChip name={invoice.file_name} />
        </div>
      )}

      {/* ── VALIDATED / REVIEW ── */}
      {(invoice.status === 'validated' || invoice.status === 'review') && (
        <div className="space-y-4">
          {/* Status banner */}
          {invoice.status === 'review' && (
            <div className="flex flex-col gap-2 bg-ie-yellow-light border border-ie-yellow/30 rounded-lg px-4 py-3">
              <div className="flex items-start gap-3">
                <AlertTriangle size={15} className="text-ie-yellow mt-0.5 shrink-0" />
                <p className="text-[13px] text-ie-yellow">
                  Unele câmpuri necesită verificare manuală. Confidence score:{' '}
                  <span className="font-semibold">{invoice.confidence_score ?? '—'}%</span>
                </p>
              </div>
              {(() => {
                const raw = invoice.ai_raw_response as any
                const fieldIssues: Array<{ camp: string; problema: string; gravitate: string }> | undefined =
                  Array.isArray(raw?.field_issues) ? raw.field_issues : undefined

                if (fieldIssues && fieldIssues.length > 0) {
                  return (
                    <div className="ml-8 flex flex-col gap-1">
                      {fieldIssues.map((issue, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 text-[12px] bg-white/40 rounded px-2 py-1.5 border border-ie-yellow/10"
                        >
                          <span className="font-semibold text-ie-yellow/90 shrink-0">{issue.camp.charAt(0).toUpperCase() + issue.camp.slice(1)}:</span>
                          <span className="text-ie-yellow/80 flex-1">{issue.problema}</span>
                          <span
                            className={
                              issue.gravitate === 'ridicata'
                                ? 'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700'
                                : issue.gravitate === 'medie'
                                  ? 'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-orange-100 text-orange-700'
                                  : 'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-yellow-100 text-yellow-700'
                            }
                          >
                            {issue.gravitate === 'ridicata' ? 'ridicată' : issue.gravitate === 'medie' ? 'medie' : 'scăzută'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                }

                if (raw?.confidence_notes) {
                  return (
                    <p className="text-[12px] text-ie-yellow/80 bg-white/40 rounded px-2 py-1.5 ml-8 border border-ie-yellow/10">
                      <span className="font-medium">Note AI:</span>{' '}
                      {raw.confidence_notes}
                    </p>
                  )
                }

                return null
              })()}
            </div>
          )}
          {invoice.status === 'validated' && (
            <div className="flex items-center gap-3 bg-ie-green-light border border-ie-green/20 rounded-lg px-4 py-3">
              <CheckCircle2 size={15} className="text-ie-green shrink-0" />
              {invoice.source === 'xml' ? (
                <>
                  <p className="text-[13px] text-ie-green">
                    Factură XML e-Factura importată. <span className="font-semibold">Confidence: 100%</span>
                  </p>
                  <span className="ml-auto inline-flex shrink-0 rounded-full bg-emerald-100 px-[9px] py-[3px] text-[11.5px] font-medium text-emerald-700">
                    XML e-Factura
                  </span>
                </>
              ) : (
                <p className="text-[13px] text-ie-green">
                  Factură extrasă cu succes. Confidence:{' '}
                  <span className="font-semibold">{invoice.confidence_score ?? '—'}%</span>
                </p>
              )}
            </div>
          )}

          {/* Editable invoice form (handles both view + edit mode) */}
          <EditInvoiceForm
            invoice={{
              id: invoice.id,
              status: invoice.status,
              vendor_name: invoice.vendor_name,
              vendor_cui: invoice.vendor_cui,
              vendor_address: invoice.vendor_address,
              invoice_number: invoice.invoice_number,
              invoice_date: invoice.invoice_date,
              due_date: invoice.due_date,
              subtotal: invoice.subtotal,
              vat_amount: invoice.vat_amount,
              total: invoice.total,
              currency: invoice.currency,
            }}
            invoiceLines={invoiceLines ?? []}
          />

          {/* Validare ANAF */}
          {invoice.vendor_cui && (
            <AnafValidateButton
              invoiceId={invoice.id}
              vendorCui={invoice.vendor_cui}
              anafValidated={invoice.anaf_validated ?? false}
              anafActive={invoice.anaf_active}
              anafVatPayer={invoice.anaf_vat_payer}
              anafValidatedAt={invoice.anaf_validated_at}
            />
          )}

          {/* Manual Validation Button */}
          {invoice.status === 'review' && <MarkValidatedButton invoiceId={invoice.id} />}

          {/* Meta */}
          {invoice.processing_time_ms && (
            <p className="text-[12px] text-ie-muted text-right">
              Procesat în {(invoice.processing_time_ms / 1000).toFixed(1)}s
            </p>
          )}

          {/* Audit log */}
          <AuditLog invoiceId={invoice.id} />
        </div>
      )}

      {/* ── ERROR ── */}
      {invoice.status === 'error' && (
        <div className="space-y-4">
          <div className="bg-ie-surface border border-ie-border rounded-xl p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-5 flex items-center justify-center rounded-full bg-red-50 border border-red-200">
              <XCircle size={24} className="text-red-500" />
            </div>
            <h2 className="text-[16px] font-semibold mb-2">Extragere eșuată</h2>
            <p className="text-[13px] text-red-700 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5 mb-6 inline-block">
              {invoice.error_message ??
                classifyLegacyErrorString(
                  (invoice.ai_raw_response as Record<string, unknown> | null)
                    ?.error as string | null
                ).error_message}
            </p>
            <FileInfoChip name={invoice.file_name} />
          </div>
          <AuditLog invoiceId={invoice.id} />
        </div>
      )}

      <div className="mt-6 text-center">
        <a
          href="/dashboard"
          className="text-[13px] text-ie-muted hover:text-ie-text transition-colors"
        >
          ← Înapoi la dashboard
        </a>
      </div>
    </div>
  )
}

// ── Subcomponente ──────────────────────────────────────────────────────────────

function FileInfoChip({ name }: { name: string }) {
  return (
    <div className="inline-flex items-center gap-3 bg-ie-bg border border-ie-border rounded-lg px-4 py-3 text-left">
      <FileText size={16} className="text-ie-accent shrink-0" />
      <p className="text-[13px] font-medium text-ie-text truncate max-w-[280px]">{name}</p>
    </div>
  )
}
