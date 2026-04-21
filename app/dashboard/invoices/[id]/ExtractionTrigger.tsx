'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { extractInvoice } from '@/app/actions/extract-invoice'

interface ExtractionTriggerProps {
  invoiceId: string
  status: string
}

export function ExtractionTrigger({ invoiceId, status }: ExtractionTriggerProps) {
  const router = useRouter()
  const triggered = useRef(false) // guard contra React StrictMode double-mount

  useEffect(() => {
    if (status !== 'processing') return

    // Polling: refresh server data la 3s până statusul se schimbă
    const interval = setInterval(() => {
      router.refresh()
    }, 3000)

    // Fire extragere o singură dată
    if (!triggered.current) {
      triggered.current = true
      extractInvoice(invoiceId).finally(() => {
        router.refresh()
        clearInterval(interval)
      })
    }

    return () => clearInterval(interval)
  }, [invoiceId, status, router])

  return null
}
