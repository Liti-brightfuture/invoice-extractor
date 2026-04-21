import type {
  ReconciliationCandidate,
  ReconciliationInvoicePreview,
  ReconciliationScoreBreakdown,
} from '@/types/invoice'

export const DUPLICATE_THRESHOLD = 80
export const DATE_WINDOW_DAYS = 3
export const TOTAL_WINDOW_RON = 1

type DiffField = ReconciliationCandidate['different_fields'][number]

export function normalizeInvoiceNumber(value: string | null): string {
  return (value ?? '').toUpperCase().trim().replace(/[\s\-\/\\]+/g, '')
}

export function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0
  if (!left) return right.length
  if (!right) return left.length

  const rows = left.length + 1
  const cols = right.length + 1
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0))

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  return matrix[left.length][right.length]
}

function parseDate(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function dateDifferenceInDays(left: string | null, right: string | null): number | null {
  const leftDate = parseDate(left)
  const rightDate = parseDate(right)
  if (!leftDate || !rightDate) return null

  const diffMs = Math.abs(leftDate.getTime() - rightDate.getTime())
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

function sameTotalWithinWindow(left: number | null, right: number | null): boolean {
  if (left == null || right == null) return false
  return Math.abs(left - right) <= TOTAL_WINDOW_RON
}

export function scoreDuplicatePair(
  left: Pick<ReconciliationInvoicePreview, 'vendor_cui' | 'invoice_number' | 'invoice_date' | 'total'>,
  right: Pick<ReconciliationInvoicePreview, 'vendor_cui' | 'invoice_number' | 'invoice_date' | 'total'>
): { score: number; score_breakdown: ReconciliationScoreBreakdown } {
  const score_breakdown: ReconciliationScoreBreakdown = {
    vendor_cui: left.vendor_cui && right.vendor_cui && left.vendor_cui === right.vendor_cui ? 35 : 0,
    invoice_number: 0,
    total: sameTotalWithinWindow(left.total, right.total) ? 20 : 0,
    invoice_date: 0,
  }

  const normalizedLeft = normalizeInvoiceNumber(left.invoice_number)
  const normalizedRight = normalizeInvoiceNumber(right.invoice_number)
  if (normalizedLeft && normalizedRight && levenshteinDistance(normalizedLeft, normalizedRight) < 2) {
    score_breakdown.invoice_number = 25
  }

  const dayDiff = dateDifferenceInDays(left.invoice_date, right.invoice_date)
  if (dayDiff !== null && dayDiff <= DATE_WINDOW_DAYS) {
    score_breakdown.invoice_date = 20
  }

  const score =
    score_breakdown.vendor_cui +
    score_breakdown.invoice_number +
    score_breakdown.total +
    score_breakdown.invoice_date

  return { score, score_breakdown }
}

export function getDifferentFields(
  left: Pick<ReconciliationInvoicePreview, 'vendor_name' | 'vendor_cui' | 'invoice_number' | 'invoice_date' | 'total' | 'source' | 'file_name'>,
  right: Pick<ReconciliationInvoicePreview, 'vendor_name' | 'vendor_cui' | 'invoice_number' | 'invoice_date' | 'total' | 'source' | 'file_name'>
): DiffField[] {
  const fields: DiffField[] = []

  if ((left.vendor_name ?? '') !== (right.vendor_name ?? '')) fields.push('vendor_name')
  if ((left.vendor_cui ?? '') !== (right.vendor_cui ?? '')) fields.push('vendor_cui')
  if (normalizeInvoiceNumber(left.invoice_number) !== normalizeInvoiceNumber(right.invoice_number)) {
    fields.push('invoice_number')
  }
  if ((left.invoice_date ?? '') !== (right.invoice_date ?? '')) fields.push('invoice_date')
  if ((left.total ?? null) !== (right.total ?? null)) fields.push('total')
  if (left.source !== right.source) fields.push('source')
  if (left.file_name !== right.file_name) fields.push('file_name')

  return fields
}

export function createPairKey(leftId: string, rightId: string): string {
  return [leftId, rightId].sort((a, b) => a.localeCompare(b)).join(':')
}
