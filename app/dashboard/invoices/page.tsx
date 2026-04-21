import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/dashboard/actions'
import InvoiceFilters from '@/components/dashboard/InvoiceFilters'
import InvoiceTable from '@/components/dashboard/InvoiceListTable'
import { ZipImportButton } from '@/components/dashboard/ZipImportButton'
import type { InvoiceRow, Supplier } from '@/types/invoice'

const PAGE_SIZE = 20

interface PageProps {
  searchParams: Promise<{
    status?: string
    supplier?: string
    from?: string
    to?: string
    q?: string
    page?: string
  }>
}

export default async function InvoicesPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const status = params.status ?? 'all'
  const supplier = params.supplier ?? ''
  const from = params.from ?? ''
  const to = params.to ?? ''
  const q = params.q ?? ''
  const page = Math.max(1, Number(params.page ?? '1'))
  const fromIdx = (page - 1) * PAGE_SIZE
  const toIdx = fromIdx + PAGE_SIZE - 1

  // Paginated invoice query with filters
  let query = supabase
    .from('invoices')
    .select(
      'id, status, vendor_name, vendor_cui, invoice_number, invoice_date, total, currency, created_at, source, linked_invoice_id',
      { count: 'exact' }
    )
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .range(fromIdx, toIdx)

  if (status !== 'all') query = query.eq('status', status)
  if (supplier) query = query.eq('vendor_cui', supplier)
  if (from) query = query.gte('invoice_date', from)
  if (to) query = query.lte('invoice_date', to)
  if (q) query = query.or(`invoice_number.ilike.%${q}%,vendor_name.ilike.%${q}%`)

  const { data: invoices, count } = await query

  // Separate unfiltered supplier query — always shows all suppliers regardless of active filters
  const { data: supplierRows } = await supabase
    .from('invoices')
    .select('vendor_cui, vendor_name')
    .is('archived_at', null)
    .not('vendor_cui', 'is', null)
    .order('vendor_name')

  const supplierMap = new Map<string, string | null>()
  for (const row of supplierRows ?? []) {
    if (row.vendor_cui && !supplierMap.has(row.vendor_cui)) {
      supplierMap.set(row.vendor_cui, row.vendor_name)
    }
  }
  const suppliers: Supplier[] = Array.from(supplierMap.entries()).map(([vendor_cui, vendor_name]) => ({
    vendor_cui,
    vendor_name,
  }))

  const invoiceList = (invoices ?? []) as InvoiceRow[]
  const totalCount = count ?? 0

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-lg font-semibold text-gray-900 hover:opacity-80 transition-opacity">
          InvoiceExtractor
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Dashboard
          </Link>
          <span className="text-sm text-gray-400">{user.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Deconectare
            </button>
          </form>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Facturi</h1>
          <ZipImportButton userId={user.id} />
        </div>

        <InvoiceFilters
          suppliers={suppliers}
          currentStatus={status}
          currentSupplier={supplier}
          currentFrom={from}
          currentTo={to}
          currentQ={q}
        />

        {invoiceList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-muted-foreground text-lg mb-6">
              Încă nu ai facturi. Urcă prima factură.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              Mergi la Dashboard
            </Link>
          </div>
        ) : (
          <InvoiceTable
            invoices={invoiceList}
            count={totalCount}
            page={page}
            pageSize={PAGE_SIZE}
          />
        )}
      </div>
    </main>
  )
}
