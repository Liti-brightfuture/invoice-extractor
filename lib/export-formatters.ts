/**
 * Funcții pure de formatare pentru export batch.
 * Primesc un array de facturi și returnează conținut gata de ambalat în ZIP.
 *
 * Logica de bază extrasă din:
 *   app/api/export/smartbill/route.ts
 *   app/api/export/saga/route.ts
 *   app/api/export/winmentor/route.ts
 */

import { DBFFile } from 'dbffile'
import type { FieldDescriptor } from 'dbffile'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'

// ─── Tipuri ──────────────────────────────────────────────────────────────────

export interface InvoiceLine {
  line_number: number | null
  description: string | null
  quantity: number | null
  unit_price: number | null
  vat_rate: number | null
  line_total: number | null
}

export interface InvoiceForExport {
  id: string
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  vendor_name: string | null
  vendor_cui: string | null
  vendor_address: string | null
  subtotal: number | null
  vat_amount: number | null
  total: number | null
  currency: string | null
  invoice_lines?: InvoiceLine[] | null
}

export interface WinMentorResult {
  /** Un XML per factură */
  xmlFiles: { name: string; content: string }[]
  /** Fișier index CSV cu toate facturile */
  indexCsv: string
}

export interface EFacturaResult {
  /** Un XML UBL 2.1 per factură */
  xmlFiles: { name: string; content: string }[]
}

// ─── SmartBill JSON ───────────────────────────────────────────────────────────

