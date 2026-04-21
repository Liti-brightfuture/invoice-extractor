'use server'

import JSZip from 'jszip'
import { createClient } from '@/lib/supabase/server'
import {
  formatSmartBill,
  formatSaga,
  formatWinMentor,
  formatCsv,
  formatEFactura,
  type InvoiceForExport,
} from '@/lib/export-formatters'
import type { ExportFormat, ExportRecord } from '@/types/invoice'

// ─── Tipuri ───────────────────────────────────────────────────────────────────

export interface ExportParams {
  periodFrom: string   // 'YYYY-MM-DD'
  periodTo: string     // 'YYYY-MM-DD'
  format: ExportFormat
  onlyValidated: boolean
}

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

// ─── generateBatchExport ──────────────────────────────────────────────────────

export async function generateBatchExport(
  params: ExportParams
): Promise<ActionResult<{ signedUrl: string; invoiceCount: number }>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Neautentificat' }

    // 1. Fetch facturi filtrate
    let q = supabase
      .from('invoices')
      .select(
        `id, invoice_number, invoice_date, due_date,
         vendor_name, vendor_cui, vendor_address,
         subtotal, vat_amount, total, currency,
         invoice_lines ( line_number, description, quantity, unit_price, vat_rate, line_total )`
      )
      .eq('user_id', user.id)
      .not('status', 'eq', 'processing')
      .gte('invoice_date', params.periodFrom)
      .lte('invoice_date', params.periodTo)
      .order('invoice_date', { ascending: true })

    if (params.onlyValidated) {
      q = q.eq('status', 'validated')
    }

    const { data, error: fetchErr } = await q
    if (fetchErr) return { success: false, error: fetchErr.message }

    const invoices = (data ?? []) as InvoiceForExport[]
    if (invoices.length === 0) {
      return { success: false, error: 'Nu există facturi pentru perioada și filtrele selectate.' }
    }

    // 2. Generează conținut ZIP
    const zip = new JSZip()
    const { format } = params
    const dateLabel = `${params.periodFrom}_${params.periodTo}`

    if (format === 'smartbill') {
      const buf = formatSmartBill(invoices)
      zip.file('invoices.json', buf)
    } else if (format === 'saga') {
      const buf = await formatSaga(invoices)
      zip.file('facturi.dbf', buf)
    } else if (format === 'winmentor') {
      const { xmlFiles, indexCsv } = formatWinMentor(invoices)
      for (const { name, content } of xmlFiles) {
        zip.file(name, content)
      }
      zip.file('index.csv', indexCsv)
    } else if (format === 'csv') {
      const buf = formatCsv(invoices)
      zip.file('facturi.csv', buf)
    } else if (format === 'efactura') {
      const { xmlFiles } = formatEFactura(invoices)
      for (const { name, content } of xmlFiles) {
        zip.file(name, content)
      }
    }

    // 3. Generează ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

    // 4. Upload în Supabase Storage
    const timestamp = Date.now()
    const filePath = `${user.id}/${timestamp}-${format}-${dateLabel}.zip`
    const { error: uploadErr } = await supabase.storage
      .from('exports')
      .upload(filePath, zipBuffer, {
        contentType: 'application/zip',
        upsert: false,
      })
    if (uploadErr) return { success: false, error: `Upload eșuat: ${uploadErr.message}` }

    // 5. Insert în tabelul exports
    const { error: insertErr } = await supabase.from('exports').insert({
      user_id: user.id,
      format,
      period_from: params.periodFrom,
      period_to: params.periodTo,
      invoice_count: invoices.length,
      file_path: filePath,
    })
    if (insertErr) {
      // Nu e fatal — fișierul e deja uploadat, logăm doar
      console.error('[export] insert exports row failed:', insertErr.message)
    }

    // 6. Signed URL cu expiry 24h
    const { data: urlData, error: urlErr } = await supabase.storage
      .from('exports')
      .createSignedUrl(filePath, 86400)
    if (urlErr || !urlData?.signedUrl) {
      return { success: false, error: 'Nu s-a putut genera URL-ul de descărcare.' }
    }

    // 7. Log usage
    await supabase
      .from('usage_logs')
      .insert({ user_id: user.id, action: 'export_batch', cost_ron: 0 })

    return { success: true, data: { signedUrl: urlData.signedUrl, invoiceCount: invoices.length } }
  } catch (err) {
    console.error('[export] generateBatchExport error:', err)
    return { success: false, error: 'Eroare internă la generarea exportului.' }
  }
}

// ─── getExportHistory ─────────────────────────────────────────────────────────

export async function getExportHistory(): Promise<ActionResult<ExportRecord[]>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Neautentificat' }

    const { data, error } = await supabase
      .from('exports')
      .select('id, user_id, format, period_from, period_to, invoice_count, file_path, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return { success: false, error: error.message }

    // Generează signed URL pentru fiecare export care nu e expirat (< 30 zile)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)

    const records: ExportRecord[] = await Promise.all(
      (data ?? []).map(async (row) => {
        const record: ExportRecord = {
          id: row.id,
          user_id: row.user_id,
          format: row.format as ExportFormat,
          period_from: row.period_from,
          period_to: row.period_to,
          invoice_count: row.invoice_count,
          file_path: row.file_path,
          created_at: row.created_at,
        }

        if (row.file_path && new Date(row.created_at) > cutoff) {
          const { data: urlData } = await supabase.storage
            .from('exports')
            .createSignedUrl(row.file_path, 86400)
          if (urlData?.signedUrl) record.signedUrl = urlData.signedUrl
        }

        return record
      })
    )

    return { success: true, data: records }
  } catch (err) {
    console.error('[export] getExportHistory error:', err)
    return { success: false, error: 'Eroare la încărcarea istoricului.' }
  }
}

// ─── redownloadExport ─────────────────────────────────────────────────────────

export async function redownloadExport(
  id: string
): Promise<ActionResult<{ signedUrl: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Neautentificat' }

    const { data, error } = await supabase
      .from('exports')
      .select('file_path, created_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !data) return { success: false, error: 'Export negăsit.' }
    if (!data.file_path) return { success: false, error: 'Fișierul nu mai este disponibil.' }

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    if (new Date(data.created_at) <= cutoff) {
      return { success: false, error: 'Exportul a expirat (> 30 zile).' }
    }

    const { data: urlData, error: urlErr } = await supabase.storage
      .from('exports')
      .createSignedUrl(data.file_path, 86400)

    if (urlErr || !urlData?.signedUrl) {
      return { success: false, error: 'Nu s-a putut genera URL-ul de descărcare.' }
    }

    return { success: true, data: { signedUrl: urlData.signedUrl } }
  } catch (err) {
    console.error('[export] redownloadExport error:', err)
    return { success: false, error: 'Eroare internă.' }
  }
}
