'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Bottleneck from 'bottleneck'

const anafLimiter = new Bottleneck({ minTime: 1000, maxConcurrent: 1 })

export async function updateSupplier(
  id: string,
  data: { name: string; address: string }
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Neautentificat' }

  const { error } = await supabase
    .from('suppliers')
    .update({ name: data.name, address: data.address })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/suppliers')
  revalidatePath(`/dashboard/suppliers/${id}`)
  return { error: null }
}

export async function mergeSuppliers(
  keepId: string,
  removeId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Neautentificat' }

  // Verifică că ambii furnizori aparțin userului
  const { data: suppliers, error: fetchError } = await supabase
    .from('suppliers')
    .select('id')
    .in('id', [keepId, removeId])
    .eq('user_id', user.id)

  if (fetchError) return { error: fetchError.message }
  if (!suppliers || suppliers.length !== 2) return { error: 'Furnizori negăsiți' }

  // Mută toate facturile de la removeId la keepId
  const { error: updateError } = await supabase
    .from('invoices')
    .update({ supplier_id: keepId })
    .eq('supplier_id', removeId)
    .eq('user_id', user.id)

  if (updateError) return { error: updateError.message }

  // Șterge furnizorul duplicat
  const { error: deleteError } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', removeId)
    .eq('user_id', user.id)

  if (deleteError) return { error: deleteError.message }

  revalidatePath('/dashboard/suppliers')
  redirect('/dashboard/suppliers')
}

export async function revalidateSupplierANAF(
  supplierId: string
): Promise<{ error: string | null; scpTVA?: boolean; isActive?: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Neautentificat' }

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, cui')
    .eq('id', supplierId)
    .eq('user_id', user.id)
    .single()

  if (!supplier) return { error: 'Furnizor negăsit' }

  const rawCui = supplier.cui.toString().trim().replace(/^RO/i, '')
  const cuiInt = parseInt(rawCui, 10)
  if (isNaN(cuiInt)) return { error: 'CUI invalid' }

  const today = new Date().toISOString().split('T')[0]

  let result
  try {
    result = await anafLimiter.schedule(async () => {
      const res = await fetch('https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ cui: cuiInt, data: today }]),
        signal: AbortSignal.timeout(10_000),
      })
      const isJson = res.headers.get('content-type')?.includes('application/json')
      if (!res.ok && (!isJson || res.status !== 404)) {
        throw new Error(`ANAF indisponibil (${res.status})`)
      }
      return res.json() as Promise<{ found?: unknown[]; notFound?: unknown[] }>
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Eroare conectare ANAF' }
  }

  const foundItem = result?.found?.[0] as Record<string, unknown> | undefined
  if (!foundItem) return { error: 'CUI negăsit în baza de date ANAF' }

  // Upsert cache
  await supabase
    .from('anaf_cache')
    .upsert(
      { cui: rawCui, response: foundItem, cached_at: new Date().toISOString() },
      { onConflict: 'cui' }
    )

  const inregistrareTva = foundItem.inregistrare_scop_Tva as Record<string, unknown> | null
  const dateGenerale = foundItem.date_generale as Record<string, unknown> | null
  const scpTVA = (inregistrareTva?.scpTVA as boolean) ?? false
  const stare = (dateGenerale?.stare_inregistrare as string) ?? ''
  const isActive = stare.toUpperCase().includes('ACTIVA')

  await supabase
    .from('suppliers')
    .update({
      anaf_vat_payer: scpTVA,
      anaf_active: isActive,
      anaf_last_check: new Date().toISOString(),
    })
    .eq('id', supplierId)
    .eq('user_id', user.id)

  revalidatePath(`/dashboard/suppliers/${supplierId}`)
  return { error: null, scpTVA, isActive }
}
