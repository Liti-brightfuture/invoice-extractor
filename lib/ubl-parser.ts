import { XMLParser } from 'fast-xml-parser'

export interface UBLInvoiceData {
  vendor_name: string | null
  vendor_cui: string | null
  vendor_address: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  currency: string
  subtotal: number | null
  vat_amount: number | null
  total: number | null
  line_items: Array<{
    description: string | null
    quantity: number | null
    unit_price: number | null
    vat_rate: number | null
    line_total: number | null
  }>
}

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: true,
  trimValues: true,
})

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function unwrapValue(value: unknown): unknown {
  if (!isRecord(value)) return value
  if ('#text' in value) return value['#text']
  return value
}

function getNode(root: unknown, path: string[]): unknown {
  let current = root
  for (const key of path) {
    if (!isRecord(current)) return null
    current = current[key]
  }
  return current ?? null
}

function getString(root: unknown, path: string[]): string | null {
  const value = unwrapValue(getNode(root, path))
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === 'number') return String(value)
  return null
}

function getNumber(root: unknown, path: string[]): number | null {
  const value = unwrapValue(getNode(root, path))
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.')
    if (!normalized) return null
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function joinAddress(addressNode: unknown): string | null {
  const parts = [
    getString(addressNode, ['cbc:StreetName']),
    getString(addressNode, ['cbc:CityName']),
    getString(addressNode, ['cbc:CountrySubentity']),
  ].filter((part): part is string => Boolean(part))

  return parts.length > 0 ? parts.join(', ') : null
}

function sumTaxAmounts(invoiceNode: unknown): number | null {
  const totals = asArray(getNode(invoiceNode, ['cac:TaxTotal']))
    .map((taxTotal) => getNumber(taxTotal, ['cbc:TaxAmount']))
    .filter((amount): amount is number => amount !== null)

  if (totals.length === 0) return null
  return totals.reduce((sum, amount) => sum + amount, 0)
}

function getFirstPercent(lineNode: unknown): number | null {
  for (const taxTotal of asArray(getNode(lineNode, ['cac:TaxTotal']))) {
    for (const subtotal of asArray(getNode(taxTotal, ['cac:TaxSubtotal']))) {
      const percent = getNumber(subtotal, ['cac:TaxCategory', 'cbc:Percent'])
      if (percent !== null) return percent
    }
  }

  return null
}

function parseLineItem(lineNode: unknown): UBLInvoiceData['line_items'][number] {
  return {
    description:
      getString(lineNode, ['cac:Item', 'cbc:Description']) ??
      getString(lineNode, ['cac:Item', 'cbc:Name']),
    quantity: getNumber(lineNode, ['cbc:InvoicedQuantity']),
    unit_price: getNumber(lineNode, ['cac:Price', 'cbc:PriceAmount']),
    vat_rate: getFirstPercent(lineNode),
    line_total: getNumber(lineNode, ['cbc:LineExtensionAmount']),
  }
}

function stripRoPrefix(value: string | null): string | null {
  if (!value) return null
  return value.replace(/^RO/i, '').trim() || null
}

export function parseUBLInvoice(xmlContent: string): UBLInvoiceData {
  const parsedXml = parser.parse(xmlContent.replace(/^\uFEFF/, ''))
  const invoiceNode = isRecord(parsedXml)
    ? Object.entries(parsedXml).find(([key]) => key === 'Invoice' || key.endsWith(':Invoice'))?.[1]
    : null

  if (!invoiceNode) {
    throw new Error('Fisierul XML nu contine un document UBL Invoice valid.')
  }

  const supplierParty = getNode(invoiceNode, ['cac:AccountingSupplierParty', 'cac:Party'])
  const addressNode = getNode(supplierParty, ['cac:PostalAddress'])
  const lineItems = asArray(getNode(invoiceNode, ['cac:InvoiceLine'])).map(parseLineItem)

  return {
    vendor_name: getString(supplierParty, ['cac:PartyName', 'cbc:Name']),
    vendor_cui: stripRoPrefix(
      getString(supplierParty, ['cac:PartyTaxScheme', 'cbc:CompanyID'])
    ),
    vendor_address: joinAddress(addressNode),
    invoice_number: getString(invoiceNode, ['cbc:ID']),
    invoice_date: getString(invoiceNode, ['cbc:IssueDate']),
    due_date: getString(invoiceNode, ['cbc:DueDate']),
    currency: getString(invoiceNode, ['cbc:DocumentCurrencyCode']) ?? 'RON',
    subtotal: getNumber(invoiceNode, ['cac:LegalMonetaryTotal', 'cbc:TaxExclusiveAmount']),
    vat_amount: sumTaxAmounts(invoiceNode),
    total: getNumber(invoiceNode, ['cac:LegalMonetaryTotal', 'cbc:PayableAmount']),
    line_items: lineItems,
  }
}
