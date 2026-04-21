import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { EditSupplierForm } from './EditSupplierForm'
import { MergeSupplierDialog } from './MergeSupplierDialog'
import { RevalidateAnafButton } from './RevalidateAnafButton'

interface PageProps {
  params: Promise<{ id: string }>
}

function formatAmount(v: number | null) {
  if (v === null) return '—'
  return new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ro-RO')
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    validated: { label: 'Validată', cls: 'bg-green-100 text-green-700' },
    review: { label: 'Revizuire', cls: 'bg-yellow-100 text-yellow-700' },
    processing: { label: 'Procesare', cls: 'bg-blue-100 text-blue-600' },
    error: { label: 'Eroare', cls: 'bg-red-100 text-red-600' },
  }
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}

export default async function SupplierDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch supplier
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, cui, name, address, anaf_vat_payer, anaf_active, anaf_last_check, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!supplier) notFound()

  // Fetch invoices for this supplier
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, invoice_date, subtotal, vat_amount, total, status, currency')
    .eq('supplier_id', id)
    .eq('user_id', user.id)
    .order('invoice_date', { ascending: false })

  // Fetch other suppliers for merge dialog
  const { data: allSuppliers } = await supabase
    .from('suppliers')
    .select('id, cui, name')
    .eq('user_id', user.id)
    .neq('id', id)
    .order('name')

  const others = (allSuppliers ?? []).map((s) => ({
    id: s.id,
    cui: s.cui,
    name: s.name,
  }))

  const invoiceList = invoices ?? []
  const totalSubtotal = invoiceList.reduce((acc, i) => acc + (i.subtotal ?? 0), 0)

  return (
    <div className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <Link
        href="/dashboard/suppliers"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-6"
      >
        <ChevronLeft size={14} />
        Furnizori
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{supplier.name ?? 'Furnizor fără nume'}</h1>
          <p className="text-sm text-gray-500 font-mono mt-0.5">CUI: {supplier.cui}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <RevalidateAnafButton supplierId={supplier.id} />
          <MergeSupplierDialog
            currentId={supplier.id}
            currentName={supplier.name}
            others={others}
          />
        </div>
      </div>

      {/* Status ANAF */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Status ANAF</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Plătitor TVA</span>
            <div className="mt-0.5 font-medium">
              {supplier.anaf_vat_payer === null
                ? '—'
                : supplier.anaf_vat_payer
                ? 'Da'
                : 'Nu'}
            </div>
          </div>
          <div>
            <span className="text-gray-500">Stare înregistrare</span>
            <div className="mt-0.5 font-medium">
              {supplier.anaf_active === null ? '—' : supplier.anaf_active ? 'Activ' : 'Inactiv'}
            </div>
          </div>
          <div>
            <span className="text-gray-500">Ultima verificare ANAF</span>
            <div className="mt-0.5 font-medium">
              {supplier.anaf_last_check
                ? new Date(supplier.anaf_last_check).toLocaleString('ro-RO')
                : 'Neverificat'}
            </div>
          </div>
        </div>
      </div>

      {/* Date editabile */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Date furnizor</h2>
        <EditSupplierForm
          supplierId={supplier.id}
          initialName={supplier.name}
          initialAddress={supplier.address}
        />
      </div>

      {/* Facturi */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Facturi ({invoiceList.length})
          </h2>
          <span className="text-sm text-gray-500">
            Total fără TVA:{' '}
            <span className="font-mono font-medium text-gray-900">{formatAmount(totalSubtotal)} RON</span>
          </span>
        </div>

        {invoiceList.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            Nicio factură asociată acestui furnizor.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Nr. factură</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Dată</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Subtotal</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">TVA</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoiceList.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/invoices/${inv.id}`}
                      className="font-mono text-blue-600 hover:underline"
                    >
                      {inv.invoice_number ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(inv.invoice_date)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    {formatAmount(inv.subtotal)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    {formatAmount(inv.vat_amount)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">
                    {formatAmount(inv.total)} {inv.currency ?? 'RON'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
