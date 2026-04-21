import type { SupabaseClient } from '@supabase/supabase-js'

export interface AnafValidationResult {
  success: boolean
  anaf_vat_payer?: boolean
  anaf_active?: boolean
  scpTVA?: boolean       // alias UI — același ca anaf_vat_payer
  denumire?: string
  adresa?: string
  nrRegCom?: string
  stare?: string
  data_inceput_ScpTVA?: string
  error?: string
}

/**
 * Core ANAF CUI validation — acceptă un client Supabase deja autentificat.
 * Fără 'use server', fără re-autentificare, fără Bottleneck.
 * Folosit atât de anaf.ts (buton manual) cât și de extract-invoice.ts (auto).
 */
export async function runAnafValidation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  invoiceId: string,
  vendorCui: string,
  invoiceDate: string | null,
): Promise<AnafValidationResult> {
  const rawCui = vendorCui.toString().trim().replace(/^RO/i, '')
  const cuiInt = parseInt(rawCui, 10)
  if (isNaN(cuiInt)) return { success: false, error: 'CUI invalid' }

  // Cache 7 zile
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: cached } = await supabase
    .from('anaf_cache')
    .select('response')
    .eq('cui', rawCui)
    .gte('cached_at', sevenDaysAgo)
    .maybeSingle()

  let found: Record<string, unknown>

  if (cached?.response) {
    found = cached.response as Record<string, unknown>
  } else {
    const date = invoiceDate
      ? String(invoiceDate).split('T')[0]
      : new Date().toISOString().split('T')[0]

    const res = await fetch('https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ cui: cuiInt, data: date }]),
      signal: AbortSignal.timeout(10_000),
    })

    const isJson = res.headers.get('content-type')?.includes('application/json')
    if (!res.ok && (!isJson || res.status !== 404)) {
      throw new Error(`ANAF indisponibil/mentenanță (${res.status})`)
    }

    const result = await res.json() as { found?: unknown[]; notFound?: unknown[] }
    const foundItem = result?.found?.[0] as Record<string, unknown> | undefined
    if (!foundItem) return { success: false, error: 'CUI negăsit în baza de date ANAF' }

    found = foundItem

    await supabase
      .from('anaf_cache')
      .upsert(
        { cui: rawCui, response: found, cached_at: new Date().toISOString() },
        { onConflict: 'cui' },
      )
  }

  const dateGenerale = found.date_generale as Record<string, unknown> | null
  const inregistrareTva = found.inregistrare_scop_Tva as Record<string, unknown> | null

  const denumire = (dateGenerale?.denumire as string) ?? undefined
  const adresa = (dateGenerale?.adresa as string) ?? undefined
  const nrRegCom = (dateGenerale?.nrRegCom as string) ?? undefined
  const stare = (dateGenerale?.stare_inregistrare as string) ?? ''
  const scpTVA = (inregistrareTva?.scpTVA as boolean) ?? false
  const data_inceput_ScpTVA = (inregistrareTva?.data_inceput_ScpTVA as string) ?? undefined
  const isActive = stare.toUpperCase().includes('ACTIVA')

  await supabase
    .from('invoices')
    .update({
      anaf_validated: true,
      anaf_vat_payer: scpTVA,
      anaf_active: isActive,
      anaf_validated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)

  return {
    success: true,
    anaf_vat_payer: scpTVA,
    anaf_active: isActive,
    scpTVA,
    denumire,
    adresa,
    nrRegCom,
    stare,
    data_inceput_ScpTVA,
  }
}
