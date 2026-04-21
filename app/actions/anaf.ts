'use server'

import { createClient } from '@/lib/supabase/server'
import Bottleneck from 'bottleneck'
import { runAnafValidation, type AnafValidationResult } from '@/lib/anaf-utils'

// Rate limiter pentru butonul manual (poate fi apăsat rapid)
const anafLimiter = new Bottleneck({ minTime: 1000, maxConcurrent: 1 })

export type AnafResult = AnafValidationResult

export async function validateCui(invoiceId: string): Promise<AnafResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Neautentificat')

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, vendor_cui, invoice_date, user_id')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  if (!invoice) throw new Error('Factura nu a fost găsită')
  if (!invoice.vendor_cui) return { success: false, error: 'CUI lipsă pe factură' }

  try {
    return await anafLimiter.schedule(() =>
      runAnafValidation(supabase, invoiceId, invoice.vendor_cui!, invoice.invoice_date)
    )
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Eroare conectare ANAF',
    }
  }
}
