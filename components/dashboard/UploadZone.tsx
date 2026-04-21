'use client'

import { useCallback, useState } from 'react'
import { useDropzone, FileRejection } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import { Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { createInvoiceRecord } from '@/app/dashboard/actions'

const ALLOWED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/xml',
  'text/xml',
] as const
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

const formats = ['PDF', 'PNG / JPG', 'XML e-Factura', 'TIFF']

interface UploadZoneProps {
  userId: string
}

export function UploadZone({ userId }: UploadZoneProps) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)

  const handleUpload = useCallback(
    async (file: File) => {
      // Validare MIME reală (File.type setat de browser pe baza content-ului)
      if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) {
        toast.error('Format neacceptat. Folosește PDF, PNG, JPG sau XML e-Factura.')
        return
      }

      setUploading(true)
      try {
        const supabase = createClient()
        const uniqueName = `${userId}/${crypto.randomUUID()}-${file.name}`

        const { error: storageError } = await supabase.storage
          .from('invoices')
          .upload(uniqueName, file, { contentType: file.type, upsert: false })

        if (storageError) throw new Error(storageError.message)

        const { invoiceId } = await createInvoiceRecord(uniqueName, file.name)

        toast.success('Factură încărcată cu succes!')
        router.push(`/dashboard/invoices/${invoiceId}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Eroare la încărcare.')
      } finally {
        setUploading(false)
      }
    },
    [userId, router]
  )

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length > 0) {
        const err = rejected[0].errors[0]
        if (err.code === 'file-too-large') {
          toast.error('Fișierul depășește limita de 10MB.')
        } else if (err.code === 'file-invalid-type') {
          toast.error('Format neacceptat. Folosește PDF, PNG, JPG sau XML e-Factura.')
        } else {
          toast.error(err.message)
        }
        return
      }
      if (accepted[0]) handleUpload(accepted[0])
    },
    [handleUpload]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'application/xml': ['.xml'],
      'text/xml': ['.xml'],
    },
    maxSize: MAX_SIZE,
    multiple: false,
    disabled: uploading,
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-[1.5px] border-dashed rounded-xl px-8 py-12 text-center cursor-pointer transition-all duration-200 outline-none',
        isDragActive
          ? 'border-ie-accent bg-ie-accent-light'
          : uploading
            ? 'border-ie-border bg-ie-bg cursor-not-allowed opacity-70'
            : 'border-ie-border bg-ie-surface hover:border-ie-accent hover:bg-ie-accent-light'
      )}
    >
      <input {...getInputProps()} />

      <div
        className={cn(
          'w-11 h-11 mx-auto mb-4 flex items-center justify-center rounded-[10px] border border-ie-border bg-ie-bg transition-transform duration-200',
          isDragActive && '-translate-y-1'
        )}
      >
        {uploading ? (
          <Loader2 size={20} className="text-ie-accent animate-spin" />
        ) : (
          <Upload size={20} className="text-ie-muted" />
        )}
      </div>

      <p className="text-[15px] font-medium mb-1.5">
        {uploading
          ? 'Se încarcă...'
          : isDragActive
            ? 'Eliberează fișierul'
            : 'Încarcă factură'}
      </p>

      {!uploading && (
        <p className="text-[13px] text-ie-muted mb-[18px]">
          {isDragActive
            ? 'Fișierul va fi procesat automat'
            : 'Trage fișierul aici sau click pentru a selecta'}
        </p>
      )}

      {uploading && (
        <p className="text-[13px] text-ie-muted mb-[18px]">
          Fișierul este trimis către server...
        </p>
      )}

      {!uploading && (
        <div className="flex flex-wrap gap-2 justify-center">
          {formats.map((fmt) => (
            <span
              key={fmt}
              className="font-[family-name:var(--font-dm-mono)] text-[11px] bg-ie-bg border border-ie-border text-ie-muted px-[9px] py-[3px] rounded"
            >
              {fmt}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
