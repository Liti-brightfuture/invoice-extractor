'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { reprocessInvoice } from '@/app/dashboard/invoices/[id]/actions'

export async function retryFailedInvoice(formData: FormData): Promise<void> {
  const invoiceId = formData.get('invoiceId')
  if (typeof invoiceId !== 'string' || !invoiceId) {
    throw new Error('invoiceId lipsă')
  }

  // Reuses existing logic: checks reprocess_count cap (3), writes audit log,
  // sets status='processing', increments counter, and calls extractInvoice.
  await reprocessInvoice(invoiceId, { model: 'gpt-4o-mini' })

  revalidatePath('/dashboard/invoices/failed')
  redirect('/dashboard/invoices/failed')
}
