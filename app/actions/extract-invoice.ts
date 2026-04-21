'use server'

import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'
import { runAnafValidation } from '@/lib/anaf-utils'
import { parseUBLInvoice } from '@/lib/ubl-parser'
import { classifyError } from '@/lib/error-classifier'
import { revalidatePath } from 'next/cache'

// ─── JSON Schema strict pentru Structured Outputs ───────────────────────────

const INVOICE_SCHEMA = {
  type: 'object',
  properties: {
    vendor: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        cui: { type: ['string', 'null'] },
        address: { type: ['string', 'null'] },
      },
      required: ['name', 'cui', 'address'],
      additionalProperties: false,
    },
    invoice_number: { type: ['string', 'null'] },
    invoice_date: { type: ['string', 'null'] },
    due_date: { type: ['string', 'null'] },
    currency: { type: 'string', enum: ['RON', 'EUR', 'USD'] },
    subtotal: { type: ['number', 'null'] },
    vat_amount: { type: ['number', 'null'] },
    total: { type: ['number', 'null'] },
    line_items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: ['string', 'null'] },
          quantity: { type: ['number', 'null'] },
          unit_price: { type: ['number', 'null'] },
          vat_rate: { type: ['number', 'null'] },
          line_total: { type: ['number', 'null'] },
        },
        required: ['description', 'quantity', 'unit_price', 'vat_rate', 'line_total'],
        additionalProperties: false,
      },
    },
    field_issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          camp:      { type: 'string' },
          problema:  { type: 'string' },
          gravitate: { type: 'string', enum: ['scazuta', 'medie', 'ridicata'] },
        },
        required: ['camp', 'problema', 'gravitate'],
        additionalProperties: false,
      },
    },
  },
  required: [
    'vendor',
    'invoice_number',
    'invoice_date',
    'due_date',
    'currency',
    'subtotal',
    'vat_amount',
    'total',
    'line_items',
    'field_issues',
  ],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT =
  'Ești expert în extragerea datelor din facturi românești. ' +
  'Extrage DOAR ce vezi explicit în imagine. ' +
  'Dacă un câmp lipsește sau nu este vizibil, pune null. ' +
  'CUI-ul furnizorului este fără prefixul RO (doar cifre). Dacă CUI-ul conține prefixul RO, elimină-l automat și nu-l adăuga în field_issues. ' +
  'Datele în format ISO: YYYY-MM-DD. ' +
  'Răspunde EXCLUSIV în limba română, inclusiv în câmpul field_issues. ' +
  'În field_issues listează fiecare câmp problematic ca un obiect cu: ' +
  '"camp" (numele câmpului în română), ' +
  '"problema" (descrierea problemei în română), ' +
  '"gravitate" (una din: "ridicata", "medie", "scazuta"). ' +
  'Reguli de gravitate: ' +
  '"ridicata" — câmp critic lipsă complet (ex: număr factură, total, furnizor); ' +
  '"medie" — valoare inferată sau presupusă (ex: TVA calculat, dată estimată); ' +
  '"scazuta" — incertitudine minoră (ex: lizibilitate slabă, câmp opțional lipsă). ' +
  'Dacă nu există probleme, returnează field_issues ca array gol [].'

// ─── Calculează confidence score ──────────────────────────────────────────────

function calcConfidenceScore(parsed: Record<string, unknown>): number {
  let score = 100
  const vendor = parsed.vendor as Record<string, unknown> | null

  const criticalFields = [
    vendor?.name,
    vendor?.cui,
    parsed.invoice_number,
    parsed.total,
    parsed.invoice_date,
  ]

  for (const field of criticalFields) {
    if (field === null || field === undefined || field === '') score -= 10
  }

  const fieldIssues = parsed.field_issues as Array<{ camp: string; problema: string; gravitate: string }> | null
  if (Array.isArray(fieldIssues)) {
    for (const issue of fieldIssues) {
      if (issue.gravitate === 'ridicata') score -= 20
      else if (issue.gravitate === 'medie') score -= 10
      else if (issue.gravitate === 'scazuta') score -= 5
    }
  }

  return Math.max(0, score)
}

