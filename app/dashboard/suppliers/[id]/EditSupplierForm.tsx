'use client'

import { useTransition, useState } from 'react'
import { toast } from 'sonner'
import { updateSupplier } from '../actions'

interface Props {
  supplierId: string
  initialName: string | null
  initialAddress: string | null
}

export function EditSupplierForm({ supplierId, initialName, initialAddress }: Props) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(initialName ?? '')
  const [address, setAddress] = useState(initialAddress ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const { error } = await updateSupplier(supplierId, { name, address })
      if (error) {
        toast.error('Eroare la salvare', { description: error })
      } else {
        toast.success('Date actualizate')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nume furnizor</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Numele furnizorului"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Adresă</label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Adresa furnizorului"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {pending ? 'Se salvează…' : 'Salvează'}
      </button>
    </form>
  )
}
