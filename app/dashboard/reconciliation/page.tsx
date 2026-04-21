import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { findDuplicates, getConfirmedDuplicates } from './actions'
import { ReconciliationBoard } from './ReconciliationBoard'

export default async function ReconciliationPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [candidates, confirmedPairs] = await Promise.all([
    findDuplicates(),
    getConfirmedDuplicates(),
  ])

  return <ReconciliationBoard candidates={candidates} confirmedPairs={confirmedPairs} />
}
