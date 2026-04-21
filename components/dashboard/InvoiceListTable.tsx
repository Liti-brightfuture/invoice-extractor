'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Menu } from '@base-ui/react/menu'
import { ChevronDownIcon, Trash2Icon, RefreshCwIcon, DownloadIcon } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { deleteInvoices, revalidateANAF } from '@/app/dashboard/invoices/actions'
import type { InvoiceRow, InvoiceStatus } from '@/types/invoice'

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  processing: { label: 'Procesare',   className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  validated:  { label: 'Validat',     className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  review:     { label: 'De revizuit', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  error:      { label: 'Eroare',      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return dateStr
  }
}

interface Props {
  invoices: InvoiceRow[]
  count: number
  page: number
  pageSize: number
}

export default function InvoiceTable({ invoices, count, page, pageSize }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  const allSelected = invoices.length > 0 && selectedIds.size === invoices.length
  const someSelected = selectedIds.size > 0 && !allSelected

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(invoices.map((i) => i.id)))
  }

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const triggerExport = (format: 'csv' | 'smartbill' | 'saga') => {
    const ids = [...selectedIds].join(',')
    window.location.href = `/api/invoices/export?ids=${ids}&format=${format}`
  }

  const handleDelete = () => {
    setActionError(null)
    startTransition(async () => {
      const { error } = await deleteInvoices([...selectedIds])
      if (error) {
        setActionError(error)
      } else {
        setSelectedIds(new Set())
      }
    })
  }

  const handleRevalidate = () => {
    setActionError(null)
    startTransition(async () => {
      const { error } = await revalidateANAF([...selectedIds])
      if (error) {
        setActionError(error)
      } else {
        setSelectedIds(new Set())
      }
    })
  }

  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(newPage))
    router.push(`/dashboard/invoices?${params.toString()}`)
  }

  return (
    <div>
      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-muted rounded-lg border border-border flex-wrap">
          <span className="text-sm text-muted-foreground mr-1">
            {selectedIds.size} {selectedIds.size === 1 ? 'selectată' : 'selectate'}
          </span>

          {/* Export dropdown via @base-ui/react/menu */}
          <Menu.Root>
            <Menu.Trigger
              render={
                <Button variant="outline" size="sm" className="gap-1">
                  <DownloadIcon className="size-3.5" />
                  Export
                  <ChevronDownIcon className="size-3.5" />
                </Button>
              }
            />
            <Menu.Portal>
              <Menu.Positioner sideOffset={4}>
                <Menu.Popup className="z-50 min-w-36 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 p-1 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
                  <Menu.Item
                    className="flex w-full cursor-default items-center rounded-md px-2 py-1.5 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground"
                    onClick={() => triggerExport('csv')}
                  >
                    Export CSV
                  </Menu.Item>
                  <Menu.Item
                    className="flex w-full cursor-default items-center rounded-md px-2 py-1.5 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground"
                    onClick={() => triggerExport('smartbill')}
                  >
                    Export SmartBill
                  </Menu.Item>
                  <Menu.Item
                    className="flex w-full cursor-default items-center rounded-md px-2 py-1.5 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground"
                    onClick={() => triggerExport('saga')}
                  >
                    Export Saga
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            disabled={isPending}
            onClick={handleRevalidate}
          >
            <RefreshCwIcon className="size-3.5" />
            Re-validează ANAF
          </Button>

          <Button
            variant="destructive"
            size="sm"
            className="gap-1"
            disabled={isPending}
            onClick={handleDelete}
          >
            <Trash2Icon className="size-3.5" />
            Șterge
          </Button>

          {actionError && (
            <span className="text-sm text-destructive ml-2">{actionError}</span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Selectează toate"
                />
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-10">
                #
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Furnizor
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Nr. factură
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Dată
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Total
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, i) => {
              const statusCfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.processing
              return (
                <tr
                  key={inv.id}
                  className={cn(
                    'border-t border-border transition-colors hover:bg-muted/40',
                    selectedIds.has(inv.id) && 'bg-primary/5'
                  )}
                >
                  <td className="px-3 py-2.5">
                    <Checkbox
                      checked={selectedIds.has(inv.id)}
                      onCheckedChange={() => toggleOne(inv.id)}
                      aria-label={`Selectează factura ${inv.invoice_number ?? inv.id}`}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground tabular-nums">
                    {(page - 1) * pageSize + i + 1}
                  </td>
                  <td className="px-3 py-2.5 font-medium max-w-48 truncate">
                    {inv.vendor_name ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    {inv.invoice_number ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {inv.invoice_date
                      ? formatDate(inv.invoice_date)
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                    {inv.total != null
                      ? `${Number(inv.total).toFixed(2)} ${inv.currency}`
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', statusCfg.className)}>
                        {statusCfg.label}
                      </span>
                      {inv.source === 'xml' && (
                        <span className="inline-flex px-[9px] py-[3px] rounded-full text-[11.5px] font-medium bg-emerald-100 text-emerald-700">
                          XML e-Factura
                        </span>
                      )}
                      {inv.linked_invoice_id && (
                        <span className="inline-flex px-[9px] py-[3px] rounded-full text-[11.5px] font-medium bg-sky-100 text-sky-700">
                          Legată cu XML
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
        <span className="text-sm text-muted-foreground">
          {count} {count === 1 ? 'factură' : 'facturi'} total
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            ← Anterior
          </Button>
          <span className="text-sm text-muted-foreground px-1">
            Pagina {page} din {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Următor →
          </Button>
        </div>
      </div>
    </div>
  )
}
