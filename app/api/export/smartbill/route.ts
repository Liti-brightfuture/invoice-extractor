import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Format compatibil SmartBill API v2 — POST /invoice
// Documentație: https://api.smartbill.ro/SBORO/api/doc

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const ids = parseIds(req)

  let q = supabase
    .from('invoices')
    .select(
      `id, invoice_number, invoice_date, vendor_name, vendor_cui, vendor_address,
       subtotal, vat_amount, total, currency,
       invoice_lines ( line_number, description, quantity, unit_price, vat_rate, line_total )`
    )
    .eq('user_id', user.id)
    .not('status', 'eq', 'processing')
    .order('invoice_date', { ascending: false })

  if (ids.length) q = q.in('id', ids)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const invoices = (data ?? []).map((inv) => {
    // Dacă există linii extrase, folosim-le; altfel generăm un rând sinteticdin totaluri
    const lines = Array.isArray(inv.invoice_lines) ? inv.invoice_lines : []
    const products =
      lines.length > 0
        ? lines
            .sort((a, b) => (a.line_number ?? 0) - (b.line_number ?? 0))
            .map((l) => buildProduct(l, inv.currency ?? 'RON'))
        : [syntheticProduct(inv)]

    // Extrage seria din numărul facturii (ex: "FACT-001" → serie="FACT")
    const { series, number } = splitInvoiceNumber(inv.invoice_number ?? '')

    return {
      companyVatCode: inv.vendor_cui ? `RO${inv.vendor_cui.replace(/^RO/i, '')}` : '',
      client: {
        name: '',
        vatCode: '',
        regCom: '',
        address: inv.vendor_address ?? '',
        isTaxPayer: false,
        save: false,
        country: 'Romania',
      },
      issueDate: inv.invoice_date ?? '',
      seriesName: series,
      isDraft: false,
      currency: inv.currency ?? 'RON',
      language: 'RO',
      precision: 2,
      useStock: false,
      observations: `Importat din InvoiceExtractor. Nr. original: ${inv.invoice_number ?? ''}`,
      products,
      _meta: {
        vendor_name: inv.vendor_name,
        vendor_cui: inv.vendor_cui,
        invoice_number: inv.invoice_number,
        original_number: number,
      },
    }
  })

  await supabase
    .from('usage_logs')
    .insert({ user_id: user.id, action: 'export_smartbill', cost_ron: 0 })

  const exportedIds = (data ?? []).map((inv) => (inv as { id: string }).id)
  if (exportedIds.length > 0) {
    await supabase.from('audit_logs').insert(
      exportedIds.map((invoice_id) => ({
        invoice_id,
        user_id: user.id,
        action: 'export_smartbill',
        old_values: null,
        new_values: { format: 'smartbill_json', batch_size: exportedIds.length },
      }))
    )
  }

  const filename = `smartbill-${today()}.json`
  return new NextResponse(JSON.stringify(invoices, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function buildProduct(
  line: { description?: string | null; quantity?: number | null; unit_price?: number | null; vat_rate?: number | null; line_total?: number | null },
  currency: string
) {
  return {
    name: line.description ?? 'Produs',
    code: '',
    description: '',
    price: line.unit_price ?? 0,
    isTaxIncluded: false,
    taxName: taxName(line.vat_rate),
    taxPercentage: line.vat_rate ?? 19,
    isService: false,
    saveToDb: false,
    quantity: line.quantity ?? 1,
    measuringUnitName: 'buc',
    currency,
    exchangeRate: 1,
  }
}

function syntheticProduct(inv: {
  subtotal?: number | null
  vat_amount?: number | null
  total?: number | null
  currency?: string | null
  vendor_name?: string | null
}) {
  const vatPct =
    inv.subtotal && inv.subtotal > 0 && inv.vat_amount != null
      ? Math.round((inv.vat_amount / inv.subtotal) * 100)
      : 19

  return {
    name: `Servicii/bunuri — ${inv.vendor_name ?? 'Furnizor'}`,
    code: '',
    description: '',
    price: inv.subtotal ?? inv.total ?? 0,
    isTaxIncluded: false,
    taxName: taxName(vatPct),
    taxPercentage: vatPct,
    isService: false,
    saveToDb: false,
    quantity: 1,
    measuringUnitName: 'buc',
    currency: inv.currency ?? 'RON',
    exchangeRate: 1,
  }
}

function taxName(pct: number | null | undefined): string {
  switch (pct) {
    case 19: return 'Normala'
    case 9:  return 'Redusa'
    case 5:  return 'Redusa5'
    case 0:  return 'Scutit'
    default: return 'Normala'
  }
}

function splitInvoiceNumber(raw: string): { series: string; number: string } {
  // "FACT-2026-001" → series="FACT", number="2026-001"
  // "FA0089"        → series="FA",   number="0089"
  // "0089"          → series="",     number="0089"
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