export function formatSmartBill(invoices: InvoiceForExport[]): Buffer {
  const data = invoices.map((inv) => {
    const lines = sortedLines(inv)
    const products =
      lines.length > 0
        ? lines.map((l) => buildSmartBillProduct(l, inv.currency ?? 'RON'))
        : [syntheticSmartBillProduct(inv)]

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

  return Buffer.from(JSON.stringify(data, null, 2), 'utf-8')
}

function buildSmartBillProduct(
  line: InvoiceLine,
  currency: string
) {
  return {
    name: line.description ?? 'Produs',
    code: '',
    description: '',
    price: line.unit_price ?? 0,
    isTaxIncluded: false,
    taxName: smartBillTaxName(line.vat_rate),
    taxPercentage: line.vat_rate ?? 19,
    isService: false,
    saveToDb: false,
    quantity: line.quantity ?? 1,
    measuringUnitName: 'buc',
    currency,
    exchangeRate: 1,
  }
}

function syntheticSmartBillProduct(inv: InvoiceForExport) {
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
    taxName: smartBillTaxName(vatPct),
    taxPercentage: vatPct,
    isService: false,
    saveToDb: false,
    quantity: 1,
    measuringUnitName: 'buc',
    currency: inv.currency ?? 'RON',
    exchangeRate: 1,
  }
}

function smartBillTaxName(pct: number | null | undefined): string {
  switch (pct) {
    case 19: return 'Normala'
    case 9:  return 'Redusa'
    case 5:  return 'Redusa5'
    case 0:  return 'Scutit'
    default: return 'Normala'
  }
}

// ─── Saga DBF ─────────────────────────────────────────────────────────────────

const SAGA_FIELDS: FieldDescriptor[] = [
  { name: 'DATA',       type: 'D', size: 8 },
  { name: 'SERIE',      type: 'C', size: 10 },
  { name: 'NUMAR',      type: 'C', size: 20 },
  { name: 'CUI_F',      type: 'C', size: 13 },
  { name: 'DENUMIRE_F', type: 'C', size: 60 },
  { name: 'VALOARE',    type: 'N', size: 12, decimalPlaces: 2 },
  { name: 'TVA',        type: 'N', size: 12, decimalPlaces: 2 },
  { name: 'TOTAL',      type: 'N', size: 12, decimalPlaces: 2 },
]

export async function formatSaga(invoices: InvoiceForExport[]): Promise<Buffer> {
  const records = invoices.map((inv) => {
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

  const tmpPath = path.join(os.tmpdir(), `saga-batch-${crypto.randomUUID()}.dbf`)
  try {
    const dbf = await DBFFile.create(tmpPath, SAGA_FIELDS, { fileVersion: 0x03, encoding: 'win1250' })
    await dbf.appendRecords(records)
    return await fs.readFile(tmpPath)
  } finally {
    await fs.unlink(tmpPath).catch(() => {})
  }
}

// ─── WinMentor XML ────────────────────────────────────────────────────────────

export function formatWinMentor(invoices: InvoiceForExport[]): WinMentorResult {
  const today = new Date().toISOString().split('T')[0]
  const xmlFiles: { name: string; content: string }[] = []
  const csvRows: string[] = [
    '"Nr","Nr.Factură","Dată","Furnizor","CUI","Subtotal","TVA","Total","Monedă"',
  ]

  invoices.forEach((inv, idx) => {
    const lines = sortedLines(inv)
    const articoleXml =
      lines.length > 0
        ? lines
            .map(
              (l) => `
      <Articol>
        <Denumire>${wmEsc(l.description ?? 'Produs/serviciu')}</Denumire>
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
        <Denumire>${wmEsc(inv.vendor_name ?? 'Furnizor')}</Denumire>
        <UM>buc</UM>
        <Cantitate>1</Cantitate>
        <PretUnitar>${fmt(inv.subtotal ?? inv.total)}</PretUnitar>
        <CotaTVA>${inferVatPct(inv.subtotal, inv.vat_amount)}</CotaTVA>
        <ValLinie>${fmt(inv.total)}</ValLinie>
      </Articol>`

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<ImportFacturi xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" dataExport="${today}">\n` +
      `  <Factura>\n` +
      `    <NrDoc>${wmEsc(inv.invoice_number ?? '')}</NrDoc>\n` +
      `    <DataDoc>${wmDate(inv.invoice_date)}</DataDoc>\n` +
      `    <DataScadenta>${wmDate(inv.due_date)}</DataScadenta>\n` +
      `    <TipDoc>I</TipDoc>\n` +
      `    <CodFurnizor>${wmEsc(inv.vendor_cui ?? '')}</CodFurnizor>\n` +
      `    <DenFurnizor>${wmEsc(inv.vendor_name ?? '')}</DenFurnizor>\n` +
      `    <ValFaraTVA>${fmt(inv.subtotal)}</ValFaraTVA>\n` +
      `    <ValTVA>${fmt(inv.vat_amount)}</ValTVA>\n` +
      `    <ValTotal>${fmt(inv.total)}</ValTotal>\n` +
      `    <Moneda>${wmEsc(inv.currency ?? 'RON')}</Moneda>\n` +
      `    <Articole>${articoleXml}\n    </Articole>\n` +
      `  </Factura>\n` +
      `</ImportFacturi>\n`

    const safeName = safeFilename(inv.invoice_number ?? `factura-${idx + 1}`)
    xmlFiles.push({ name: `xml/${safeName}.xml`, content: xml })

    csvRows.push(
      [
        idx + 1,
        inv.invoice_number ?? '',
        inv.invoice_date ?? '',
        inv.vendor_name ?? '',
        inv.vendor_cui ?? '',
        inv.subtotal ?? 0,
        inv.vat_amount ?? 0,
        inv.total ?? 0,
        inv.currency ?? 'RON',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
  })

  return { xmlFiles, indexCsv: csvRows.join('\r\n') }
}

// ─── CSV generic ──────────────────────────────────────────────────────────────

export function formatCsv(invoices: InvoiceForExport[]): Buffer {
  const headers = [
    'Nr. Factură', 'Dată', 'Scadență',
    'Furnizor', 'CUI', 'Adresă',
    'Subtotal', 'TVA', 'Total', 'Monedă',
  ]
  const rows = invoices.map((inv) =>
    [
      inv.invoice_number ?? '',
      inv.invoice_date ?? '',
      inv.due_date ?? '',
      inv.vendor_name ?? '',
      inv.vendor_cui ?? '',
      inv.vendor_address ?? '',
      inv.subtotal ?? '',
      inv.vat_amount ?? '',
      inv.total ?? '',
      inv.currency ?? 'RON',
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  )
  const csv = [headers.map((h) => `"${h}"`).join(','), ...rows].join('\r\n')
  return Buffer.from('\uFEFF' + csv, 'utf-8') // BOM pentru Excel
}

// ─── XML e-Factura (UBL 2.1 simplificat) ─────────────────────────────────────

export function formatEFactura(invoices: InvoiceForExport[]): EFacturaResult {
  const xmlFiles: { name: string; content: string }[] = []

  invoices.forEach((inv, idx) => {
    const lines = sortedLines(inv)
    const currency = inv.currency ?? 'RON'
    const vatPct = inferVatPct(inv.subtotal, inv.vat_amount)

    const invoiceLines =
      lines.length > 0
        ? lines
            .map(
              (l, i) =>
                `  <cac:InvoiceLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">${l.quantity ?? 1}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${currency}">${fmt(l.line_total)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>${ublEsc(l.description ?? 'Produs/serviciu')}</cbc:Description>
      <cac:ClassifiedTaxCategory>
        <cbc:Percent>${l.vat_rate ?? 19}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${currency}">${fmt(l.unit_price)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`
            )
            .join('\n')
        : `  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${currency}">${fmt(inv.subtotal ?? inv.total)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>${ublEsc(inv.vendor_name ?? 'Servicii/bunuri')}</cbc:Description>
      <cac:ClassifiedTaxCategory>
        <cbc:Percent>${vatPct}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${currency}">${fmt(inv.subtotal ?? inv.total)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"\n` +
      `         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"\n` +
      `         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">\n` +
      `  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>\n` +
      `  <cbc:ID>${ublEsc(inv.invoice_number ?? `${idx + 1}`)}</cbc:ID>\n` +
      `  <cbc:IssueDate>${inv.invoice_date ?? ''}</cbc:IssueDate>\n` +
      (inv.due_date ? `  <cbc:DueDate>${inv.due_date}</cbc:DueDate>\n` : '') +
      `  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>\n` +
      `  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>\n` +
      `  <cac:AccountingSupplierParty>\n` +
      `    <cac:Party>\n` +
      `      <cac:PartyName><cbc:Name>${ublEsc(inv.vendor_name ?? '')}</cbc:Name></cac:PartyName>\n` +
      (inv.vendor_cui
        ? `      <cac:PartyTaxScheme>\n` +
          `        <cbc:CompanyID>RO${inv.vendor_cui.replace(/^RO/i, '')}</cbc:CompanyID>\n` +
          `        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>\n` +
          `      </cac:PartyTaxScheme>\n`
        : '') +
      `    </cac:Party>\n` +
      `  </cac:AccountingSupplierParty>\n` +
      `  <cac:TaxTotal>\n` +
      `    <cbc:TaxAmount currencyID="${currency}">${fmt(inv.vat_amount)}</cbc:TaxAmount>\n` +
      `    <cac:TaxSubtotal>\n` +
      `      <cbc:TaxableAmount currencyID="${currency}">${fmt(inv.subtotal)}</cbc:TaxableAmount>\n` +
      `      <cbc:TaxAmount currencyID="${currency}">${fmt(inv.vat_amount)}</cbc:TaxAmount>\n` +
      `      <cac:TaxCategory>\n` +
      `        <cbc:Percent>${vatPct}</cbc:Percent>\n` +
      `        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>\n` +
      `      </cac:TaxCategory>\n` +
      `    </cac:TaxSubtotal>\n` +
      `  </cac:TaxTotal>\n` +
      `  <cac:LegalMonetaryTotal>\n` +
      `    <cbc:TaxExclusiveAmount currencyID="${currency}">${fmt(inv.subtotal)}</cbc:TaxExclusiveAmount>\n` +
      `    <cbc:TaxInclusiveAmount currencyID="${currency}">${fmt(inv.total)}</cbc:TaxInclusiveAmount>\n` +
      `    <cbc:PayableAmount currencyID="${currency}">${fmt(inv.total)}</cbc:PayableAmount>\n` +
      `  </cac:LegalMonetaryTotal>\n` +
      invoiceLines + '\n' +
      `</Invoice>\n`

    const safeName = safeFilename(inv.invoice_number ?? `factura-${idx + 1}`)
    xmlFiles.push({ name: `xml/${safeName}.xml`, content: xml })
  })

  return { xmlFiles }
}

// ─── Utilitare comune ─────────────────────────────────────────────────────────

export function splitInvoiceNumber(raw: string): { series: string; number: string } {
  const dashMatch = raw.match(/^([A-Za-z]+)-(.+)$/)
  if (dashMatch) return { series: dashMatch[1], number: dashMatch[2] }
  const alphaNumMatch = raw.match(/^([A-Za-z]+)(\d+.*)$/)
  if (alphaNumMatch) return { series: alphaNumMatch[1], number: alphaNumMatch[2] }
  return { series: '', number: raw }
}

function sortedLines(inv: InvoiceForExport): InvoiceLine[] {
  if (!Array.isArray(inv.invoice_lines) || inv.invoice_lines.length === 0) return []
  return [...inv.invoice_lines].sort((a, b) => (a.line_number ?? 0) - (b.line_number ?? 0))
}

function fmt(n: number | null | undefined): string {
  return (Number(n) || 0).toFixed(2)
}

function wmDate(d: string | null | undefined): string {
  if (!d) return ''
  const date = new Date(d)
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${date.getUTCFullYear()}`
}

function inferVatPct(subtotal: number | null | undefined, vat: number | null | undefined): number {
  if (!subtotal || !vat || subtotal === 0) return 19
  return Math.round((vat / subtotal) * 100)
}

function wmEsc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function ublEsc(s: string): string {
  return wmEsc(s) // același escape pentru UBL
}

/** Sanitizează un string pentru a fi folosit ca nume de fișier */
function safeFilename(s: string): string {
  return s.replace(/[^A-Za-z0-9_\-\.]/g, '_').slice(0, 80)
}
