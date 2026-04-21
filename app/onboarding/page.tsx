import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingWizard } from './OnboardingWizard'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('preferences, company_name, company_cui')
    .eq('id', user.id)
    .single()

  const onboardingDone =
    (profile?.preferences as Record<string, unknown> | null)?.onboarding_completed

  if (onboardingDone) redirect('/dashboard')

  return (
    <OnboardingWizard
      userId={user.id}
      initialCompanyName={profile?.company_name ?? ''}
      initialCompanyCui={profile?.company_cui ?? ''}
    />
  )
}
