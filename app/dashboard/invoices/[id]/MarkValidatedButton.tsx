'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markInvoiceAsValidated } from '@/app/dashboard/actions'
import { CheckCircle2, Loader2 } from 'lucide-react'

interface Props {
  invoiceId: string
}

export function MarkValidatedButton({ invoiceId }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleMarkAsValidated = () => {
    startTransition(async () => {
      try {
        await markInvoiceAsValidated(invoiceId)
        router.refresh()
      } catch (err) {
        console.error(err)
        alert('Eroare la marcarea facturii ca validată.')
      }
    })
  }

  return (
    <div className="mt-8 pt-6 border-t border-ie-border flex justify-center">
      <button
        onClick={handleMarkAsValidated}
        disabled={isPending}
        className="flex items-center gap-2 px-6 py-2.5 bg-ie-accent hover:bg-ie-accent-hover text-white rounded-lg text-[14px] font-semibold transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Se marchează...
          </>
        ) : (
          <>
            <CheckCircle2 size={16} />
            Marchează ca Validată
          </>
        )}
      </button>
    </div>
  )
}
