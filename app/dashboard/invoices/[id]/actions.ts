'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { extractInvoice, type ExtractOptions } from '@/app/actions/extract-invoice'
import type { InvoiceEditData } from '@/types/invoice'

export async function reprocessInvoice(
  invoiceId: string,
  options: { model: 'gpt-4o-mini'; additionalContext?: string }
): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Neautentificat')

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, user_id, reprocess_count, status')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  if (error || !invoice) throw new Error('Factura nu a fost găsită')
  if ((invoice.reprocess_count ?? 0) >= 3) {
    throw new Error('Limita de 3 re-procesări a fost atinsă pentru această factură')
  }

  await supabase.from('invoice_lines').delete().eq('invoice_id', invoiceId)

  await supabase
    .from('invoices')
    .update({ status: 'processing', reprocess_count: (invoice.reprocess_count ?? 0) + 1 })
    .eq('id', invoiceId)

  await supabase.from('audit_logs').insert({
    invoice_id: invoiceId,
    user_id: user.id,
    action: 'reprocess',
    old_values: { status: invoice.status, reprocess_count: invoice.reprocess_count },
    new_values: { model: options.model, additionalContext: options.additionalContext ?? null },
  })

  const extractOpts: ExtractOptions = {
    model: options.model,
    additionalContext: options.additionalContext,
  }
  await extractInvoice(invoiceId, extractOpts)

  revalidatePath(`/dashboard/invoices/${invoiceId}`)
}

export async function updateInvoice(invoiceId: string, data: InvoiceEditData): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Neautentificat')

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(
      'id, user_id, vendor_name, vendor_cui, vendor_address, invoice_number, invoice_date, due_date, subtotal, vat_amount, total, currency, status'
    )
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  if (error || !invoice) throw new Error('Factura nu a fost găsită')

  const oldValues = {
    vendor_name: invoice.vendor_name,
    vendor_cui: invoice.vendor_cui,
    vendor_address: invoice.vendor_address,
    invoice_number: invoice.invoice_number,
    invoice_date: invoice.invoice_date,
    due_date: invoice.due_date,
    subtotal: invoice.subtotal,
    vat_amount: invoice.vat_amount,
    total: invoice.total,
    currency: invoice.currency,
  }

  await supabase.from('invoice_lines').delete().eq('invoice_id', invoiceId)

  if (data.lines.length > 0) {
    await supabase.from('invoice_lines').insert(
      data.lines.map((line) => ({
        invoice_id: invoiceId,
        line_number: line.line_number,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        vat_rate: line.vat_rate,
        line_total: line.line_total,
      }))
    )
  }

  const { lines: _lines, ...invoiceFields } = data
  await supabase
    .from('invoices')
    .update({ ...invoiceFields, status: 'validated' })
    .eq('id', invoiceId)

  await supabase.from('audit_logs').insert({
    invoice_id: invoiceId,
    user_id: user.id,
    action: 'manual_edit',
    old_values: oldValues,
    new_values: invoiceFields,
  })

  revalidatePath(`/dashboard/invoices/${invoiceId}`)
}

export async function deleteInvoice(invoiceId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Neautentificat')

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, user_id, file_path, exported_at')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  if (error || !invoice) throw new Error('Factura nu a fost găsită')
  if (invoice.exported_at) {
    throw new Error('Factura a fost exportată și nu poate fi ștearsă')
  }

  await supabase.storage.from('invoices').remove([invoice.file_path])

  await supabase.from('invoices').delete().eq('id', invoiceId)

  redirect('/dashboard')
}
