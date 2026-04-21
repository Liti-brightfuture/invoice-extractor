import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DBFFile } from 'dbffile'
import type { FieldDescriptor } from 'dbffile'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'

// Format DBF III — compatible import Saga (intrări facturi furnizori)

const FIELDS: FieldDescriptor[] = [
  { name: 'DATA',       type: 'D', size: 8 },
  { name: 'SERIE',      type: 'C', size: 10 },
  { name: 'NUMAR',      type: 'C', size: 20 },
  { name: 'CUI_F',      type: 'C', size: 13 },
  { name: 'DENUMIRE_F', type: 'C', size: 60 },
  { name: 'VALOARE',    type: 'N', size: 12, decimalPlaces: 2 },
  { name: 'TVA',        type: 'N', size: 12, decimalPlaces: 2 },
  { name: 'TOTAL',      type: 'N', size: 12, decimalPlaces: 2 },
]

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const ids = parseIds(req)

  let q = supabase
    .from('invoices')
    .select('id, invoice_number, invoice_date, vendor_name, vendor_cui, subtotal, vat_amount, total')
    .eq('user_id', user.id)
    .not('status', 'eq', 'processing')
    .order('invoice_date', { ascending: false })

  if (ids.length) q = q.in('id', ids)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const records = (data ?? []).map((inv) => {
    const { series, number } = splitInvoiceNumber(inv.invoice_number ?? '')
    const dateVal = inv.invoice_date ? new Date(inv.invoice_date) : new Date()

    return {
      DATA:       dateVal,
      SERIE:      series.slice(0, 10),
      NUMAR:      number.slice(0, 20),
      CUI_F:      (inv.vendor_cui ?? '').slice(0, 13),
      DENUMIRE_F: (inv.vendor_name ?? '').slice(0, 60),
      VALOARE:    Number(inv.subtotal ?? 0),
      TVA:        Number(inv.vat_amount ?? 0),
      TOTAL:      Number(inv.total ?? 0),
    }
  })

  // DBFFile scrie pe disc — folosim un fișier temporar
  const tmpPath = path.join(os.tmpdir(), `saga-export-${crypto.randomUUID()}.dbf`)
  let buffer: Buffer

  try {
    const dbf = await DBFFile.create(tmpPath, FIELDS, { fileVersion: 0x03, encoding: 'win1250' })
    await dbf.appendRecords(records)
    buffer = await fs.readFile(tmpPath)
  } finally {
    await fs.unlink(tmpPath).catch((err) => {
      console.error(`[export/saga] Nu s-a putut șterge fișierul temporar ${tmpPath}:`, err)
    })
  }

  await supabase
    .from('usage_logs')
    .insert({ user_id: user.id, action: 'export_saga', cost_ron: 0 })

  const exportedIds = (data ?? []).map((inv) => (inv as { id: string }).id)
  if (exportedIds.length > 0) {
    await supabase.from('audit_logs').insert(
      exportedIds.map((invoice_id) => ({
        invoice_id,
        user_id: user.id,
        action: 'export_saga',
        old_values: null,
        new_values: { format: 'saga_dbf', batch_size: exportedIds.length },
      }))
    )
  }

  const filename = `saga-intrari-${today()}.dbf`
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function splitInvoiceNumber(raw: string): { series: string; number: string } {
  const dashMatch = raw.match(/^([A-Za-z]+)-(.+)$/)
  if (dashMatch) return { series: dashMatch[1], number: dashMatch[2] }
  const alphaNumMatch = raw.match(/^([A-Za-z]+)(\d+.*)$/)
  if (alphaNumMatch) return { series: alphaNumMatch[1], number: alphaNumMatch[2] }
  return { series: '', number: raw }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseIds(req: NextRequest): string[] {
  return (req.nextUrl.searchParams.get('invoice_ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s))
    .slice(0, 100)
}

function today() {
  return new Date().toISOString().split('T')[0]
}
