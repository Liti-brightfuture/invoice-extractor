export type InvoiceStatus = 'processing' | 'validated' | 'review' | 'error'

export interface Invoice {
  id: string
  user_id: string
  file_path: string
  file_name: string
  status: InvoiceStatus
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
  created_at: string
  updated_at: string
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
>

export interface Supplier {
  vendor_cui: string
  vendor_name: string | null
}
