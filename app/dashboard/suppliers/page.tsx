import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

interface SupplierWithStats {
  id: string
  cui: string
  name: string | null
  anaf_vat_payer: boolean | null
  anaf_active: boolean | null
  invoiceCount: number
  totalSubtotal: number
  lastInvoiceDate: string | null
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ro-RO')
}

function AnafBadge({ vatPayer, active }: { vatPayer: boolean | null; active: boolean | null }) {
  if (vatPayer === null && active === null) {
    return <span className="text-xs text-gray-400">Neverificat</span>
  }
  if (vatPayer) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        Plătitor TVA
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      Neplătitor TVA
    </span>
  )
}

export default async function SuppliersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rows } = await supabase
    .from('suppliers')
    .select('id, cui, name, anaf_vat_payer, anaf_active, invoices(id, subtotal, invoice_date)')
    .eq('user_id', user.id)
    .order('name')

  const suppliers: SupplierWithStats[] = (rows ?? []).map((s) => {
    const invs = (s.invoices ?? []) as { id: string; subtotal: number | null; invoice_date: string | null }[]
    const invoiceCount = invs.length
    const totalSubtotal = invs.reduce((acc, i) => acc + (i.subtotal ?? 0), 0)
    const dates = invs.map((i) => i.invoice_date).filter(Boolean) as string[]
    const lastInvoiceDate = dates.length > 0 ? dates.sort().at(-1)! : null
    return {
      id: s.id,
      cui: s.cui,
      name: s.name,
      anaf_vat_payer: s.anaf_vat_payer,
      anaf_active: s.anaf_active,
      invoiceCount,
      totalSubtotal,
      lastInvoiceDate,
    }
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Furnizori</h1>
        <p className="mt-1 text-sm text-gray-500">
          {suppliers.length} furnizor{suppliers.length !== 1 ? 'i' : ''} distincți
        </p>
      </div>

      {suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-gray-500 text-lg mb-4">Nu există furnizori. Urcă prima factură.</p>
          <Link
            href="/dashboard"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Mergi la Dashboard
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Furnizor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">CUI</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Nr. facturi</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Total RON fără TVA</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status ANAF</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Ultima factură</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/suppliers/${s.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {s.name ?? <span className="italic text-gray-400">Fără nume</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-600">{s.cui}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{s.invoiceCount}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">
                    {formatAmount(s.totalSubtotal)}
                  </td>
                  <td className="px-4 py-3">
                    <AnafBadge vatPayer={s.anaf_vat_payer} active={s.anaf_active} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(s.lastInvoiceDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
