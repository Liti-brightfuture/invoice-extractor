'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function createInvoiceRecord(filePath: string, fileName: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Neautentificat')

  const normalizedName = fileName.toLowerCase()
  const source = normalizedName.endsWith('.xml')
    ? 'xml'
    : normalizedName.endsWith('.pdf')
      ? 'pdf'
      : 'image'

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      user_id: user.id,
      file_path: filePath,
      file_name: fileName,
      status: 'processing',
      source,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return { invoiceId: data.id as string }
}

export async function markInvoiceAsValidated(invoiceId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Neautentificat')

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'validated' })
    .eq('id', invoiceId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  await supabase.from('audit_logs').insert({
    invoice_id: invoiceId,
    user_id: user.id,
    action: 'mark_validated',
    old_values: { status: 'review' },
    new_values: { status: 'validated' },
  })

  return { success: true }
}
