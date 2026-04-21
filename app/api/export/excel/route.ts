import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'

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
      'id, invoice_number, invoice_date, vendor_name, vendor_cui, subtotal, vat_amount, total, currency, anaf_validated, anaf_active, anaf_vat_payer, confidence_score, status'
    )
    .eq('user_id', user.id)
    .not('status', 'eq', 'processing')
    .order('invoice_date', { ascending: false })

  if (ids.length) q = q.in('id', ids)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'InvoiceExtractor'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Facturi', {
    views: [{ state: 'frozen', ySplit: 1 }] // freeze first row
  })

  // Set up columns
  worksheet.columns = [
    { header: 'Furnizor', key: 'vendor_name', width: 40 },
    { header: 'CUI', key: 'vendor_cui', width: 14 },
    { header: 'Nr. factură', key: 'invoice_number', width: 22 },
    { header: 'Dată', key: 'invoice_date', width: 14 },
    { header: 'Subtotal', key: 'subtotal', width: 16, style: { numFmt: '#,##0.00' } },
    { header: 'TVA', key: 'vat_amount', width: 16, style: { numFmt: '#,##0.00' } },
    { header: 'Total', key: 'total', width: 16, style: { numFmt: '#,##0.00' } },
    { header: 'Monedă', key: 'currency', width: 10 },
    { header: 'Status Extragere', key: 'status', width: 18 },
    { header: 'Scor Încredere', key: 'confidence_score', width: 16 },
    { header: 'Status ANAF', key: 'anaf_status', width: 15 },
    { header: 'Plătitor TVA', key: 'anaf_vat_payer', width: 15 },
  ]

  // Style header row
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4b5563' } // Tailwind gray-600
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  worksheet.getRow(1).height = 24

  worksheet.autoFilter = {
    from: 'A1',
    to: 'L1',
  }

  // Add rows
  ;(data ?? []).forEach((inv) => {
    let anafStatus = 'Nevalidat'
    if (inv.anaf_validated) {
      anafStatus = inv.anaf_active ? 'Activ' : 'Inactiv'
    }

    let vatPayer = ''
    if (inv.anaf_validated) {
      vatPayer = inv.anaf_vat_payer ? 'Da' : 'Nu'
    }

    let statusDisplay = 'Eroare'
    if (inv.status === 'validated') statusDisplay = 'Validat'
    if (inv.status === 'review') statusDisplay = 'Review/Atenție'

    // We can also add dates as real JS dates for Excel so they format properly
    let dateObj = inv.invoice_date ? new Date(inv.invoice_date) : null

    const row = worksheet.addRow({
      vendor_name: inv.vendor_name ?? '',
      vendor_cui: inv.vendor_cui ?? '',
      invoice_number: inv.invoice_number ?? '',
      invoice_date: dateObj,
      subtotal: inv.subtotal ? Number(inv.subtotal) : 0,
      vat_amount: inv.vat_amount ? Number(inv.vat_amount) : 0,
      total: inv.total ? Number(inv.total) : 0,
      currency: inv.currency ?? 'RON',
      status: statusDisplay,
      confidence_score: inv.confidence_score !== null ? `${inv.confidence_score}%` : '',
      anaf_status: anafStatus,
      anaf_vat_payer: vatPayer,
    })

    // Alignment for column content
    row.getCell('invoice_date').numFmt = 'dd.mm.yyyy'
    row.getCell('invoice_date').alignment = { horizontal: 'center' }
    row.getCell('confidence_score').alignment = { horizontal: 'center' }

    // Conditional formatting or simple cell colors for Status
    let anafCell = row.getCell('anaf_status')
    if (anafStatus === 'Activ') anafCell.font = { color: { argb: 'FF16A34A' }, bold: true }
    if (anafStatus === 'Inactiv') anafCell.font = { color: { argb: 'FFDC2626' }, bold: true }

    let statusCell = row.getCell('status')
    if (statusDisplay === 'Validat') statusCell.font = { color: { argb: 'FF16A34A' }, bold: true }
    if (statusDisplay === 'Review/Atenție') statusCell.font = { color: { argb: 'FFD97706' }, bold: true }
  })

  // Add borders to all rows except header
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.eachCell((cell) => {
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        }
      })
    }
  })

  const buffer = await workbook.xlsx.writeBuffer()

  await supabase.from('usage_logs').insert({ user_id: user.id, action: 'export_excel', cost_ron: 0 })

  const exportedIds = (data ?? []).map((inv) => (inv as { id: string }).id)
  if (exportedIds.length > 0) {
    await supabase.from('audit_logs').insert(
      exportedIds.map((invoice_id) => ({
        invoice_id,
        user_id: user.id,
        action: 'export_excel',
        old_values: null,
        new_values: { format: 'excel', batch_size: exportedIds.length },
      }))
    )
  }

  const filename = `facturi-${today()}.xlsx`
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
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
