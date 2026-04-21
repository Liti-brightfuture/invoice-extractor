import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 50

const ACTION_LABELS: Record<string, string> = {
  reprocess: 'Re-procesare AI',
  manual_edit: 'Editare manuală',
  mark_validated: 'Validat manual',
  export_excel: 'Export Excel',
  export_saga: 'Export Saga',
  export_smartbill: 'Export SmartBill',
  export_winmentor: 'Export WinMentor',
}

const ACTION_COLORS: Record<string, string> = {
  reprocess: 'bg-purple-100 text-purple-700',
  manual_edit: 'bg-orange-100 text-orange-700',
  mark_validated: 'bg-green-100 text-green-700',
  export_excel: 'bg-blue-100 text-blue-700',
  export_saga: 'bg-blue-100 text-blue-700',
  export_smartbill: 'bg-blue-100 text-blue-700',
  export_winmentor: 'bg-blue-100 text-blue-700',
}

interface PageProps {
  searchParams: Promise<{
    action?: string
    from?: string
    to?: string
    page?: string
  }>
}

type AuditRow = {
  id: string
  action: string
  created_at: string
  invoice_id: string
  invoices: {
    vendor_name: string | null
    invoice_number: string | null
  } | null
}

export default async function HistoryPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const actionFilter = params.action ?? 'all'
  const from = params.from ?? ''
  const to = params.to ?? ''
  const page = Math.max(1, Number(params.page ?? '1'))
  const fromIdx = (page - 1) * PAGE_SIZE
  const toIdx = fromIdx + PAGE_SIZE - 1

  let query = supabase
    .from('audit_logs')
    .select('id, action, created_at, invoice_id, invoices(vendor_name, invoice_number)', {
      count: 'exact',
    })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(fromIdx, toIdx)

  if (actionFilter !== 'all') query = query.eq('action', actionFilter)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to + 'T23:59:59')

  const { data: logs, count } = await query
  const totalCount = count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const rows = (logs ?? []) as unknown as AuditRow[]

  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams()
    if (actionFilter !== 'all') p.set('action', actionFilter)
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    p.set('page', String(page))
    for (const [k, v] of Object.entries(overrides)) {
      if (v === '') p.delete(k)
      else p.set(k, v)
    }
    const qs = p.toString()
    return `/dashboard/history${qs ? '?' + qs : ''}`
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Istoric activitate</h1>
          <p className="mt-1 text-sm text-gray-500">
            {totalCount} {totalCount === 1 ? 'eveniment' : 'evenimente'} înregistrate
          </p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 mb-6">
        <select
          name="action"
          defaultValue={actionFilter}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Toate acțiunile</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <input
          type="date"
          name="from"
          defaultValue={from}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="De la"
        />
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Până la"
        />

        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          Filtrează
        </button>
        {(actionFilter !== 'all' || from || to) && (
          <Link
            href="/dashboard/history"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Resetează
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-gray-500 text-lg mb-2">Nu există activitate înregistrată.</p>
          <p className="text-gray-400 text-sm">
            Editările, re-procesările și validările manuale apar aici.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Dată</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Acțiune</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Furnizor</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Nr. factură</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((log) => {
                  const label = ACTION_LABELS[log.action] ?? log.action
                  const colorClass = ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-700'
                  const date = new Date(log.created_at).toLocaleString('ro-RO', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  const vendor = log.invoices?.vendor_name ?? '—'
                  const invoiceNumber = log.invoices?.invoice_number ?? '—'

                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">
                        {date}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
                        >
                          {label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[220px] truncate">{vendor}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/invoices/${log.invoice_id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-xs"
                        >
                          {invoiceNumber}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <span>
                Pagina {page} din {totalPages} ({totalCount} evenimente)
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={buildUrl({ page: String(page - 1) })}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50 transition-colors"
                  >
                    ← Anterior
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={buildUrl({ page: String(page + 1) })}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50 transition-colors"
                  >
                    Următor →
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
