'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import JSZip, { type JSZipObject } from 'jszip'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { Archive, CheckCircle2, FileText, Loader2, Upload, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { extractInvoice } from '@/app/actions/extract-invoice'
import { createInvoiceRecord } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type ImportStatus = 'pending' | 'uploading' | 'done' | 'error'

interface ZipEntryState {
  name: string
  entry: JSZipObject
  status: ImportStatus
  invoiceId: string | null
  error: string | null
}

interface ZipImportButtonProps {
  userId: string
}

function getBaseName(path: string) {
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/')
  return parts[parts.length - 1] ?? path
}

function isXmlEntry(entry: JSZipObject) {
  return !entry.dir && entry.name.toLowerCase().endsWith('.xml')
}

export function ZipImportButton({ userId }: ZipImportButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [zipName, setZipName] = useState<string | null>(null)
  const [entries, setEntries] = useState<ZipEntryState[]>([])
  const [isReadingZip, setIsReadingZip] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const resetState = useCallback(() => {
    if (isImporting) return
    setZipName(null)
    setEntries([])
    setIsReadingZip(false)
  }, [isImporting])

  const loadZip = useCallback(async (file: File) => {
    setIsReadingZip(true)

    try {
      const zip = await JSZip.loadAsync(file)
      const xmlEntries = Object.values(zip.files)
        .filter(isXmlEntry)
        .sort((a, b) => a.name.localeCompare(b.name, 'ro'))

      if (xmlEntries.length === 0) {
        setZipName(file.name)
        setEntries([])
        toast.error('Arhiva nu conține fișiere XML e-Factura.')
        return
      }

      setZipName(file.name)
      setEntries(
        xmlEntries.map((entry) => ({
          name: getBaseName(entry.name),
          entry,
          status: 'pending',
          invoiceId: null,
          error: null,
        }))
      )
    } catch (error) {
      setZipName(null)
      setEntries([])
      toast.error(error instanceof Error ? error.message : 'ZIP invalid.')
    } finally {
      setIsReadingZip(false)
    }
  }, [])

  const onDrop = useCallback(
    async (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length > 0) {
        toast.error('Selectează un fișier ZIP valid.')
        return
      }

      const zipFile = accepted[0]
      if (!zipFile) return

      await loadZip(zipFile)
    },
    [loadZip]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
    },
    maxFiles: 1,
    multiple: false,
    disabled: isReadingZip || isImporting,
  })

  const doneCount = useMemo(
    () => entries.filter((entry) => entry.status === 'done').length,
    [entries]
  )
  const errorCount = useMemo(
    () => entries.filter((entry) => entry.status === 'error').length,
    [entries]
  )

  const handleImport = useCallback(async () => {
    if (entries.length === 0) {
      toast.error('Încarcă mai întâi o arhivă ZIP cu XML-uri.')
      return
    }

    setIsImporting(true)
    const supabase = createClient()

    for (let index = 0; index < entries.length; index += 1) {
      const current = entries[index]

      setEntries((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === index ? { ...item, status: 'uploading', error: null } : item
        )
      )

      try {
        const xmlBlob = await current.entry.async('blob')
        const fileName = current.name
        const storagePath = `${userId}/${crypto.randomUUID()}-${fileName}`

        const { error: uploadError } = await supabase.storage.from('invoices').upload(storagePath, xmlBlob, {
          contentType: 'application/xml',
          upsert: false,
        })

        if (uploadError) throw new Error(uploadError.message)

        const { invoiceId } = await createInvoiceRecord(storagePath, fileName)
        await extractInvoice(invoiceId)

        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .select('status')
          .eq('id', invoiceId)
          .single()

        if (invoiceError) throw new Error(invoiceError.message)
        if (invoice?.status === 'error') throw new Error('Procesarea XML a eșuat.')

        setEntries((prev) =>
          prev.map((item, itemIndex) =>
            itemIndex === index ? { ...item, status: 'done', invoiceId, error: null } : item
          )
        )
      } catch (error) {
        setEntries((prev) =>
          prev.map((item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Import eșuat.',
                }
              : item
          )
        )
      }
    }

    setIsImporting(false)
    router.refresh()
  }, [entries, router, userId])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (!nextOpen) {
        if (doneCount > 0 || errorCount > 0) {
          router.push('/dashboard/invoices')
          router.refresh()
        }
        resetState()
      }
    },
    [doneCount, errorCount, resetState, router]
  )

  return (
    <DialogRoot open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline"><Archive className="size-4" />Import ZIP XML</Button>} />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import batch din ZIP</DialogTitle>
          <DialogDescription>
            Selectează o arhivă ZIP cu facturi XML UBL. Fișierele sunt încărcate și procesate pe rând.
          </DialogDescription>
        </DialogHeader>

        <div
          {...getRootProps()}
          className={cn(
            'border-[1.5px] border-dashed rounded-xl px-6 py-8 text-center cursor-pointer transition-all duration-200',
            isDragActive
              ? 'border-ie-accent bg-ie-accent-light'
              : 'border-ie-border bg-ie-bg hover:border-ie-accent hover:bg-ie-accent-light/40',
            (isReadingZip || isImporting) && 'cursor-not-allowed opacity-70'
          )}
        >
          <input {...getInputProps()} />
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-ie-border bg-ie-surface">
            {isReadingZip ? (
              <Loader2 className="size-4 animate-spin text-ie-accent" />
            ) : (
              <Upload className="size-4 text-ie-muted" />
            )}
          </div>
          <p className="text-sm font-medium text-ie-text">
            {zipName ?? 'Trage ZIP-ul aici sau click pentru a selecta'}
          </p>
          <p className="mt-1 text-xs text-ie-muted">
            Acceptă doar fișiere `.zip`; vor fi importate doar intrările `.xml`.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-ie-muted">
            <span>{entries.length} fișiere XML găsite</span>
            {(doneCount > 0 || errorCount > 0) && (
              <span>
                {doneCount} reușite, {errorCount} cu erori
              </span>
            )}
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {entries.length === 0 ? (
              <div className="rounded-lg border border-ie-border bg-ie-bg px-4 py-3 text-sm text-ie-muted">
                Arhiva încă nu a fost încărcată sau nu conține XML-uri compatibile.
              </div>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.entry.name}
                  className="flex items-start gap-3 rounded-lg border border-ie-border bg-ie-bg px-4 py-3"
                >
                  <FileText className="mt-0.5 size-4 shrink-0 text-ie-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ie-text">{entry.name}</p>
                    <p className="mt-1 text-xs text-ie-muted">
                      {entry.status === 'pending' && 'În așteptare'}
                      {entry.status === 'uploading' && 'Se încarcă și se procesează...'}
                      {entry.status === 'done' && 'Import finalizat'}
                      {entry.status === 'error' && (entry.error ?? 'Import eșuat')}
                    </p>
                    {entry.invoiceId && (
                      <Link
                        href={`/dashboard/invoices/${entry.invoiceId}`}
                        className="mt-2 inline-flex text-xs font-medium text-ie-accent hover:underline"
                      >
                        Deschide factura
                      </Link>
                    )}
                  </div>
                  {entry.status === 'uploading' && <Loader2 className="size-4 shrink-0 animate-spin text-ie-accent" />}
                  {entry.status === 'done' && <CheckCircle2 className="size-4 shrink-0 text-green-600" />}
                  {entry.status === 'error' && <XCircle className="size-4 shrink-0 text-red-500" />}
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost" disabled={isImporting}>Închide</Button>} />
          <Button onClick={handleImport} disabled={entries.length === 0 || isReadingZip || isImporting}>
            {isImporting ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
            Importă
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}
