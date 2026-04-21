'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type ActionResult = { success: true } | { success: false; error: string }

export async function saveCompanyInfo(data: {
  company_name: string
  company_cui: string
}): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Neautentificat' }

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, company_name: data.company_name, company_cui: data.company_cui })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function completeOnboarding(): Promise<never> {
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

  const existing = (profile?.preferences as Record<string, unknown>) ?? {}
  const merged = { ...existing, onboarding_completed: true }

  await supabase.from('profiles').upsert({ id: user.id, preferences: merged })

  revalidatePath('/dashboard')
  redirect('/dashboard')
}
