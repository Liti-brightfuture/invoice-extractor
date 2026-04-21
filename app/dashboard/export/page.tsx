'use client'

import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import { Download, RefreshCw, PackageOpen, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { generateBatchExport, getExportHistory, redownloadExport } from './actions'
import type { ExportRecord } from '@/types/invoice'

// ─── Constante ───────────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<string, string> = {
  smartbill: 'SmartBill JSON',
  saga:      'Saga DBF',
  winmentor: 'WinMentor XML',
  csv:       'CSV generic',
  efactura:  'XML e-Factura',
}

// ─── Utilitare ────────────────────────────────────────────────────────────────

function currentMonthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    from: from.toISOString().split('T')[0],
    to:   now.toISOString().split('T')[0],
  }
}

function lastMonthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const to   = new Date(now.getFullYear(), now.getMonth(), 0)
  return {
    from: from.toISOString().split('T')[0],
    to:   to.toISOString().split('T')[0],
  }
}

function isExpired(createdAt: string): boolean {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  return new Date(createdAt) <= cutoff
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ro-RO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('ro-RO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function triggerDownload(url: string, filename?: string) {
  const a = document.createElement('a')
  a.href = url
  if (filename) a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// ─── Componentă principală ────────────────────────────────────────────────────

export default function ExportPage() {
  // ── Stare formular export rapid ──
  const [period, setPeriod]             = useState<'current' | 'last' | 'custom'>('current')
  const [customFrom, setCustomFrom]     = useState('')
  const [customTo, setCustomTo]         = useState('')
  const [format, setFormat]             = useState<string>('csv')
  const [onlyValidated, setOnlyValidated] = useState(false)
  const [isPending, startTransition]    = useTransition()

  // ── Stare istoric ──
  const [history, setHistory]           = useState<ExportRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [redownloading, setRedownloading]   = useState<string | null>(null)

  // ── Încarcă istoricul la mount ──
  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    setHistoryLoading(true)
    const result = await getExportHistory()
    setHistoryLoading(false)
    if (result.success) setHistory(result.data)
  }

  // ── Calculează perioadă ──
  function getPeriodDates() {
    if (period === 'current') return currentMonthRange()
    if (period === 'last')    return lastMonthRange()
    return { from: customFrom, to: customTo }
  }

  // ── Generare export ──
  function handleExport() {
    const { from, to } = getPeriodDates()
    if (!from || !to) {
      toast.error('Selectează o perioadă validă.')
      return
    }
    if (from > to) {
      toast.error('Data de început trebuie să fie înainte de data de sfârșit.')
      return
    }

    startTransition(async () => {
      const toastId = toast.loading('Se generează arhiva ZIP…')
      const result = await generateBatchExport({
        periodFrom: from,
        periodTo: to,
        format: format as 'smartbill' | 'saga' | 'winmentor' | 'csv' | 'efactura',
        onlyValidated,
      })

      if (!result.success) {
        toast.error(result.error, { id: toastId })
        return
      }

      toast.success(
        `Export generat: ${result.data.invoiceCount} factur${result.data.invoiceCount === 1 ? 'ă' : 'i'}`,
        { id: toastId }
      )
      triggerDownload(result.data.signedUrl)
      // Reîncarcă istoricul
      loadHistory()
    })
  }

  // ── Re-descărcare export anterior ──
  async function handleRedownload(rec: ExportRecord) {
    if (rec.signedUrl) {
      triggerDownload(rec.signedUrl)
      return
    }
    setRedownloading(rec.id)
    const result = await redownloadExport(rec.id)
    setRedownloading(null)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    triggerDownload(result.data.signedUrl)
  }

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-semibold text-ie-text">Export facturi</h1>
        <p className="mt-1 text-sm text-ie-muted">
          Exportă facturile dintr-o perioadă selectată în format compatibil cu software-ul tău de contabilitate.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECȚIUNEA A — Export rapid
      ════════════════════════════════════════════════════════════════════════ */}
      <section className="rounded-xl border border-ie-border bg-ie-surface p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <PackageOpen size={17} className="text-ie-accent" />
          <h2 className="font-semibold text-[15px] text-ie-text">Export rapid</h2>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {/* Perioadă */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-ie-muted uppercase tracking-wide">
              Perioadă
            </label>
            <Select value={period} onValueChange={(v) => { if (v) setPeriod(v as typeof period) }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Luna curentă</SelectItem>
                <SelectItem value="last">Luna trecută</SelectItem>
                <SelectItem value="custom">Interval custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date custom */}
          {period === 'custom' && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-ie-muted uppercase tracking-wide">
                  De la
                </label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 rounded-md border border-ie-border bg-ie-bg px-3 text-[13.5px] text-ie-text focus:outline-none focus:ring-2 focus:ring-ie-accent/30"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-ie-muted uppercase tracking-wide">
                  Până la
                </label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 rounded-md border border-ie-border bg-ie-bg px-3 text-[13.5px] text-ie-text focus:outline-none focus:ring-2 focus:ring-ie-accent/30"
                />
              </div>
            </>
          )}

          {/* Format */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-ie-muted uppercase tracking-wide">
              Format
            </label>
            <Select value={format} onValueChange={(v) => { if (v) setFormat(v) }}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV generic</SelectItem>
                <SelectItem value="smartbill">SmartBill JSON</SelectItem>
                <SelectItem value="saga">Saga DBF</SelectItem>
                <SelectItem value="winmentor">WinMentor XML</SelectItem>
                <SelectItem value="efactura">XML e-Factura (UBL 2.1)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Checkbox validat */}
          <div className="flex items-center gap-2 h-9 pb-0.5">
            <input
              id="only-validated"
              type="checkbox"
              checked={onlyValidated}
              onChange={(e) => setOnlyValidated(e.target.checked)}
              className="w-4 h-4 rounded border-ie-border accent-ie-accent cursor-pointer"
            />
            <label
              htmlFor="only-validated"
              className="text-[13.5px] text-ie-text cursor-pointer select-none whitespace-nowrap"
            >
              Doar facturi validate
            </label>
          </div>

          {/* Buton export */}
          <Button
            onClick={handleExport}
            disabled={isPending}
            className="h-9 gap-2"
          >
            <Download size={15} />
            {isPending ? 'Se generează…' : 'Descarcă arhivă ZIP'}
          </Button>
        </div>

        {/* Perioadă afișată */}
        {period !== 'custom' && (
          <p className="mt-4 text-[12.5px] text-ie-muted">
            {(() => {
              const { from, to } = getPeriodDates()
              return `Perioadă: ${formatDate(from)} – ${formatDate(to)}`
            })()}
          </p>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECȚIUNEA B — Istoric exporturi
      ════════════════════════════════════════════════════════════════════════ */}
      <section className="rounded-xl border border-ie-border bg-ie-surface shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ie-border">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-ie-muted" />
            <h2 className="font-semibold text-[15px] text-ie-text">Istoric exporturi</h2>
          </div>
          <button
            onClick={loadHistory}
            disabled={historyLoading}
            className="text-ie-muted hover:text-ie-text transition-colors"
            title="Reîncarcă"
          >
            <RefreshCw size={14} className={historyLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {historyLoading ? (
          <div className="py-16 text-center text-sm text-ie-muted">Se încarcă…</div>
        ) : history.length === 0 ? (
          <div className="py-16 text-center text-sm text-ie-muted">
            Niciun export anterior. Generează primul export de mai sus.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-ie-border bg-ie-bg">
                  <th className="px-5 py-3 text-left font-medium text-ie-muted">Dată export</th>
                  <th className="px-5 py-3 text-left font-medium text-ie-muted">Format</th>
                  <th className="px-5 py-3 text-left font-medium text-ie-muted">Perioadă</th>
                  <th className="px-5 py-3 text-right font-medium text-ie-muted">Facturi</th>
                  <th className="px-5 py-3 text-right font-medium text-ie-muted">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ie-border">
                {history.map((rec) => {
                  const expired = isExpired(rec.created_at)
                  const downloading = redownloading === rec.id
                  return (
                    <tr key={rec.id} className="hover:bg-ie-bg/50 transition-colors">
                      <td className="px-5 py-3 text-ie-muted whitespace-nowrap">
                        {formatDateTime(rec.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center rounded-full bg-ie-accent-light px-2.5 py-0.5 text-[12px] font-medium text-ie-accent">
                          {FORMAT_LABELS[rec.format] ?? rec.format}
                        </span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-ie-text">
                        {formatDate(rec.period_from)} – {formatDate(rec.period_to)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-ie-text">
                        {rec.invoice_count}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {expired ? (
                          <span
                            className="text-[12px] text-ie-muted cursor-default"
                            title="Fișierul a fost șters după 30 de zile"
                          >
                            Expirat
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRedownload(rec)}
                            disabled={downloading}
                            className="inline-flex items-center gap-1.5 text-ie-accent hover:text-ie-accent/80 transition-colors disabled:opacity-50 text-[13px] font-medium"
                          >
                            <Download size={13} />
                            {downloading ? 'Se pregătește…' : 'Descarcă din nou'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
