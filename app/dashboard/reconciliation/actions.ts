'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createPairKey,
  DUPLICATE_THRESHOLD,
  getDifferentFields,
  scoreDuplicatePair,
} from '@/lib/reconciliation'
import type {
  ReconciliationCandidate,
  ReconciliationConfirmedPair,
  ReconciliationInvoicePreview,
} from '@/types/invoice'

interface InvoiceRow {
  id: string
  user_id: string
  file_name: string
  file_path: string
  source: 'pdf' | 'image' | 'xml'
  vendor_name: string | null
  vendor_cui: string | null
  invoice_number: string | null
  invoice_date: string | null
  total: number | null
  currency: string | null
  linked_invoice_id: string | null
  archived_at: string | null
}

function normalizePairIds(leftId: string, rightId: string) {
  return leftId.localeCompare(rightId) <= 0
    ? { invoice_a_id: leftId, invoice_b_id: rightId }
    : { invoice_a_id: rightId, invoice_b_id: leftId }
}

async function getAuthenticatedContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Neautentificat')
  }

  return { supabase, user }
}

async function createSignedInvoiceUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filePath: string
) {
  const { data } = await supabase.storage.from('invoices').createSignedUrl(filePath, 3600)
  return data?.signedUrl
}

async function buildPreview(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoice: InvoiceRow
): Promise<ReconciliationInvoicePreview> {
  return {
    id: invoice.id,
    file_name: invoice.file_name,
    file_path: invoice.file_path,
    source: invoice.source,
    vendor_name: invoice.vendor_name,
    vendor_cui: invoice.vendor_cui,
    invoice_number: invoice.invoice_number,
    invoice_date: invoice.invoice_date,
    total: invoice.total,
    currency: invoice.currency ?? 'RON',
    linked_invoice_id: invoice.linked_invoice_id,
    archived_at: invoice.archived_at,
    signed_url: await createSignedInvoiceUrl(supabase, invoice.file_path),
  }
}

async function fetchReconciliationInvoices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  { includeArchived = false, onlyLinked = false }: { includeArchived?: boolean; onlyLinked?: boolean } = {}
) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)

  let query = supabase
    .from('invoices')
    .select(
      'id, user_id, file_name, file_path, source, vendor_name, vendor_cui, invoice_number, invoice_date, total, currency, linked_invoice_id, archived_at'
    )
    .eq('user_id', userId)
    .in('source', ['pdf', 'xml'])
    .gte('invoice_date', cutoff.toISOString().slice(0, 10))

  if (!includeArchived) query = query.is('archived_at', null)
  if (onlyLinked) query = query.not('linked_invoice_id', 'is', null)

  const { data, error } = await query.order('invoice_date', { ascending: false })
  if (error) throw new Error(error.message)

  return (data ?? []) as InvoiceRow[]
}

export async function findDuplicates(): Promise<ReconciliationCandidate[]> {
  const { supabase, user } = await getAuthenticatedContext()
  const invoices = await fetchReconciliationInvoices(supabase, user.id)

  const { data: dismissedRows, error: dismissedError } = await supabase
    .from('dismissed_duplicates')
    .select('invoice_a_id, invoice_b_id')
    .eq('user_id', user.id)

  if (dismissedError) throw new Error(dismissedError.message)

  const dismissedKeys = new Set(
    (dismissedRows ?? []).map((row) => createPairKey(row.invoice_a_id, row.invoice_b_id))
  )

  const pdfInvoices = invoices.filter((invoice) => invoice.source === 'pdf' && !invoice.linked_invoice_id)
  const xmlInvoices = invoices.filter((invoice) => invoice.source === 'xml' && !invoice.linked_invoice_id)

  const candidates: ReconciliationCandidate[] = []

  for (const pdfInvoice of pdfInvoices) {
    for (const xmlInvoice of xmlInvoices) {
      const pairKey = createPairKey(pdfInvoice.id, xmlInvoice.id)
      if (dismissedKeys.has(pairKey)) continue

      const { score, score_breakdown } = scoreDuplicatePair(pdfInvoice, xmlInvoice)
      if (score < DUPLICATE_THRESHOLD) continue

      const [left, right] = await Promise.all([
        buildPreview(supabase, pdfInvoice),
        buildPreview(supabase, xmlInvoice),
      ])

      candidates.push({
        pair_key: pairKey,
        left,
        right,
        score,
        score_breakdown,
        different_fields: getDifferentFields(left, right),
      })
    }
  }

  return candidates.sort((left, right) => right.score - left.score)
}

