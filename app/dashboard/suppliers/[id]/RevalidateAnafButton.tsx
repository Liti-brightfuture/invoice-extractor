'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { revalidateSupplierANAF } from '../actions'

interface Props {
  supplierId: string
}

export function RevalidateAnafButton({ supplierId }: Props) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleClick() {
    startTransition(async () => {
      const result = await revalidateSupplierANAF(supplierId)
      if (result.error) {
        toast.error('Eroare ANAF', { description: result.error })
      } else {
        toast.success(
          result.scpTVA ? 'Plătitor TVA — activ' : 'Neplătitor TVA',
          { description: 'Date ANAF actualizate' }
        )
        router.refresh()
      }
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
    >
      {pending ? 'Se verifică ANAF…' : 'Re-validează ANAF'}
    </button>
  )
}
