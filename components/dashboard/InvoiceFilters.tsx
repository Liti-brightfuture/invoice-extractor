'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDebounce } from '@/hooks/useDebounce'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import type { Supplier } from '@/types/invoice'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Toate statusurile' },
  { value: 'processing', label: 'În procesare' },
  { value: 'validated', label: 'Validat' },
  { value: 'review', label: 'De revizuit' },
  { value: 'error', label: 'Eroare' },
]

interface Props {
  suppliers: Supplier[]
  currentStatus: string
  currentSupplier: string
  currentFrom: string
  currentTo: string
  currentQ: string
}

export default function InvoiceFilters({
  suppliers,
  currentStatus,
  currentSupplier,
  currentFrom,
  currentTo,
  currentQ,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [status, setStatus] = useState(currentStatus || 'all')
  const [supplier, setSupplier] = useState(currentSupplier || '')
  const [from, setFrom] = useState(currentFrom || '')
  const [to, setTo] = useState(currentTo || '')
  const [q, setQ] = useState(currentQ || '')
  const debouncedQ = useDebounce(q, 300)

  const pushParams = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      const merged: Record<string, string> = { status, supplier, from, to, q: debouncedQ, ...overrides }

      // Reset to page 1 on any filter change
      params.delete('page')

      const paramMap: Record<string, string> = {
        status: merged.status,
        supplier: merged.supplier,
        from: merged.from,
        to: merged.to,
        q: merged.q,
      }

      for (const [k, v] of Object.entries(paramMap)) {
        if (v && v !== 'all') {
          params.set(k, v)
        } else {
          params.delete(k)
        }
      }

      router.push(`/dashboard/invoices?${params.toString()}`)
    },
    [router, searchParams, status, supplier, from, to, debouncedQ]
  )

  // Push URL when debounced search value settles
  useEffect(() => {
    pushParams({ q: debouncedQ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ])

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {/* Status filter */}
      <Select
        value={status}
        onValueChange={(v) => {
          setStatus(v as string)
          pushParams({ status: v as string })
        }}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Supplier filter */}
      <Select
        value={supplier || 'all'}
        onValueChange={(v) => {
          const val = v === 'all' ? '' : (v as string)
          setSupplier(val)
          pushParams({ supplier: val })
        }}
      >
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Toți furnizorii" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toți furnizorii</SelectItem>
          {suppliers.map((s) => (
            <SelectItem key={s.vendor_cui} value={s.vendor_cui}>
              {s.vendor_name ?? s.vendor_cui}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date range */}
      <Input
        type="date"
        className="w-38"
        value={from}
        aria-label="De la dată"
        onChange={(e) => {
          setFrom(e.target.value)
          pushParams({ from: e.target.value })
        }}
      />
      <Input
        type="date"
        className="w-38"
        value={to}
        aria-label="Până la dată"
        onChange={(e) => {
          setTo(e.target.value)
          pushParams({ to: e.target.value })
        }}
      />

      {/* Full-text search */}
      <Input
        type="search"
        placeholder="Caută furnizor, nr. factură..."
        className="w-64"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
    </div>
  )
}