export async function getConfirmedDuplicates(): Promise<ReconciliationConfirmedPair[]> {
  const { supabase, user } = await getAuthenticatedContext()
  const invoices = await fetchReconciliationInvoices(supabase, user.id, {
    includeArchived: true,
    onlyLinked: true,
  })

  const invoiceMap = new Map(invoices.map((invoice) => [invoice.id, invoice]))
  const pairs = new Map<string, { pdf: InvoiceRow; xml: InvoiceRow }>()

  for (const invoice of invoices) {
    if (!invoice.linked_invoice_id) continue
    const linked = invoiceMap.get(invoice.linked_invoice_id)
    if (!linked) continue
    if (invoice.source === linked.source) continue

    const key = createPairKey(invoice.id, linked.id)
    if (pairs.has(key)) continue

    const pdf = invoice.source === 'pdf' ? invoice : linked
    const xml = invoice.source === 'xml' ? invoice : linked
    pairs.set(key, { pdf, xml })
  }

  const result: ReconciliationConfirmedPair[] = []
  for (const [pairKey, pair] of pairs.entries()) {
    const [pdf_invoice, xml_invoice] = await Promise.all([
      buildPreview(supabase, pair.pdf),
      buildPreview(supabase, pair.xml),
    ])

    result.push({
      pair_key: pairKey,
      pdf_invoice,
      xml_invoice,
    })
  }

  return result.sort((left, right) =>
    (right.xml_invoice.invoice_date ?? '').localeCompare(left.xml_invoice.invoice_date ?? '')
  )
}

export async function confirmDuplicate(pdfInvoiceId: string, xmlInvoiceId: string) {
  const { supabase, user } = await getAuthenticatedContext()

  const { data, error } = await supabase
    .from('invoices')
    .select('id, user_id, source, linked_invoice_id, archived_at')
    .eq('user_id', user.id)
    .in('id', [pdfInvoiceId, xmlInvoiceId])

  if (error) return { error: error.message }
  if (!data || data.length !== 2) return { error: 'Facturile nu au fost găsite.' }

  const pdfInvoice = data.find((invoice) => invoice.id === pdfInvoiceId)
  const xmlInvoice = data.find((invoice) => invoice.id === xmlInvoiceId)

  if (!pdfInvoice || !xmlInvoice) return { error: 'Facturile nu au fost găsite.' }
  if (pdfInvoice.source !== 'pdf' || xmlInvoice.source !== 'xml') {
    return { error: 'Confirmarea cere o factură PDF și una XML.' }
  }
  if (pdfInvoice.linked_invoice_id || xmlInvoice.linked_invoice_id) {
    return { error: 'Una dintre facturi este deja legată.' }
  }

  const { error: archiveError } = await supabase
    .from('invoices')
    .update({
      linked_invoice_id: xmlInvoiceId,
      archived_at: new Date().toISOString(),
      archived_reason: 'duplicate_pdf_kept_xml',
    })
    .eq('id', pdfInvoiceId)
    .eq('user_id', user.id)

  if (archiveError) return { error: archiveError.message }

  const { error: xmlUpdateError } = await supabase
    .from('invoices')
    .update({
      linked_invoice_id: pdfInvoiceId,
      archived_at: null,
      archived_reason: null,
    })
    .eq('id', xmlInvoiceId)
    .eq('user_id', user.id)

  if (xmlUpdateError) return { error: xmlUpdateError.message }

  const normalizedPair = normalizePairIds(pdfInvoiceId, xmlInvoiceId)
  await supabase
    .from('dismissed_duplicates')
    .delete()
    .eq('user_id', user.id)
    .eq('invoice_a_id', normalizedPair.invoice_a_id)
    .eq('invoice_b_id', normalizedPair.invoice_b_id)

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/invoices')
  revalidatePath('/dashboard/reconciliation')
  revalidatePath(`/dashboard/invoices/${pdfInvoiceId}`)
  revalidatePath(`/dashboard/invoices/${xmlInvoiceId}`)

  return { error: null }
}

export async function dismissDuplicate(invoiceAId: string, invoiceBId: string) {
  const { supabase, user } = await getAuthenticatedContext()
  const normalizedPair = normalizePairIds(invoiceAId, invoiceBId)

  const { data, error } = await supabase
    .from('invoices')
    .select('id')
    .eq('user_id', user.id)
    .in('id', [normalizedPair.invoice_a_id, normalizedPair.invoice_b_id])

  if (error) return { error: error.message }
  if (!data || data.length !== 2) return { error: 'Facturile nu au fost găsite.' }

  const { error: insertError } = await supabase.from('dismissed_duplicates').insert({
    user_id: user.id,
    invoice_a_id: normalizedPair.invoice_a_id,
    invoice_b_id: normalizedPair.invoice_b_id,
  })

  if (insertError && insertError.code !== '23505') {
    return { error: insertError.message }
  }

  revalidatePath('/dashboard/reconciliation')
  revalidatePath('/dashboard/invoices')

  return { error: null }
}
