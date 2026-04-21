export type InvoiceStatus = 'processing' | 'validated' | 'review' | 'error'
export type InvoiceSource = 'pdf' | 'image' | 'xml'

export interface Invoice {
  id: string
  user_id: string
  file_path: string
  file_name: string
  status: InvoiceStatus
  source: InvoiceSource
  linked_invoice_id: string | null
  archived_at: string | null
  archived_reason: 'duplicate_pdf_kept_xml' | null
  vendor_name: string | null
  vendor_cui: string | null
  vendor_address: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  subtotal: number | null
  vat_amount: number | null
  total: number | null
  currency: string
  anaf_validated: boolean
  anaf_vat_payer: boolean | null
  anaf_active: boolean | null
  anaf_validated_at: string | null
  confidence_score: number | null
  ai_raw_response: Record<string, unknown> | null
  processing_time_ms: number | null
  error_code: string | null
  error_message: string | null
  reprocess_count: number
  exported_at: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceLine {
  id: string
  invoice_id: string
  line_number: number
  description: string | null
  quantity: number | null
  unit_price: number | null
  vat_rate: number | null
  line_total: number | null
}

export interface InvoiceEditData {
  vendor_name: string | null
  vendor_cui: string | null
  vendor_address: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  subtotal: number | null
  vat_amount: number | null
  total: number | null
  currency: string
  lines: Array<Omit<InvoiceLine, 'id' | 'invoice_id'>>
}

export interface AuditLog {
  id: string
  invoice_id: string
  user_id: string
  action: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: string
}

export type InvoiceRow = Pick<
  Invoice,
  | 'id'
  | 'status'
  | 'vendor_name'
  | 'vendor_cui'
  | 'invoice_number'
  | 'invoice_date'
  | 'total'
  | 'currency'
  | 'created_at'
  | 'source'
  | 'linked_invoice_id'
>

export interface Supplier {
  vendor_cui: string
  vendor_name: string | null
}

export interface SupplierFull {
  id: string
  user_id: string
  cui: string
  name: string | null
  address: string | null
  anaf_vat_payer: boolean | null
  anaf_active: boolean | null
  anaf_last_check: string | null
  created_at: string
}

export type ExportFormat = 'smartbill' | 'saga' | 'winmentor' | 'csv' | 'efactura'

export interface ExportRecord {
  id: string
  user_id: string
  format: ExportFormat
  period_from: string
  period_to: string
  invoice_count: number
  file_path: string | null
  created_at: string
  /** URL semnat generat la cerere — nu e stocat în DB */
  signedUrl?: string
}

export interface ReconciliationInvoicePreview {
  id: string
  file_name: string
  file_path: string
  source: InvoiceSource
  vendor_name: string | null
  vendor_cui: string | null
  invoice_number: string | null
  invoice_date: string | null
  total: number | null
  currency: string
  linked_invoice_id: string | null
  archived_at: string | null
  signed_url?: string
}

export interface ReconciliationScoreBreakdown {
  vendor_cui: number
  invoice_number: number
  total: number
  invoice_date: number
}

export interface ReconciliationCandidate {
  pair_key: string
  left: ReconciliationInvoicePreview
  right: ReconciliationInvoicePreview
  score: number
  score_breakdown: ReconciliationScoreBreakdown
  different_fields: Array<'vendor_name' | 'vendor_cui' | 'invoice_number' | 'invoice_date' | 'total' | 'source' | 'file_name'>
}

export interface ReconciliationConfirmedPair {
  pair_key: string
  xml_invoice: ReconciliationInvoicePreview
  pdf_invoice: ReconciliationInvoicePreview
}
