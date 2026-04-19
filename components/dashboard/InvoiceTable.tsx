'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { Trash2Icon, RefreshCwIcon } from 'lucide-react'
import { deleteInvoices, revalidateANAF } from '@/app/dashboard/invoices/actions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronDown, Download } from 'lucide-react'

export interface InvoiceRow {
  id: string
  vendor_name: string | null
  vendor_cui: string | null
  invoice_number: string | null
  invoice_date: string | null
  total: number | null
  vat_amount: number | null
  confidence_score: number | null
  status: string
  currency: string | null
}

interface Props {
  invoices: InvoiceRow[]
}

const EXPORT_FORMATS = [
  { label: 'Excel',         format: 'excel',     ext: '.xlsx' },
  { label: 'SmartBill',     format: 'smartbill', ext: '.json' },
  { label: 'Saga DBF',      format: 'saga',      ext: '.dbf'  },
  { label: 'WinMentor XML', format: 'winmentor', ext: '.xml'  },
]

export function InvoiceTable({ invoices }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [exportOpen, setExportOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const allSelected = invoices.length > 0 && selected.size === invoices.length

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(invoices.map((i) => i.id)))

  const toggleOne = (id: string) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const handleExport = (format: string) => {
    const ids = selected.size > 0 ? [...selected].join(',') : ''
    window.location.href = `/api/export/${format}${ids ? '?invoice_ids=' + ids : ''}`
    setExportOpen(false)
  }

  const handleDelete = () => {
    setActionError(null)
    startTransition(async () => {
      const { error } = await deleteInvoices([...selected])
      if (error) setActionError(error)
      else setSelected(new Set())
    })
  }

  const handleRevalidate = () => {
    setActionError(null)
    startTransition(async () => {
      const { error } = await revalidateANAF([...selected])
      if (error) setActionError(error)
      else setSelected(new Set())
    })
  }

  return (
    <div>
      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 mb-3 bg-ie-bg border border-ie-border rounded-[10px] flex-wrap">
          <span className="text-[12.5px] text-ie-muted mr-1">{selected.size} selectate</span>
          <button
            onClick={handleRevalidate}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-md border border-ie-border bg-ie-surface text-ie-text hover:bg-ie-bg transition-colors disabled:opacity-50"
          >
            <RefreshCwIcon size={12} />
            Re-validează ANAF
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <Trash2Icon size={12} />
            Șterge
          </button>
          {actionError && <span className="text-[12px] text-red-600 ml-1">{actionError}</span>}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-[14px]">
        <h2 className="text-[15px] font-semibold">
          Facturi recente
          {selected.size > 0 && (
            <span className="ml-2 text-[13px] font-normal text-ie-muted">
              ({selected.size} selectate)
            </span>
          )}
        </h2>

        <div className="flex gap-2">
          {/* Export dropdown */}
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen((o) => !o)}
              className="text-[12.5px] h-auto py-[6px] px-[14px] border-ie-border bg-ie-surface text-ie-text hover:bg-ie-bg font-medium rounded-md flex items-center gap-1.5"
            >
              <Download size={12} />
              Export
              <ChevronDown
                size={11}
                className={cn('transition-transform duration-150', exportOpen && 'rotate-180')}
              />
            </Button>

            {exportOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-ie-surface border border-ie-border rounded-lg shadow-md z-20 overflow-hidden py-1">
                {EXPORT_FORMATS.map(({ label, format, ext }) => (
                  <button
                    key={format}
                    onClick={() => handleExport(format)}
                    className="w-full text-left px-4 py-2 text-[13px] text-ie-text hover:bg-ie-bg transition-colors flex items-center justify-between group"
                  >
                    {label}
                    <span className="font-[family-name:var(--font-dm-mono)] text-[10px] text-ie-muted">
                      {ext}
                    </span>
                  </button>
                ))}
                <p className="px-4 pt-2 pb-1.5 text-[11px] text-ie-muted border-t border-ie-border mt-1">
                  {selected.size > 0
                    ? `${selected.size} factură selectată`
                    : 'Exportă toate facturile'}
                </p>
              </div>
            )}
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center text-[12.5px] h-auto py-[6px] px-[14px] bg-ie-accent hover:bg-ie-accent-hover text-white font-medium rounded-md transition-colors"
          >
            + Factură nouă
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="bg-ie-surface border border-ie-border rounded-[10px] overflow-hidden">
        {invoices.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-ie-muted">
            Nu ai facturi procesate încă. Uploadează primul fișier mai sus.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-ie-bg">
                <TableRow className="border-b border-ie-border hover:bg-transparent">
                  <TableHead className="w-10 py-[11px] pl-4 pr-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="w-[14px] h-[14px] rounded border-ie-border accent-ie-accent cursor-pointer"
                    />
                  </TableHead>
                  {['Furnizor', 'Nr. factură', 'Dată', 'Total', 'TVA', 'Confidence', 'Status', ''].map(
                    (h) => (
                      <TableHead
                        key={h}
                        className="font-[family-name:var(--font-dm-mono)] text-[10.5px] text-ie-muted uppercase tracking-[0.6px] font-medium py-[11px] px-4"
                      >
                        {h}
                      </TableHead>
                    )
                  )}
                </TableRow>
              </TableHeader>

              <TableBody>
                {invoices.map((inv) => (
                  <TableRow
                    key={inv.id}
                    className={cn(
                      'border-b border-ie-border last:border-0 hover:bg-ie-bg transition-colors',
                      selected.has(inv.id) && 'bg-ie-accent-light hover:bg-ie-accent-light'
                    )}
                  >
                    <TableCell className="py-[13px] pl-4 pr-2">
                      <input
                        type="checkbox"
                        checked={selected.has(inv.id)}
                        onChange={() => toggleOne(inv.id)}
                        className="w-[14px] h-[14px] rounded border-ie-border accent-ie-accent cursor-pointer"
                      />
                    </TableCell>

                    <TableCell className="py-[13px] px-4">
                      <p className="font-medium text-[13.5px]">{inv.vendor_name ?? '—'}</p>
                      {inv.vendor_cui && (
                        <p className="font-[family-name:var(--font-dm-mono)] text-[11px] text-ie-muted mt-[1px]">
                          CUI: {inv.vendor_cui}
                        </p>
                      )}
                    </TableCell>

                    <TableCell className="py-[13px] px-4 font-[family-name:var(--font-dm-mono)] text-[12.5px]">
                      {inv.invoice_number ?? '—'}
                    </TableCell>

                    <TableCell className="py-[13px] px-4 text-[13.5px]">
                      {formatDate(inv.invoice_date)}
                    </TableCell>

                    <TableCell className="py-[13px] px-4 text-[13.5px] font-semibold">
                      {formatAmount(inv.total, inv.currency)}
                    </TableCell>

                    <TableCell className="py-[13px] px-4 text-[13.5px]">
                      {formatAmount(inv.vat_amount, inv.currency)}
                    </TableCell>

                    <TableCell className="py-[13px] px-4">
                      {inv.confidence_score != null ? (
                        <ScoreBadge score={inv.confidence_score} />
                      ) : (
                        <span className="text-[12px] text-ie-muted">—</span>
                      )}
                    </TableCell>

                    <TableCell className="py-[13px] px-4">
                      <StatusChip status={inv.status} />
                    </TableCell>

                    <TableCell className="py-[13px] px-4">
                      <Link
                        href={`/dashboard/invoices/${inv.id}`}
                        className="font-[family-name:var(--font-dm-mono)] text-[12.5px] text-ie-accent font-medium hover:underline whitespace-nowrap"
                      >
                        {inv.status === 'review' ? 'Verifică →' : 'Vezi →'}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Subcomponents ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const high = score >= 80
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[5px] font-[family-name:var(--font-dm-mono)] text-[12px] font-medium px-[9px] py-[3px] rounded-full',
        high ? 'bg-ie-green-light text-ie-green' : 'bg-ie-yellow-light text-ie-yellow'
      )}
    >
      <span className={cn('w-[5px] h-[5px] rounded-full', high ? 'bg-ie-green' : 'bg-ie-yellow')} />
      {score}
    </span>
  )
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    validated:  { label: 'Validat',   cls: 'bg-ie-green-light text-ie-green' },
    review:     { label: 'Review',    cls: 'bg-ie-yellow-light text-ie-yellow' },
    processing: { label: 'Procesare', cls: 'bg-ie-border text-ie-muted' },
    error:      { label: 'Eroare',    cls: 'bg-red-50 text-red-600' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-ie-border text-ie-muted' }
  return (
    <span className={cn('text-[11.5px] font-medium px-[9px] py-[3px] rounded-full', cls)}>
      {label}
    </span>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatAmount(n: number | null, currency: string | null): string {
  if (n == null) return '—'
  return `${n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency ?? 'RON'}`
}
