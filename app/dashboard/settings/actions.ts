'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

// ─── Profil personal + firmă ─────────────────────────────────

export async function updateProfile(data: {
  full_name: string
  phone: string
  company_name: string
  company_cui: string
  company_address: string
}): Promise<ActionResult> {
  if (data.full_name && data.full_name.length > 150)
    return { success: false, error: 'Numele este prea lung (max 150 caractere)' }
  if (data.company_name && data.company_name.length > 255)
    return { success: false, error: 'Numele firmei este prea lung (max 255 caractere)' }
  if (data.company_address && data.company_address.length > 500)
    return { success: false, error: 'Adresa este prea lungă (max 500 caractere)' }
  if (data.phone && !/^[0-9+\-\s()]{0,20}$/.test(data.phone))
    return { success: false, error: 'Număr de telefon invalid' }
  if (data.company_cui && !/^(RO)?[0-9]{2,10}$/i.test(data.company_cui.trim()))
    return { success: false, error: 'CUI invalid (ex: RO12345678 sau 12345678)' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Neautentificat' }

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, ...data })

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/settings')
  return { success: true }
}

// ─── Schimbă email ───────────────────────────────────────────

export async function sendEmailChangeLink(
  newEmail: string
): Promise<ActionResult> {
  if (!newEmail || !newEmail.includes('@')) {
    return { success: false, error: 'Email invalid' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Neautentificat' }

  const { error } = await supabase.auth.updateUser({ email: newEmail })
  if (error) return { success: false, error: error.message }

  return { success: true }
}

// ─── Șterge cont (soft delete) ───────────────────────────────

export async function deleteAccount(): Promise<never> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('profiles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', user.id)

  await supabase.auth.signOut()
  redirect('/login')
}

// ─── SmartBill: salvează credentials (criptat) ───────────────

export async function saveSmartBillIntegration(data: {
  api_key: string
  username: string
  company_vat_code: string
}): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Neautentificat' }

  const vaultKey = process.env.SUPABASE_VAULT_KEY
  if (!vaultKey) return { success: false, error: 'Vault key lipsă (env)' }

  const { error } = await supabase.rpc('upsert_integration', {
    p_provider: 'smartbill',
    p_credentials: JSON.stringify(data),
    p_vault_key: vaultKey,
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ─── SmartBill: testează conexiunea ──────────────────────────

export async function testSmartBillConnection(
  apiKey: string,
  username: string
): Promise<ActionResult<{ companyName: string }>> {
  if (!apiKey || !username) {
    return { success: false, error: 'API key și username sunt obligatorii' }
  }

  try {
    const credentials = Buffer.from(`${username}:${apiKey}`).toString('base64')
    const response = await fetch('https://ws.smartbill.ro/SBORO/api/company', {
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Credențiale invalide SmartBill' }
      }
      return { success: false, error: `Eroare SmartBill: ${response.status}` }
    }

    const body = await response.json()
    const companyName: string =
      body?.company?.name ?? body?.companyName ?? 'Firmă validată'

    return { success: true, data: { companyName } }
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return { success: false, error: 'Timeout — SmartBill nu răspunde' }
    }
    return { success: false, error: 'Eroare de rețea' }
  }
}

// ─── Saga: salvează setări ────────────────────────────────────

export async function saveSagaSettings(data: {
  export_dbf: boolean
  default_path: string
}): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Neautentificat' }

  const vaultKey = process.env.SUPABASE_VAULT_KEY
  if (!vaultKey) return { success: false, error: 'Vault key lipsă (env)' }

  const { error } = await supabase.rpc('upsert_integration', {
    p_provider: 'saga',
    p_credentials: JSON.stringify(data),
    p_vault_key: vaultKey,
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ─── Preferințe procesare ────────────────────────────────────

const ALLOWED_LANGS = ['ro', 'en']

export async function savePreferences(prefs: {
  threshold: number
  validate_cui: boolean
  offline_mode: boolean
  lang: string
}): Promise<ActionResult> {
  if (typeof prefs.threshold !== 'number' || prefs.threshold < 0 || prefs.threshold > 100)
    return { success: false, error: 'Pragul de încredere trebuie să fie între 0 și 100' }
  if (!ALLOWED_LANGS.includes(prefs.lang))
    return { success: false, error: 'Limbă invalidă' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Neautentificat' }

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, preferences: prefs })

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/settings')
  return { success: true }
}