async function maybeRunAnafValidation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  invoiceId: string,
  vendorCui: string,
  invoiceDate: string | null,
  shouldDowngradeOnFailure: boolean
) {
  const { data: profileData } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', userId)
    .single()

  const prefs = (profileData?.preferences ?? {}) as Record<string, unknown>
  const shouldValidateCui = prefs.validate_cui === true
  const offlineMode = prefs.offline_mode === true

  if (!shouldValidateCui) return

  const anafResult = await runAnafValidation(supabase, invoiceId, vendorCui, invoiceDate).catch(() => ({
    success: false as const,
    error: 'Eroare ANAF',
  }))

  if (!anafResult.success && !offlineMode && shouldDowngradeOnFailure) {
    await supabase.from('invoices').update({ status: 'review' }).eq('id', invoiceId)
  }
}

// ─── Server Action principal ───────────────────────────────────────────────────

export interface ExtractOptions {
  model?: 'gpt-4o-mini' | 'gpt-4o'
  additionalContext?: string
}

export async function extractInvoice(invoiceId: string, options?: ExtractOptions): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Neautentificat')

  // 1. Fetch invoice — guard dublă (RLS + user_id explicit)
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('id, file_path, file_name, status, user_id')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !invoice) throw new Error('Factura nu a fost găsită')

  // Guard: nu reprocessa dacă a ieșit din 'processing'
  if (invoice.status !== 'processing') return

  const startTime = Date.now()
  const model = options?.model ?? 'gpt-4o-mini'

  try {
    // 2. Download fișier din Supabase Storage
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('invoices')
      .download(invoice.file_path)

    if (downloadError || !fileBlob) throw new Error(`Storage download eșuat: ${downloadError?.message}`)

    const buffer = Buffer.from(await fileBlob.arrayBuffer())

    // 3. Determină MIME type și construiește input pentru Responses API
    const fileName = invoice.file_name.toLowerCase()
    const isPdf = fileName.endsWith('.pdf')
    const isXml = fileName.endsWith('.xml')

    if (isXml) {
      const xmlContent = buffer.toString('utf-8')
      const parsed = parseUBLInvoice(xmlContent)

      await supabase
        .from('invoices')
        .update({
          vendor_name: parsed.vendor_name,
          vendor_cui: parsed.vendor_cui,
          vendor_address: parsed.vendor_address,
          invoice_number: parsed.invoice_number,
          invoice_date: parsed.invoice_date,
          due_date: parsed.due_date,
          currency: parsed.currency,
          subtotal: parsed.subtotal,
          vat_amount: parsed.vat_amount,
          total: parsed.total,
          confidence_score: 100,
          ai_raw_response: { source: 'ubl_xml', parsed },
          processing_time_ms: Date.now() - startTime,
          status: 'validated',
          source: 'xml',
        })
        .eq('id', invoiceId)

      if (parsed.line_items.length > 0) {
        await supabase.from('invoice_lines').insert(
          parsed.line_items.map((item, idx) => ({
            invoice_id: invoiceId,
            line_number: idx + 1,
            ...item,
          }))
        )
      }

      if (parsed.vendor_cui) {
        await maybeRunAnafValidation(
          supabase,
          user.id,
          invoiceId,
          parsed.vendor_cui,
          parsed.invoice_date,
          true
        )
      }

      await supabase.from('usage_logs').insert({
        user_id: user.id,
        action: 'extract_xml',
        cost_ron: 0,
      })

      revalidatePath('/dashboard')
      return
    }

    const mimeType = isPdf
      ? 'application/pdf'
      : fileName.endsWith('.png')
        ? 'image/png'
        : 'image/jpeg'

    const base64 = buffer.toString('base64')
    const dataUrl = `data:${mimeType};base64,${base64}`

    const fileInput = isPdf
      ? ({ type: 'input_file' as const, filename: invoice.file_name, file_data: dataUrl })
      : ({ type: 'input_image' as const, image_url: dataUrl, detail: 'high' as const })

    // 4. Apel OpenAI Responses API cu Structured Outputs
    const userText = options?.additionalContext
      ? `Extrage toate datele din această factură.\nContext suplimentar: ${options.additionalContext}`
      : 'Extrage toate datele din această factură.'

    const response = await openai.responses.create({
      model,
      text: {
        format: {
          type: 'json_schema',
          name: 'invoice_extraction',
          strict: true,
          schema: INVOICE_SCHEMA,
        },
      },
      input: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: userText },
            fileInput,
          ],
        },
      ],
    })

    const rawContent = response.output_text
    if (!rawContent) throw new Error('Răspuns gol de la OpenAI')

    const parsed = JSON.parse(rawContent) as Record<string, unknown>
    const usage = response.usage

    // 5. Calculează confidence score
    const confidenceScore = calcConfidenceScore(parsed)

    // 6. UPDATE invoices
    const vendor = parsed.vendor as Record<string, string | null> | null
    await supabase
      .from('invoices')
      .update({
        vendor_name: vendor?.name ?? null,
        vendor_cui: vendor?.cui ?? null,
        vendor_address: vendor?.address ?? null,
        invoice_number: (parsed.invoice_number as string | null) ?? null,
        invoice_date: (parsed.invoice_date as string | null) ?? null,
        due_date: (parsed.due_date as string | null) ?? null,
        currency: (parsed.currency as string) ?? 'RON',
        subtotal: (parsed.subtotal as number | null) ?? null,
        vat_amount: (parsed.vat_amount as number | null) ?? null,
        total: (parsed.total as number | null) ?? null,
        confidence_score: confidenceScore,
        ai_raw_response: parsed,
        processing_time_ms: Date.now() - startTime,
        status: confidenceScore >= 85 ? 'validated' : 'review',
        source: isPdf ? 'pdf' : 'image',
      })
      .eq('id', invoiceId)

    // 7. INSERT invoice_lines
    const lineItems = parsed.line_items as Array<Record<string, unknown>> | null
    if (lineItems && lineItems.length > 0) {
      await supabase.from('invoice_lines').insert(
        lineItems.map((item, idx) => ({
          invoice_id: invoiceId,
          line_number: idx + 1,
          description: (item.description as string | null) ?? null,
          quantity: (item.quantity as number | null) ?? null,
          unit_price: (item.unit_price as number | null) ?? null,
          vat_rate: (item.vat_rate as number | null) ?? null,
          line_total: (item.line_total as number | null) ?? null,
        }))
      )
    }

    // 7b. Auto-validare CUI la ANAF dacă preferința e activată
    if (vendor?.cui) {
      await maybeRunAnafValidation(
        supabase,
        user.id,
        invoiceId,
        vendor.cui,
        (parsed.invoice_date as string | null) ?? null,
        confidenceScore >= 85
      )
    }

    // 8. INSERT usage_logs cu cost estimat
    // gpt-4o-mini: $0.15/1M input, $0.60/1M output; gpt-4o: $2.50/1M input, $10/1M output; 1 USD ≈ 4.8 RON
    if (usage) {
      const [inputRate, outputRate] = model === 'gpt-4o' ? [2.5, 10] : [0.15, 0.6]
      const usdCost =
        (usage.input_tokens / 1_000_000) * inputRate +
        (usage.output_tokens / 1_000_000) * outputRate
      const costRon = usdCost * 4.8

      await supabase.from('usage_logs').insert({
        user_id: user.id,
        action: 'extract',
        cost_ron: costRon,
      })
    }

    revalidatePath('/dashboard')
  } catch (err) {
    const { error_code, error_message } = classifyError(err)
    await supabase
      .from('invoices')
      .update({
        status: 'error',
        error_code,
        error_message,
        // Keep legacy field for backward compat (old UI still reads ai_raw_response.error)
        ai_raw_response: {
          error: err instanceof Error ? err.message : String(err),
        },
        processing_time_ms: Date.now() - startTime,
      })
      .eq('id', invoiceId)
  }
}
