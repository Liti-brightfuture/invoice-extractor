'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { updateInvoice } from './actions'
import type { InvoiceLine, InvoiceEditData } from '@/types/invoice'

interface InvoiceData {
  id: string
  status: string
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
}

interface Props {
  invoice: InvoiceData
  invoiceLines: InvoiceLine[]
}

type EditLine = {
  line_number: number
  description: string
  quantity: string
  unit_price: string
  vat_rate: string
  line_total: string
}

function lineToEdit(line: InvoiceLine, idx: number): EditLine {
  return {
    line_number: idx + 1,
    description: line.description ?? '',
    quantity: line.quantity?.toString() ?? '',
    unit_price: line.unit_price?.toString() ?? '',
    vat_rate: line.vat_rate?.toString() ?? '',
    line_total: line.line_total?.toString() ?? '',
  }
}

function emptyLine(idx: number): EditLine {
  return { line_number: idx + 1, description: '', quantity: '', unit_price: '', vat_rate: '19', line_total: '' }
}

const CURRENCIES = ['RON', 'EUR', 'USD']

export function EditInvoiceForm({ invoice, invoiceLines }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Edit state
  const [vendor_name, setVendorName] = useState(invoice.vendor_name ?? '')
  const [vendor_cui, setVendorCui] = useState(invoice.vendor_cui ?? '')
  const [vendor_address, setVendorAddress] = useState(invoice.vendor_address ?? '')
  const [invoice_number, setInvoiceNumber] = useState(invoice.invoice_number ?? '')
  const [invoice_date, setInvoiceDate] = useState(invoice.invoice_date ?? '')
  const [due_date, setDueDate] = useState(invoice.due_date ?? '')
  const [subtotal, setSubtotal] = useState(invoice.subtotal?.toString() ?? '')
  const [vat_amount, setVatAmount] = useState(invoice.vat_amount?.toString() ?? '')
  const [total, setTotal] = useState(invoice.total?.toString() ?? '')
  const [currency, setCurrency] = useState(invoice.currency ?? 'RON')
  const [lines, setLines] = useState<EditLine[]>(
    invoiceLines.length > 0 ? invoiceLines.map(lineToEdit) : []
  )

  function resetState() {
    setVendorName(invoice.vendor_name ?? '')
    setVendorCui(invoice.vendor_cui ?? '')
    setVendorAddress(invoice.vendor_address ?? '')
    setInvoiceNumber(invoice.invoice_number ?? '')
    setInvoiceDate(invoice.invoice_date ?? '')
    setDueDate(invoice.due_date ?? '')
    setSubtotal(invoice.subtotal?.toString() ?? '')
    setVatAmount(invoice.vat_amount?.toString() ?? '')
    setTotal(invoice.total?.toString() ?? '')
    setCurrency(invoice.currency ?? 'RON')
    setLines(invoiceLines.length > 0 ? invoiceLines.map(lineToEdit) : [])
    setError(null)
  }

  function updateLine(idx: number, field: keyof EditLine, value: string) {
    setLines((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      // Auto-recalculate line_total when quantity or unit_price changes
      if (field === 'quantity' || field === 'unit_price') {
        const qty = parseFloat(field === 'quantity' ? value : next[idx].quantity)
        const price = parseFloat(field === 'unit_price' ? value : next[idx].unit_price)
        if (!isNaN(qty) && !isNaN(price)) {
          next[idx].line_total = (qty * price).toFixed(2)
        }
      }
      return next
    })
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine(prev.length)])
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, line_number: i + 1 })))
  }

  const sub = parseFloat(subtotal)
  const vat = parseFloat(vat_amount)
  const tot = parseFloat(total)
  const sumMismatch =
    !isNaN(sub) && !isNaN(vat) && !isNaN(tot) && Math.abs(sub + vat - tot) > 0.02

  function handleSave() {
    setError(null)
    startTransition(async () => {
      try {
        const data: InvoiceEditData = {
          vendor_name: vendor_name.trim() || null,
          vendor_cui: vendor_cui.trim() || null,
          vendor_address: vendor_address.trim() || null,
          invoice_number: invoice_number.trim() || null,
          invoice_date: invoice_date || null,
          due_date: due_date || null,
          subtotal: subtotal !== '' ? parseFloat(subtotal) : null,
          vat_amount: vat_amount !== '' ? parseFloat(vat_amount) : null,
          total: total !== '' ? parseFloat(total) : null,
          currency,
          lines: lines.map((l, i) => ({
            line_number: i + 1,
            description: l.description || null,
            quantity: l.quantity !== '' ? parseFloat(l.quantity) : null,
            unit_price: l.unit_price !== '' ? parseFloat(l.unit_price) : null,
            vat_rate: l.vat_rate !== '' ? parseFloat(l.vat_rate) : null,
            line_total: l.line_total !== '' ? parseFloat(l.line_total) : null,
          })),
        }
        await updateInvoice(invoice.id, data)
        setEditing(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Eroare necunoscută')
      }
    })
  }

  if (!editing) {
    return (
      <>
        {/* View mode — static rows */}
        <div className="bg-ie-surface border border-ie-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-ie-border bg-ie-bg flex items-center justify-between">
            <p className="font-[family-name:var(--font-dm-mono)] text-[10.5px] text-ie-muted uppercase tracking-[0.6px]">
              Date factură
            </p>
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-[12px] text-ie-accent hover:text-ie-accent-hover font-medium transition-colors"
            >
              <Pencil size={12} />
              Editează
            </button>
          </div>
          <div className="divide-y divide-ie-border">
            <ViewRow label="Furnizor" value={invoice.vendor_name} warning={invoice.status === 'review' && !invoice.vendor_name} />
            <ViewRow label="CUI" value={invoice.vendor_cui} mono warning={invoice.status === 'review' && !invoice.vendor_cui} />
            <ViewRow label="Adresă" value={invoice.vendor_address} warning={invoice.status === 'review' && !invoice.vendor_address} />
            <ViewRow label="Nr. factură" value={invoice.invoice_number} mono warning={invoice.status === 'review' && !invoice.invoice_number} />
            <ViewRow label="Dată emitere" value={invoice.invoice_date} warning={invoice.status === 'review' && !invoice.invoice_date} />
            <ViewRow label="Termen plată" value={invoice.due_date} warning={invoice.status === 'review' && !invoice.due_date} />
          </div>
        </div>

        <div className="bg-ie-surface border border-ie-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-ie-border bg-ie-bg">
            <p className="font-[family-name:var(--font-dm-mono)] text-[10.5px] text-ie-muted uppercase tracking-[0.6px]">
              Totaluri
            </p>
          </div>
          <div className="divide-y divide-ie-border">
            <ViewRow
              label="Subtotal"
              value={invoice.subtotal != null ? `${invoice.subtotal} ${invoice.currency}` : null}
              warning={invoice.status === 'review' && invoice.subtotal == null}
            />
            <ViewRow
              label="TVA"
              value={invoice.vat_amount != null ? `${invoice.vat_amount} ${invoice.currency}` : null}
              warning={invoice.status === 'review' && invoice.vat_amount == null}
            />
            <ViewRow
              label="Total"
              value={invoice.total != null ? `${invoice.total} ${invoice.currency}` : null}
              bold
              warning={invoice.status === 'review' && invoice.total == null}
            />
          </div>
        </div>

        {invoiceLines.length > 0 && (
          <div className="bg-ie-surface border border-ie-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-ie-border bg-ie-bg">
              <p className="font-[family-name:var(--font-dm-mono)] text-[10.5px] text-ie-muted uppercase tracking-[0.6px]">
                Linii factură
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-ie-border bg-ie-bg/50">
                    <th className="text-left px-4 py-2 text-ie-muted font-normal">Descriere</th>
                    <th className="text-right px-3 py-2 text-ie-muted font-normal">Cant.</th>
                    <th className="text-right px-3 py-2 text-ie-muted font-normal">Preț unit.</th>
                    <th className="text-right px-3 py-2 text-ie-muted font-normal">TVA%</th>
                    <th className="text-right px-4 py-2 text-ie-muted font-normal">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ie-border">
                  {invoiceLines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-2.5 text-ie-text">{line.description ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right text-ie-muted font-[family-name:var(--font-dm-mono)]">
                        {line.quantity ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-ie-muted font-[family-name:var(--font-dm-mono)]">
                        {line.unit_price ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-ie-muted font-[family-name:var(--font-dm-mono)]">
                        {line.vat_rate != null ? `${line.vat_rate}%` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium font-[family-name:var(--font-dm-mono)]">
                        {line.line_total ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
    )
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {sumMismatch && (
        <div className="flex items-start gap-2 bg-ie-yellow-light border border-ie-yellow/30 rounded-lg px-4 py-3">
          <AlertTriangle size={14} className="text-ie-yellow mt-0.5 shrink-0" />
          <p className="text-[12px] text-ie-yellow">
            Subtotal + TVA ({!isNaN(sub + vat) ? (sub + vat).toFixed(2) : '?'}) diferă de Total ({tot.toFixed(2)}).
            Verifică sumele înainte de salvare.
          </p>
        </div>
      )}

      {error && (
        <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-ie-surface border border-ie-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-ie-border bg-ie-bg">
          <p className="font-[family-name:var(--font-dm-mono)] text-[10.5px] text-ie-muted uppercase tracking-[0.6px]">
            Date factură
          </p>
        </div>
        <div className="divide-y divide-ie-border">
          <EditRow label="Furnizor" value={vendor_name} onChange={setVendorName} />
          <EditRow label="CUI" value={vendor_cui} onChange={setVendorCui} mono />
          <EditRow label="Adresă" value={vendor_address} onChange={setVendorAddress} />
          <EditRow label="Nr. factură" value={invoice_number} onChange={setInvoiceNumber} mono />
          <EditRow label="Dată emitere" value={invoice_date} onChange={setInvoiceDate} type="date" />
          <EditRow label="Termen plată" value={due_date} onChange={setDueDate} type="date" />
        </div>
      </div>

      <div className="bg-ie-surface border border-ie-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-ie-border bg-ie-bg">
          <p className="font-[family-name:var(--font-dm-mono)] text-[10.5px] text-ie-muted uppercase tracking-[0.6px]">
            Totaluri
          </p>
        </div>
        <div className="divide-y divide-ie-border">
          <EditRow label="Subtotal" value={subtotal} onChange={setSubtotal} type="number" />
          <EditRow label="TVA" value={vat_amount} onChange={setVatAmount} type="number" />
          <EditRow label="Total" value={total} onChange={setTotal} type="number" bold />
          <div className="flex items-center justify-between px-5 py-3 gap-4">
            <span className="text-[13px] text-ie-muted shrink-0">Monedă</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="text-[13px] border border-ie-border rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-ie-accent/30 focus:border-ie-accent font-[family-name:var(--font-dm-mono)]"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-ie-surface border border-ie-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-ie-border bg-ie-bg flex items-center justify-between">
          <p className="font-[family-name:var(--font-dm-mono)] text-[10.5px] text-ie-muted uppercase tracking-[0.6px]">
            Linii factură
          </p>
          <button
            onClick={addLine}
            className="flex items-center gap-1 text-[12px] text-ie-accent hover:text-ie-accent-hover font-medium transition-colors"
          >
            <Plus size={13} />
            Adaugă linie
          </button>
        </div>
        {lines.length === 0 ? (
          <p className="px-5 py-4 text-[13px] text-ie-muted italic">Nicio linie. Apasă „Adaugă linie".</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-ie-border bg-ie-bg/50">
                  <th className="text-left px-3 py-2 text-ie-muted font-normal">Descriere</th>
                  <th className="text-right px-2 py-2 text-ie-muted font-normal w-20">Cant.</th>
                  <th className="text-right px-2 py-2 text-ie-muted font-normal w-24">Preț unit.</th>
                  <th className="text-right px-2 py-2 text-ie-muted font-normal w-16">TVA%</th>
                  <th className="text-right px-2 py-2 text-ie-muted font-normal w-24">Total linie</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ie-border">
                {lines.map((line, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-1.5">
                      <input
                        value={line.description}
                        onChange={(e) => updateLine(idx, 'description', e.target.value)}
                        className="w-full px-2 py-1 text-[12px] border border-ie-border rounded bg-white focus:outline-none focus:ring-1 focus:ring-ie-accent/30 focus:border-ie-accent"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                        className="w-full px-2 py-1 text-[12px] text-right border border-ie-border rounded bg-white focus:outline-none focus:ring-1 focus:ring-ie-accent/30 focus:border-ie-accent font-[family-name:var(--font-dm-mono)]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        value={line.unit_price}
                        onChange={(e) => updateLine(idx, 'unit_price', e.target.value)}
                        className="w-full px-2 py-1 text-[12px] text-right border border-ie-border rounded bg-white focus:outline-none focus:ring-1 focus:ring-ie-accent/30 focus:border-ie-accent font-[family-name:var(--font-dm-mono)]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        value={line.vat_rate}
                        onChange={(e) => updateLine(idx, 'vat_rate', e.target.value)}
                        className="w-full px-2 py-1 text-[12px] text-right border border-ie-border rounded bg-white focus:outline-none focus:ring-1 focus:ring-ie-accent/30 focus:border-ie-accent font-[family-name:var(--font-dm-mono)]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        value={line.line_total}
                        onChange={(e) => updateLine(idx, 'line_total', e.target.value)}
                        className="w-full px-2 py-1 text-[12px] text-right border border-ie-border rounded bg-white focus:outline-none focus:ring-1 focus:ring-ie-accent/30 focus:border-ie-accent font-[family-name:var(--font-dm-mono)]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => removeLine(idx)}
                        className="p-1 text-ie-muted hover:text-red-500 transition-colors"
                        title="Șterge linie"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          onClick={() => { resetState(); setEditing(false) }}
          disabled={isPending}
          className="px-4 py-2 text-[13px] text-ie-muted hover:text-ie-text transition-colors disabled:opacity-50"
        >
          Anulează
        </button>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2 bg-ie-accent hover:bg-ie-accent-hover text-white text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {isPending ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Se salvează...
            </>
          ) : (
            <>
              <CheckCircle2 size={14} />
              Salvează
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Subcomponente ──────────────────────────────────────────────────────────────

function ViewRow({
  label,
  value,
  mono = false,
  bold = false,
  warning = false,
}: {
  label: string
  value: string | number | null | undefined
  mono?: boolean
  bold?: boolean
  warning?: boolean
}) {
  return (
    <div
      className={[
        'flex items-start justify-between px-5 py-3 gap-4',
        warning ? 'bg-ie-yellow-light/50' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="flex items-center gap-2">
        <span className="text-[13px] text-ie-muted shrink-0">{label}</span>
        {warning && <div className="w-1.5 h-1.5 rounded-full bg-ie-yellow animate-pulse shrink-0" />}
      </div>
      <span
        className={[
          'text-[13px] text-right',
          mono ? 'font-[family-name:var(--font-dm-mono)]' : '',
          bold ? 'font-semibold text-ie-text' : 'text-ie-text',
          !value ? 'text-ie-muted italic' : '',
          warning ? 'text-ie-yellow-dark font-medium' : '',
        ].filter(Boolean).join(' ')}
      >
        {value ?? '—'}
      </span>
    </div>
  )
}

function EditRow({
  label,
  value,
  onChange,
  mono = false,
  bold = false,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  mono?: boolean
  bold?: boolean
  type?: string
}) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5 gap-4">
      <span className="text-[13px] text-ie-muted shrink-0 w-28">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={[
          'flex-1 text-[13px] text-right border border-ie-border rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-ie-accent/30 focus:border-ie-accent transition-colors',
          mono ? 'font-[family-name:var(--font-dm-mono)]' : '',
          bold ? 'font-semibold' : '',
        ].filter(Boolean).join(' ')}
      />
    </div>
  )
}
