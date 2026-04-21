import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from './DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', user.id)
    .single()

  const onboardingDone =
    (profile?.preferences as Record<string, unknown> | null)?.onboarding_completed

  if (!onboardingDone) redirect('/onboarding')

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [{ count: failedCount }, { count: monthlyUsed }] = await Promise.all([
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'error'),
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['validated', 'review'])
      .gte('created_at', startOfMonth),
  ])

  return (
    <DashboardShell failedCount={failedCount ?? 0} usedCount={monthlyUsed ?? 0} usageTotal={20}>
      {children}
    </DashboardShell>
  )
}
