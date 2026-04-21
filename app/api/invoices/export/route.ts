import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type ExportFormat = 'csv' | 'smartbill' | 'saga'

// GET /api/invoices/export?ids=uuid1,uuid2&format=csv|smartbill|saga
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const ALLOWED_FORMATS: ExportFormat[] = ['csv', 'smartbill', 'saga']

  const { searchParams } = request.nextUrl
  const ids = (searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s))
    .slice(0, 100)

  const rawFormat = searchParams.get('format') ?? 'csv'
  const format = (ALLOWED_FORMATS.includes(rawFormat as ExportFormat) ? rawFormat : 'csv') as ExportFormat

  if (!ids.length) {
    return NextResponse.json({ error: 'No valid IDs provided' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('invoices')
    .select('id, vendor_name, vendor_cui, invoice_number, invoice_date, total, currency, status, subtotal, vat_amount')
    .in('id', ids)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = data ?? []

  if (format === 'csv') {
    const csv = buildCsv(rows)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="facturi.csv"',
      },
    })
  }

  // SmartBill and Saga: stub JSON response (integration not yet implemented)
  return NextResponse.json({ format, count: rows.length, data: rows })
}

function buildCsv(rows: Record<string, unknown>[]): string {
  const headers = ['ID', 'Furnizor', 'CUI', 'Nr. Factură', 'Dată', 'Subtotal', 'TVA', 'Total', 'Monedă', 'Status']
  const lines = rows.map(r =>
    [
      r.id,
      r.vendor_name ?? '',
      r.vendor_cui ?? '',
      r.invoice_number ?? '',
      r.invoice_date ?? '',
      r.subtotal ?? '',
      r.vat_amount ?? '',
      r.total ?? '',
      r.currency,
      r.status,
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
  )
  return [headers.join(','), ...lines].join('\r\n')
}
