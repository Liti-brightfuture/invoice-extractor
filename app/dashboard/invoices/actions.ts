'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function deleteInvoices(ids: string[]): Promise<{ error: string | null }> {
  if (!ids.length) return { error: null }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Neautentificat' }

  const { error } = await supabase
    .from('invoices')
    .delete()
    .in('id', ids)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/invoices')
  return { error: null }
}

export async function revalidateANAF(ids: string[]): Promise<{ error: string | null }> {
  if (!ids.length) return { error: null }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Neautentificat' }

  // Stub — ANAF API integration not yet implemented
  // Future: fetch ANAF API for each vendor_cui, update anaf_* fields
  revalidatePath('/dashboard/invoices')
  return { error: null }
}
