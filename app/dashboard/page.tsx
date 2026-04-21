import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatCard } from '@/components/dashboard/StatCard'
import { UploadZone } from '@/components/dashboard/UploadZone'
import { InvoiceTable } from '@/components/dashboard/InvoiceTable'
import { UsageLimitBar } from '@/components/dashboard/UsageLimitBar'
import { signOut } from './actions'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [{ data: invoices }, { count: monthlyUsed }] = await Promise.all([
    supabase
      .from('invoices')
      .select(
        'id, vendor_name, vendor_cui, invoice_number, invoice_date, total, vat_amount, confidence_score, status, currency'
      )
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['validated', 'review'])
      .gte('created_at', startOfMonth),
  ])

  const processed = (invoices ?? []).filter((i) => i.status === 'validated' || i.status === 'review')
  const avgConfidence =
    processed.length > 0
      ? Math.round(processed.reduce((s, i) => s + (i.confidence_score ?? 0), 0) / processed.length)
      : 0
  const totalRon = processed
    .filter((i) => (i.currency ?? 'RON') === 'RON')
    .reduce((s, i) => s + Number(i.total ?? 0), 0)
  const needsReview = (invoices ?? []).filter((i) => i.status === 'review').length

  return (
    <>
      {/* Page header */}
      <div className="mb-7 flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.5px] mb-1">Dashboard</h1>
          <p className="text-[14px] text-ie-muted">
            Facturi procesate această lună — Aprilie 2026
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="text-[12.5px] text-ie-muted hover:text-ie-text transition-colors px-3 py-1.5 rounded border border-ie-border bg-ie-surface"
          >
            Deconectare
          </button>
        </form>
      </div>

      {/* Upload zone */}
      <div className="mb-7">
        <UploadZone userId={user.id} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <StatCard label="Procesate" value={String(processed.length)} sub="facturi extrase" />
        <StatCard label="Acuratețe medie" value={processed.length ? `${avgConfidence}%` : '—'} sub="confidence score" accent />
        <StatCard label="Total facturat" value={totalRon >= 1000 ? `${(totalRon / 1000).toFixed(1)}k` : String(Math.round(totalRon))} sub="RON extras automat" />
        <StatCard label="Review necesar" value={String(needsReview)} sub="facturi cu erori" />
      </div>

      {/* Invoice table */}
      <InvoiceTable invoices={invoices ?? []} />

      {/* Usage bar */}
      <UsageLimitBar used={monthlyUsed ?? 0} total={20} />
    </>
  )
}
