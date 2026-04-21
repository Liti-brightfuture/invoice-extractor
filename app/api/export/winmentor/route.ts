import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Format XML import WinMentor — facturi intrări furnizori

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
      `id, invoice_number, invoice_date, due_date, vendor_name, vendor_cui,
       subtotal, vat_amount, total, currency,
       invoice_lines ( line_number, description, quantity, unit_price, vat_rate, line_total )`
    )
    .eq('user_id', user.id)
    .not('status', 'eq', 'processing')
    .order('invoice_date', { ascending: false })

  if (ids.length) q = q.in('id', ids)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const invoiceXml = (data ?? [])
    .map((inv) => {
      const lines = Array.isArray(inv.invoice_lines)
        ? [...inv.invoice_lines].sort((a, b) => (a.line_number ?? 0) - (b.line_number ?? 0))
        : []

      const articoleXml =
        lines.length > 0
          ? lines
              .map(
                (l) => `
      <Articol>
        <Denumire>${esc(l.description ?? 'Produs/serviciu')}</Denumire>
        <UM>buc</UM>
        <Cantitate>${l.quantity ?? 1}</Cantitate>
        <PretUnitar>${fmt(l.unit_price)}</PretUnitar>
        <CotaTVA>${l.vat_rate ?? 19}</CotaTVA>
        <ValLinie>${fmt(l.line_total)}</ValLinie>
      </Articol>`
              )
              .join('')
          : `
      <Articol>
        <Denumire>${esc(inv.vendor_name ?? 'Furnizor')}</Denumire>
        <UM>buc</UM>
        <Cantitate>1</Cantitate>
        <PretUnitar>${fmt(inv.subtotal ?? inv.total)}</PretUnitar>
        <CotaTVA>${inferVatPct(inv.subtotal, inv.vat_amount)}</CotaTVA>
        <ValLinie>${fmt(inv.total)}</ValLinie>
      </Articol>`

      return `
  <Factura>
    <NrDoc>${esc(inv.invoice_number ?? '')}</NrDoc>
    <DataDoc>${wmDate(inv.invoice_date)}</DataDoc>
    <DataScadenta>${wmDate(inv.due_date)}</DataScadenta>
    <TipDoc>I</TipDoc>
    <CodFurnizor>${esc(inv.vendor_cui ?? '')}</CodFurnizor>
    <DenFurnizor>${esc(inv.vendor_name ?? '')}</DenFurnizor>
    <ValFaraTVA>${fmt(inv.subtotal)}</ValFaraTVA>
    <ValTVA>${fmt(inv.vat_amount)}</ValTVA>
    <ValTotal>${fmt(inv.total)}</ValTotal>
    <Moneda>${esc(inv.currency ?? 'RON')}</Moneda>
    <Articole>${articoleXml}
    </Articole>
  </Factura>`
    })
    .join('')

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<ImportFacturi xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" dataExport="${today()}">` +
    invoiceXml +
    `\n</ImportFacturi>\n`

  await supabase
    .from('usage_logs')
    .insert({ user_id: user.id, action: 'export_winmentor', cost_ron: 0 })

  const exportedIds = (data ?? []).map((inv) => (inv as { id: string }).id)
  if (exportedIds.length > 0) {
    await supabase.from('audit_logs').insert(
      exportedIds.map((invoice_id) => ({
        invoice_id,
        user_id: user.id,
        action: 'export_winmentor',
        old_values: null,
        new_values: { format: 'winmentor_xml', batch_size: exportedIds.length },
      }))
    )
  }

  const filename = `winmentor-${today()}.xml`
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmt(n: number | null | undefined): string {
  return (Number(n) || 0).toFixed(2)
}

function wmDate(d: string | null | undefined): string {
  if (!d) return ''
  // WinMentor accepts DD.MM.YYYY
  const date = new Date(d)
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = date.getUTCFullYear()
  return `${dd}.${mm}.${yyyy}`
}

function inferVatPct(subtotal: number | null | undefined, vat: number | null | undefined): number {
  if (!subtotal || !vat || subtotal === 0) return 19
  return Math.round((vat / subtotal) * 100)
}

function parseIds(req: NextRequest): string[] {
  return (req.nextUrl.searchParams.get('invoice_ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function today() {
  return new Date().toISOString().split('T')[0]
}
