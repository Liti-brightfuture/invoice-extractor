import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { XCircle, RefreshCw, FileText } from 'lucide-react'
import Link from 'next/link'
import { classifyLegacyErrorString } from '@/lib/error-classifier'
import { retryFailedInvoice } from './actions'

const PAGE_SIZE = 20

interface PageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function FailedInvoicesPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? '1'))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data: invoices, count } = await supabase
    .from('invoices')
    .select(
      'id, file_name, created_at, error_code, error_message, ai_raw_response, reprocess_count',
      { count: 'exact' }
    )
    .eq('user_id', user.id)
    .eq('status', 'error')
    .order('created_at', { ascending: false })
    .range(from, to)

  const rows = invoices ?? []
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.5px] mb-1 flex items-center gap-2">
          <XCircle size={20} className="text-red-500" />
          Facturi cu erori
        </h1>
        <p className="text-[13.5px] text-ie-muted">
          {count ?? 0}{' '}
          {(count ?? 0) === 1 ? 'factură cu eroare de procesare' : 'facturi cu erori de procesare'}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-ie-surface border border-ie-border rounded-xl p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center rounded-full bg-green-50 border border-green-200">
            <XCircle size={20} className="text-green-500" />
          </div>
          <p className="text-[14px] font-medium text-ie-text mb-1">Nicio eroare</p>
          <p className="text-[13px] text-ie-muted">Toate facturile au fost procesate cu succes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((invoice) => {
            // error_message from new column takes priority; fall back to classifying
            // the legacy ai_raw_response.error string for rows that errored before migration 010.
            const displayMessage =
              invoice.error_message ??
              classifyLegacyErrorString(
                (invoice.ai_raw_response as Record<string, unknown> | null)
                  ?.error as string | null
              ).error_message

            const remaining = 3 - (invoice.reprocess_count ?? 0)
            const canRetry = remaining > 0

            const uploadedAt = new Date(invoice.created_at).toLocaleString('ro-RO', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div
                key={invoice.id}
                className="flex items-start gap-4 bg-ie-surface border border-ie-border rounded-xl px-5 py-4"
              >
                <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <FileText size={13} className="text-ie-muted shrink-0" />
                    <p className="text-[13.5px] font-medium text-ie-text truncate">
                      {invoice.file_name}
                    </p>
                  </div>
                  <p className="text-[12px] text-ie-muted mb-2">{uploadedAt}</p>
                  <p className="text-[12.5px] text-red-700 bg-red-50 border border-red-100 rounded-md px-2.5 py-1.5">
                    {displayMessage}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
                  <Link
                    href={`/dashboard/invoices/${invoice.id}`}
                    className="text-[12px] text-ie-muted hover:text-ie-text transition-colors"
                  >
                    Detalii →
                  </Link>
                  <form action={retryFailedInvoice}>
                    <input type="hidden" name="invoiceId" value={invoice.id} />
                    <button
                      type="submit"
                      disabled={!canRetry}
                      title={
                        !canRetry
                          ? 'Limita de 3 re-procesări a fost atinsă'
                          : `${remaining} încercări rămase`
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium bg-ie-accent text-white rounded-lg hover:bg-ie-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <RefreshCw size={11} />
                      Reîncearcă
                      {canRetry && (
                        <span className="text-[11px] opacity-70">({remaining})</span>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          {page > 1 && (
            <Link
              href={`?page=${page - 1}`}
              className="px-3 py-1.5 text-[13px] border border-ie-border rounded-lg hover:bg-ie-bg transition-colors"
            >
              ← Anterior
            </Link>
          )}
          <span className="text-[13px] text-ie-muted">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`?page=${page + 1}`}
              className="px-3 py-1.5 text-[13px] border border-ie-border rounded-lg hover:bg-ie-bg transition-colors"
            >
              Următor →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
