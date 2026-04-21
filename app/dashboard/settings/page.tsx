import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsTabs } from './SettingsTabs'

export const metadata = { title: 'Setări — InvoiceExtractor' }

// ─── Helpers ─────────────────────────────────────────────────

function startOf6MonthsAgo(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 5)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function buildMonthlyHistory(
  rows: { created_at: string }[],
  months: number
): { month: string; label: string; count: number }[] {
  const now = new Date()
  const result: { month: string; label: string; count: number }[] = []

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('ro-RO', { month: 'short', year: 'numeric' })
    result.push({ month: key, label, count: 0 })
  }

  for (const row of rows) {
    const d = new Date(row.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const entry = result.find((r) => r.month === key)
    if (entry) entry.count++
  }

  return result
}

// ─── Page ────────────────────────────────────────────────────

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const vaultKey = process.env.SUPABASE_VAULT_KEY ?? ''

  const [
    { data: profile },
    { data: invoiceRows },
    { data: smartbillRaw },
    { data: sagaRaw },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('invoices')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', startOf6MonthsAgo()),
    supabase.rpc('get_integration_credentials', {
      p_provider: 'smartbill',
      p_vault_key: vaultKey,
    }),
    supabase.rpc('get_integration_credentials', {
      p_provider: 'saga',
      p_vault_key: vaultKey,
    }),
  ])

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const currentMonthCount =
    (invoiceRows ?? []).filter((r) => {
      const d = new Date(r.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return key === currentMonth
    }).length

  const monthlyHistory = buildMonthlyHistory(invoiceRows ?? [], 6)

  const smartbillCreds = smartbillRaw
    ? (() => {
        try {
          return JSON.parse(smartbillRaw)
        } catch {
          return null
        }
      })()
    : null

  const sagaCreds = sagaRaw
    ? (() => {
        try {
          return JSON.parse(sagaRaw)
        } catch {
          return null
        }
      })()
    : null

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-xl font-semibold text-ie-text mb-6">Setări</h1>
      <SettingsTabs
        user={{ email: user.email! }}
        profile={profile}
        currentMonthCount={currentMonthCount}
        monthlyHistory={monthlyHistory}
        smartbillCreds={smartbillCreds}
        sagaCreds={sagaCreds}
      />
    </div>
  )
}
